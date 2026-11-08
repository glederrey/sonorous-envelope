import type { EngineState } from "@sonorous/engine";

/** One second of silence as a WAV blob. A looping silent <audio> tells the phone "media is playing":
 *  it keeps the page alive more often in the background, enables lock-screen controls, and on iOS
 *  moves the page to the playback audio category so the silent switch does not mute it. */
function silentAudio(): HTMLAudioElement {
  const rate = 8000;
  const bytes = new Uint8Array(44 + rate);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + rate, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, "data"); view.setUint32(40, rate, true);
  bytes.fill(128, 44); // 8-bit PCM silence
  const el = new Audio(URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })));
  el.loop = true;
  return el;
}

/** Thin wrapper around the AudioContext and the engine worklet. Created only after a user tap. */
export class AudioOutput {
  private constructor(private ctx: AudioContext, private node: AudioWorkletNode, private keepAlive: HTMLAudioElement) {}

  static async start(): Promise<AudioOutput> {
    // Safari 16.4+: play even when the ringer switch is on silent
    try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = "playback"; } catch { /* not supported */ }
    const keepAlive = silentAudio(); // used only if the element output below cannot start
    void keepAlive.play().catch(() => { /* needs the tap's activation; the sound still works without it */ });
    const ctx = new AudioContext({ latencyHint: "playback" });
    void ctx.resume(); // while the tap's user activation is still valid (Safari can lose it across an await)
    await ctx.audioWorklet.addModule("/worklet/engine-worklet.js");
    const node = new AudioWorkletNode(ctx, "sonorous-engine", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });
    // Play the synth through a real <audio> element instead of straight to the speakers. Phones treat an element as media
    // playback (it keeps going with the screen off and shows lock-screen controls); bare Web Audio gets paused.
    let element = keepAlive;
    try {
      const sink = ctx.createMediaStreamDestination();
      node.connect(sink);
      const out = new Audio();
      out.srcObject = sink.stream;
      await out.play();
      keepAlive.pause(); // the silent track is no longer needed
      element = out;
    } catch {
      node.connect(ctx.destination); // fall back to the plain output
    }
    await ctx.resume();
    return new AudioOutput(ctx, node, element);
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
  /** Try to restart after the phone interrupted us. Browsers may refuse unless this runs inside a tap. */
  async resume() {
    try { await this.ctx.resume(); } catch { /* needs a tap */ }
    void this.keepAlive.play().catch(() => {});
  }
  async close() {
    try { this.keepAlive.pause(); this.keepAlive.srcObject = null; this.node.disconnect(); await this.ctx.close(); } catch { /* already closed */ }
  }
}
