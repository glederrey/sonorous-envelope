import type { EngineState } from "@sonorous/engine";

/** Whether a state is something the listener hears, for the picture: the synth has volume, or Strudel plays (the paused synth in a
 *  Strudel state keeps the volume it had, which is 0 after a silence). */
export function isSounding(state: Pick<EngineState, "volume" | "engine" | "pattern">): boolean {
  return state.volume > 0.001 || (state.engine === "strudel" && Boolean(state.pattern));
}
