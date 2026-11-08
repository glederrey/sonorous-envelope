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
  private constructor(private ctx: AudioContext, private node: AudioWorkletNode, private keepAlive: HTMLAudioElement) {}

  static async start(): Promise<AudioOutput> {
    // Safari 16.4+: play even when the ringer switch is on silent
    try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = "playback"; } catch { /* not supported */ }
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

  setState(state: EngineState, seed: number) { this.node.port.postMessage({ type: "state", state, seed }); }
  setGain(value: number) { this.node.port.postMessage({ type: "gain", value }); }
  setDelay(value: number, max: number) { this.node.port.postMessage({ type: "delay", value, max }); }
  get running() { return this.ctx.state === "running"; }
  get state() { return this.ctx.state as string; }
  get keepAlivePlaying() { return !this.keepAlive.paused; }
  /** Calls back with the context state ("running", "suspended", or "interrupted" on iOS) whenever it changes. */
  watch(cb: (state: string) => void) {
    const report = () => cb(this.ctx.state !== "running" ? this.ctx.state : this.keepAlive.paused ? "paused" : "running");
    this.ctx.onstatechange = report;
    // the phone can pause the element (another app took the audio): show the Resume button instead of silence
    this.keepAlive.onpause = report;
    this.keepAlive.onplay = report;
    report();
  }
  /** Pause the keep-alive file, so the lock-screen player shows Play while muted. The synth itself keeps running. */
  pauseElement() { this.keepAlive.pause(); }
  /** Try to restart after the phone interrupted us. Browsers may refuse unless this runs inside a tap. */
  async resume() {
    try { await this.ctx.resume(); } catch { /* needs a tap */ }
    void this.keepAlive.play().catch(() => {});
  }
  async close() {
    try { this.keepAlive.pause(); this.keepAlive.srcObject = null; this.node.disconnect(); await this.ctx.close(); } catch { /* already closed */ }
  }
}
