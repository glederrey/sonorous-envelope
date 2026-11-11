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
/** An event this late (a stalled page catching up) is dropped instead of played in a burst. Short stalls still play, late. */
const LATE_DROP_S = 0.5;

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
  /** superdough's output goes through this node, so a pattern can fade out; then into the player's volume node */
  private fade: GainNode;
  private hub: AudioNode | null = null; // superdough's last node, which feeds `fade`
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stats = { played: 0, late: 0, invalid: 0, resyncs: 0, worstLate: 0 }; // for ?debug=1: what the page did with the events
  private held = false; // stopped for good and kept silent: the next play starts on a fresh node
  private seq = 0; // one per play: a report that comes from an older run is not the new code's
  private lastReport: Report | null = null;

  constructor(private ctx: AudioContext, private out: AudioNode, private hooks: StrudelHooks) {
    this.fade = new GainNode(ctx);
    this.fade.connect(out);
  }

  get playing() { return this.current !== null; }
  get code() { return this.current?.code ?? null; }

  /** Load superdough once and route its output into the player's graph (the listener's volume node). */
  private async init() {
    if (!this.ready) this.ready = (async () => {
      const sd = (this.sd = await import("superdough"));
      sd.setAudioContext(this.ctx);
      const ctrl = sd.getSuperdoughAudioController();
      // superdough connects to ctx.destination; take its last node and send it through the listener's gain instead
      const hub = (this.hub = ctrl.output.destinationGain);
      hub.disconnect();
      hub.connect(this.fade);
      await sd.initAudio({ maxPolyphony: 128 });
      sd.registerSynthSounds();
      sd.registerZZFXSounds?.();
      // what strudel.cc has on start; a slow or blocked host must not keep the synth sounds (sawtooth, sine...) from playing
      await Promise.race([Promise.all(DEFAULT_BANKS.map((b) => this.loadBank(b))), new Promise((r) => setTimeout(r, 8000))]);
    })().catch((e) => { this.ready = null; throw e; }); // a failed start can be tried again
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
    const m = e.data as { token?: string; kind?: string; hap?: unknown; report?: unknown; names?: unknown; seq?: unknown };
    if (!m || typeof m !== "object" || m.token !== this.token) return;
    if (m.kind === "alive") { this.lastAlive = performance.now(); return; }
    if (m.kind === "hap") {
      const h = validateHap(m.hap);
      // a hap already well past (the worker or the page was throttled, then caught up) is dropped: playing a burst of old events is the "speeds up" glitch
      // h.t is on the clock shifted back by the output latency (clockMsg), so a hap that is on time already lies up to `latency` behind currentTime
      const late = h ? this.ctx.currentTime - h.t - this.hooks.latency() : 0;
      if (!h) this.stats.invalid++;
      else if (late >= LATE_DROP_S) this.stats.late++;
      else if (this.sd && this.current) { this.stats.played++; this.stats.worstLate = Math.max(this.stats.worstLate, late); void this.sd.superdough(h.v, h.t, h.d, h.cps, h.cycle).catch(() => {}); }
    } else if (m.kind === "report") {
      if (typeof (m as { seq?: unknown }).seq === "number" && (m as { seq: number }).seq !== this.seq) return; // from an older code
      const r = validateReport(m.report);
      if (r && this.current) { this.lastReport = r; this.hooks.onReport(this.current.id, r); }
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
    if (this.current && !this.stopTimer && this.current.code === src.code && this.current.bpm === src.bpm) {
      this.current = { ...this.current, id: src.id ?? this.current.id };
      if (src.id && this.lastReport) this.hooks.onReport(src.id, this.lastReport); // the same code again is a new state: it gets the report too
      return;
    }
    try {
      await Promise.all([this.init(), this.startFrame()]);
    } catch {
      this.hooks.onReport(src.id, { ok: false, error: "Strudel could not start in this browser", notes: [] });
      return;
    }
    if (this.dead) return;
    if (this.held) { this.held = false; this.renewFade(); }
    this.cancelStop();
    this.current = src;
    this.lastAlive = performance.now(); // the worker has been quiet since it was stopped: the watchdog must not read that as a freeze
    void this.ctx.resume();
    this.lastReport = null;
    this.send({ kind: "play", code: src.code, bpm: src.bpm, seed: src.seed, seq: ++this.seq, ...this.clockMsg() });
    if (this.resync) clearInterval(this.resync);
    this.resync = setInterval(() => { this.stats.resyncs++; this.send({ kind: "clock", ...this.clockMsg() }); }, 4000);
  }

  private cancelStop() {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.fade.gain.cancelScheduledValues(this.ctx.currentTime);
    this.fade.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /** A fresh fade node: the notes of the old pattern (and their tails) went into the old one, which is cut. */
  private renewFade() {
    const old = this.fade;
    this.fade = new GainNode(this.ctx);
    this.fade.connect(this.out);
    if (this.hub) { this.hub.disconnect(); this.hub.connect(this.fade); }
    old.disconnect();
  }

  /** Stop the pattern: after `after` seconds, fading out over `fadeSeconds`. A new `play` before that cancels it. */
  stop(fadeSeconds = 0.3, after = 0) {
    if (!this.current) return;
    const now = this.ctx.currentTime;
    this.cancelStop();
    if (fadeSeconds > 0 || after > 0) {
      this.fade.gain.setValueAtTime(1, now + after);
      this.fade.gain.linearRampToValueAtTime(0, now + after + Math.max(0.05, fadeSeconds));
    }
    this.stopTimer = setTimeout(() => this.hardStop(), (after + Math.max(0.05, fadeSeconds) + 0.1) * 1000);
  }

  private hardStop() {
    if (this.frame) this.send({ kind: "stop" });
    if (this.resync) clearInterval(this.resync);
    this.resync = null; this.current = null; this.stopTimer = null;
    // Hold the fade node at zero: notes the worker had already handed to superdough (up to the lookahead, and their tails) sit upstream
    // of it and would sound at full volume if the gain came back. The next play cuts them with a fresh node.
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(0, now);
    this.held = true;
  }

  /** One line for ?debug=1 */
  statsLine() { const s = this.stats; return `Strudel: ${s.played} events played, ${s.late} dropped as late, ${s.invalid} refused, worst lateness ${Math.round(s.worstLate * 1000)} ms, ${s.resyncs} clock syncs.`; }

  close() { this.dead = true; if (this.stopTimer) clearTimeout(this.stopTimer); this.teardown(); }
}
