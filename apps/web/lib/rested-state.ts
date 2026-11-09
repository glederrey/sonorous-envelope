import type { EngineState } from "@sonorous/engine";

/** What plays after rest_after with no update: the same state, silent, the colour dark and still, over 30 s.
 *  The layers keep running with the volume at 0, so the same seed carries on and nothing is written. */
export function restedState(state: EngineState): EngineState {
  const s: EngineState = JSON.parse(JSON.stringify(state));
  s.volume = 0;
  s.transition = { time: 30, curve: "smooth" };
  s.colour = {
    ...s.colour, l: 0.04, motion: "still", pulseHz: 0,
    ...(s.colour.secondary ? { secondary: { ...s.colour.secondary, l: 0.02 } } : {}),
  };
  return s;
}
