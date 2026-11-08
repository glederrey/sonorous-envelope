import type { EngineState } from "@sonorous/engine";

/** Thin wrapper around the AudioContext and the engine worklet. Created only after a user tap. */
export class AudioOutput {
  private constructor(private ctx: AudioContext, private node: AudioWorkletNode) {}

  static async start(): Promise<AudioOutput> {
    const ctx = new AudioContext({ latencyHint: "playback" });
    await ctx.audioWorklet.addModule("/worklet/engine-worklet.js");
    const node = new AudioWorkletNode(ctx, "sonorous-engine", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
    });
    node.connect(ctx.destination);
    await ctx.resume();
    return new AudioOutput(ctx, node);
  }

  setState(state: EngineState, seed: number) { this.node.port.postMessage({ type: "state", state, seed }); }
  setGain(value: number) { this.node.port.postMessage({ type: "gain", value }); }
  setDelay(value: number, max: number) { this.node.port.postMessage({ type: "delay", value, max }); }
  get running() { return this.ctx.state === "running"; }
  async close() { try { this.node.disconnect(); await this.ctx.close(); } catch { /* already closed */ } }
}
