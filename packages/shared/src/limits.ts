import { clone } from "./util";
import type { EngineState } from "@sonorous/engine";
import type { Transition } from "./schemas";

// Claude decides how it sounds and looks: tempo, scale, wave, roughness, echo, colour, transitions are all free.
// What is left here is not a listener limit. It is two safety rules and two stability limits, and the player
// applies the same function again before playing (docs/implementation/limits.md).
//   - safety: the master volume never goes above 0.9 (the large-element flash cap was lifted on 2026-11-13, see visual.ts and docs/safety.md)
//   - stability: the echo feedback stays below 1 and the echo time inside the delay buffer (1.5 s)
// Real listener limits (consent, harshness, colour caps) are a later piece of work; the old code is in the git history.

const r2 = (x: number) => Math.round(x * 100) / 100;

export interface LimitInput {
  mapped: EngineState;
  transition?: Transition;
}

/** Idempotent: applying it twice changes nothing. */
export function hardCaps(s: EngineState, note: (field: string, from: number | string, to: number | string, why: string) => void = () => {}) {
  if (s.fx.delay.time > 1.5) { note("echo time", s.fx.delay.time, 1.5, "stability"); s.fx.delay.time = 1.5; }
  if (s.fx.delay.feedback > 0.85) { note("echo feedback", s.fx.delay.feedback, 0.85, "stability"); s.fx.delay.feedback = 0.85; }

  // Hard rule, not configurable. The beat motion is kept under the flash threshold by `capFrame` (visual.ts), in the player as well.
  // `pulseHz` is the old CSS pulse, still used by the fallback field and the landing page: never faster than 3 Hz.
  const c = s.colour;
  if (c.pulseHz > 3) { note("pulse", c.pulseHz, 3, "safety"); c.pulseHz = 3; }
  if (c.motion !== "pulse") c.pulseHz = 0;
  if (c.density !== undefined) c.density = Math.min(1, Math.max(0, c.density));
  if (c.speed !== undefined) c.speed = Math.min(1, Math.max(0, c.speed));
  if (c.feel) for (const k of Object.keys(c.feel) as Array<keyof typeof c.feel>) c.feel[k] = Math.min(1, Math.max(0, c.feel[k]));

  // the absolute volume cap; the listener's own slider is the volume control
  if (s.volume > 0.9) { note("volume", s.volume, 0.9, "safety"); s.volume = 0.9; }
  s.pan.width = Math.min(1, Math.max(0, s.pan.width));
}

/** The effective state: the mapped state with the safety rules and the requested transition. Pure. */
export function applyLimits(input: LimitInput): { effective: EngineState; clamps: string[] } {
  const s: EngineState = clone(input.mapped);
  const clamps: string[] = [];
  hardCaps(s, (field, from, to, why) =>
    clamps.push(`${field} ${typeof from === "number" ? r2(from) : from}→${typeof to === "number" ? r2(to) : to} (${why})`));
  const t = input.transition ?? { time: 4, curve: "smooth" as const };
  s.transition = { time: t.time, curve: t.curve };
  return { effective: s, clamps };
}
