import type { EngineState } from "@sonorous/engine";

/** A real media file (60 s of very quiet noise, not digital silence), looped. Android Chrome only shows a media
 *  notification, keeps the tab counted as playing media and treats the page as foreground for media that is a real file
 *  of a few seconds or more; the earlier 1 s blob and the MediaStream element never qualified (no lock-screen player). */
function keepAliveAudio(): HTMLAudioElement {
  const el = new Audio("/keepalive.wav");
  el.loop = true;
  el.preload = "auto";
  el.volume = 0.05; // the file is already near-silent; this makes sure nothing audible leaks even on a loud device
  return el;
}

/** Thin wrapper around the AudioContext and the engine worklet. Created only after a user tap. */
export class AudioOutput {
  /** Timestamped statechange / pause / play events, newest last, for the ?debug=1 report. */
  readonly events: string[] = [];
  /** True while we paused the keep-alive file on purpose (mute): the auto-resume must leave it alone. */
  private heldPaused = false;
  private constructor(private ctx: AudioContext, private node: AudioWorkletNode, private keepAlive: HTMLAudioElement) {}

  private log(what: string) {
    this.events.push(`${new Date().toLocaleTimeString("en-GB")} ${what}`);
    if (this.events.length > 30) this.events.shift();
  }

  /** Restart without a tap when the phone took the audio (dictation, a call): the page had user activation at start. */
  private autoResume(why: string) {
    if (this.heldPaused) return;
    this.log(`auto-resume after ${why}`);
    void this.ctx.resume().catch(() => this.log("context resume refused"));
    void this.keepAlive.play().catch(() => this.log("keep-alive play refused"));
  }

  static async start(): Promise<AudioOutput> {
    // Safari 16.4+: play even when the ringer switch is on silent
    // ?audiosession=ambient|play-and-record|auto tries another type, to see whether one lets the sound coexist with the mic
    const asked = new URLSearchParams(window.location.search).get("audiosession");
    try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = asked ?? "playback"; } catch { /* not supported */ }
    const keepAlive = keepAliveAudio();
    void keepAlive.play().catch(() => { /* needs the tap's activation; the sound still works without it */ });
    const ctx = new AudioContext({ latencyHint: "playback" });
    void ctx.resume(); // while the tap's user activation is still valid (Safari can lose it across an await)
    await ctx.audioWorklet.addModule("/worklet/engine-worklet.js");
    const node = new AudioWorkletNode(ctx, "sonorous-engine", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });
    node.connect(ctx.destination);
    await ctx.resume();
    return new AudioOutput(ctx, node, keepAlive);
  }

  setState(state: EngineState, seed: number, delay = 0, elapsed?: number) { this.node.port.postMessage({ type: "state", state, seed, delay, elapsed }); }
  /** The shared timeline: one seed per session for the choices of each step, and now and then the seconds since the current state was written. */
  setGridSeed(seed: number) { this.node.port.postMessage({ type: "grid", seed }); }
  syncGrid(elapsed: number) { this.node.port.postMessage({ type: "sync", elapsed }); }
  setGestures(on: boolean) { this.node.port.postMessage({ type: "gestures", on }); }
  setGain(value: number) { this.node.port.postMessage({ type: "gain", value }); }
  get running() { return this.ctx.state === "running"; }
  get state() { return this.ctx.state as string; }
  get audioSessionType(): string {
    return (navigator as unknown as { audioSession?: { type: string } }).audioSession?.type ?? "not supported";
  }
  get keepAlivePlaying() { return !this.keepAlive.paused; }
  /** Calls back with the context state ("running", "suspended", or "interrupted" on iOS) whenever it changes. */
  watch(cb: (state: string) => void) {
    const report = () => cb(this.ctx.state !== "running" ? this.ctx.state : this.keepAlive.paused ? "paused" : "running");
    this.ctx.onstatechange = () => {
      this.log(`context ${this.ctx.state}`);
      if (this.ctx.state !== "running") this.autoResume(`context ${this.ctx.state}`);
      report();
    };
    // the phone can pause the element (another app took the audio): try to restart, and show the Resume button if that fails
    this.keepAlive.onpause = () => { this.log("keep-alive pause"); this.autoResume("keep-alive pause"); report(); };
    this.keepAlive.onplay = () => { this.log("keep-alive play"); report(); };
    report();
  }
  /** Pause the keep-alive file, so the lock-screen player shows Play while muted. The synth itself keeps running. */
  pauseElement() { this.heldPaused = true; this.keepAlive.pause(); }
  /** Try to restart after the phone interrupted us. Browsers may refuse unless this runs inside a tap. */
  async resume() {
    this.heldPaused = false;
    try { await this.ctx.resume(); } catch { /* needs a tap */ }
    void this.keepAlive.play().catch(() => {});
  }
  async close() {
    try { this.keepAlive.pause(); this.keepAlive.srcObject = null; this.node.disconnect(); await this.ctx.close(); } catch { /* already closed */ }
  }
}
