import { FRAME_URL, WORKER_URL, validateHap, validateReport, type Report, type ToFrame } from "./protocol";
import { DEFAULT_BANKS, resolveBankRequest, safeSampleMap } from "./banks";

// The page's side of Strudel (docs/implementation/strudel.md). The model's code runs in a sandboxed frame and only sends events; this
// class plays them with superdough into the player's own audio graph, loads samples from the allowed banks, and watches the frame.
// Nothing here limits how loud or harsh the music is: Strudel on sonorous has no sound limits besides the listener's own volume.

export interface PatternSource { id: string | null; code: string; bpm: number; seed: number }
export interface StrudelHooks {
  /** what the code did when it ran (an error, events per cycle, sounds): for the model, through the owner's player */
  onReport: (stateId: string | null, report: Report) => void;
  /** the cycle on the shared timeline now (beats / 4) */
  cycleNow: () => number;
  /** seconds from audio being scheduled to the ear */
  latency: () => number;
}

type Sd = typeof import("superdough");
const WATCHDOG_MS = 2500;

export class StrudelOutput {
  private sd: Sd | null = null;
  private ready: Promise<void> | null = null;
  private frame: HTMLIFrameElement | null = null;
  private frameReady: Promise<void> | null = null;
  private token = "";
  private current: PatternSource | null = null;
  private lastAlive = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private resync: ReturnType<typeof setInterval> | null = null;
  private banks = new Set<string>();
  private listener = (e: MessageEvent) => this.onMessage(e);
  private dead = false;

  constructor(private ctx: AudioContext, private out: AudioNode, private hooks: StrudelHooks) {}

  get playing() { return this.current !== null; }
  get code() { return this.current?.code ?? null; }

  /** Load superdough once and route its output into the player's graph (the listener's volume node). */
  private async init() {
    if (!this.ready) this.ready = (async () => {
      const sd = (this.sd = await import("superdough"));
      sd.setAudioContext(this.ctx);
      const ctrl = sd.getSuperdoughAudioController();
      // superdough connects to ctx.destination; take its last node and send it through the listener's gain instead
      ctrl.output.destinationGain.disconnect();
      ctrl.output.destinationGain.connect(this.out);
      await sd.initAudio({ maxPolyphony: 128 });
      sd.registerSynthSounds();
      sd.registerZZFXSounds?.();
      await Promise.all(DEFAULT_BANKS.map((b) => this.loadBank(b))); // what strudel.cc has on start
    })();
    return this.ready;
  }

  private async loadBank(request: string) {
    const url = resolveBankRequest(request);
    if (!url || this.banks.has(url)) return;
    this.banks.add(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const safe = safeSampleMap(await res.json());
      if (safe) await this.sd!.samples(safe.map, safe.base);
    } catch { this.banks.delete(url); /* offline or blocked: the synths still play */ }
  }

  private async startFrame() {
    if (this.frameReady) return this.frameReady;
    this.token = crypto.randomUUID();
    this.frameReady = (async () => {
      const worker = await (await fetch(WORKER_URL)).text();
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts"); // no allow-same-origin: an opaque origin, no storage, no cookies
      f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
      f.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
      f.allow = "autoplay 'none'; microphone 'none'; camera 'none'; geolocation 'none'";
      f.src = FRAME_URL;
      window.addEventListener("message", this.listener);
      this.frame = f;
      await new Promise<void>((ok, bad) => { f.onload = () => ok(); f.onerror = () => bad(new Error("frame")); document.body.appendChild(f); });
      this.send({ kind: "init", token: this.token, worker });
      await new Promise((r) => setTimeout(r, 250));
      this.lastAlive = performance.now();
      this.watchdog = setInterval(() => this.check(), 1000);
    })();
    return this.frameReady;
  }

  private send(m: ToFrame) { this.frame?.contentWindow?.postMessage(m, "*"); }

  private clockMsg() {
    // the cycle the ear should hear now: events are scheduled `latency` early, as the picture is drawn `latency` late
    return { ctxTime: this.ctx.currentTime - this.hooks.latency(), epochMs: Date.now(), cycle: this.hooks.cycleNow() };
  }

  private onMessage(e: MessageEvent) {
    if (!this.frame || e.source !== this.frame.contentWindow) return;
    const m = e.data as { token?: string; kind?: string; hap?: unknown; report?: unknown; names?: unknown };
    if (!m || typeof m !== "object" || m.token !== this.token) return;
    if (m.kind === "alive") { this.lastAlive = performance.now(); return; }
    if (m.kind === "hap") {
      const h = validateHap(m.hap);
      if (h && this.sd && this.current) void this.sd.superdough(h.v, h.t, h.d, h.cps, h.cycle).catch(() => {});
    } else if (m.kind === "report") {
      const r = validateReport(m.report);
      if (r && this.current) this.hooks.onReport(this.current.id, r);
    } else if (m.kind === "banks" && Array.isArray(m.names)) {
      for (const n of m.names.slice(0, 8)) if (typeof n === "string") void this.loadBank(n);
    }
  }

  /** A frozen worker (an endless loop in the code) must not freeze the player: no heartbeat, so the frame is removed. */
  private check() {
    if (!this.current || performance.now() - this.lastAlive < WATCHDOG_MS) return;
    const id = this.current.id;
    this.teardown();
    this.hooks.onReport(id, { ok: false, error: "the code froze the sandbox (an endless loop?), so it was stopped", notes: [] });
  }

  private teardown() {
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.resync) clearInterval(this.resync);
    this.watchdog = this.resync = null;
    window.removeEventListener("message", this.listener);
    this.frame?.remove();
    this.frame = null; this.frameReady = null; this.current = null;
  }

  /** Play this code from the next bar. The same code and tempo again changes nothing. */
  async play(src: PatternSource) {
    if (this.dead) return;
    if (this.current && this.current.code === src.code && this.current.bpm === src.bpm) { this.current = { ...this.current, id: src.id ?? this.current.id }; return; }
    try {
      await Promise.all([this.init(), this.startFrame()]);
    } catch {
      this.hooks.onReport(src.id, { ok: false, error: "Strudel could not start in this browser", notes: [] });
      return;
    }
    if (this.dead) return;
    this.current = src;
    void this.ctx.resume();
    this.send({ kind: "play", code: src.code, bpm: src.bpm, seed: src.seed, ...this.clockMsg() });
    if (this.resync) clearInterval(this.resync);
    this.resync = setInterval(() => this.send({ kind: "clock", ...this.clockMsg() }), 4000);
  }

  stop() {
    if (this.frame) this.send({ kind: "stop" });
    if (this.resync) clearInterval(this.resync);
    this.resync = null; this.current = null;
  }

  close() { this.dead = true; this.teardown(); }
}
