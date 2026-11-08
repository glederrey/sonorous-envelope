import { Engine } from "./engine";
import type { EngineState, NoteEvent } from "./types";

export interface RenderOptions { seconds: number; sampleRate: number; seed: number; from?: EngineState }

/** Renders a state offline. The note events are what the analysis uses for exact onset density and pitch range. */
export function renderOffline(state: EngineState, opts: RenderOptions) {
  const engine = new Engine(opts.sampleRate, opts.seed);
  const events: NoteEvent[] = [];
  engine.recordEvents(events);
  if (opts.from) engine.setState(opts.from, opts.seed);
  engine.setState(state, opts.seed);
  const n = Math.round(opts.seconds * opts.sampleRate);
  const left = new Float32Array(n), right = new Float32Array(n);
  engine.process(left, right, n);
  return { left, right, events };
}
