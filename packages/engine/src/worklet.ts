import { Engine } from "./engine";
import type { EngineState } from "./types";

// AudioWorklet globals are not in the "ES2022" lib; declare only what is used.
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: { onmessage: ((e: { data: any }) => void) | null; postMessage(m: unknown): void };
  constructor();
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

class EngineProcessor extends AudioWorkletProcessor {
  private engine = new Engine(sampleRate, 1);
  constructor() {
    super();
    this.port.onmessage = (e) => {
      const m = e.data as
        | { type: "state"; state: EngineState; seed: number; delay?: number; elapsed?: number }
        | { type: "gain"; value: number }
        | { type: "grid"; seed: number }
        | { type: "sync"; elapsed: number };
      if (m.type === "state") this.engine.setState(m.state, m.seed, m.delay ?? 0, m.elapsed);
      else if (m.type === "gain") this.engine.setListenerGain(m.value);
      else if (m.type === "grid") this.engine.setGridSeed(m.seed);
      else if (m.type === "sync") this.engine.syncGrid(m.elapsed);
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    if (out && out.length >= 2) this.engine.process(out[0], out[1], out[0].length);
    else if (out && out.length === 1) { const r = new Float32Array(out[0].length); this.engine.process(out[0], r, out[0].length); }
    return true;
  }
}
(EngineProcessor.prototype as any).process = EngineProcessor.prototype.process;
registerProcessor("sonorous-engine", EngineProcessor as any);
