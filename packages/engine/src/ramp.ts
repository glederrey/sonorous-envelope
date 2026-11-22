import type { EngineState, Rate } from "./types";

// The tempo glides (third outside test), and the shared timeline (roadmap #34) still has to hold: every device must know which
// step happens when. So the step rate is a linear ramp over the state's transition, and these pure functions give the step
// count after a time and the time of a step, in closed form. Server and engine use the same ones.
// The arpeggio's rate (1/4, 1/8, ...) glides too when a state is written with the rate that was playing (`grid.fromRate`): it steps
// through the straight rates between the two, each switch on a whole beat, so the step counter stays a whole number at every switch.

export const RATE_BEATS: Record<Rate, number> = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 };

/** Steps per second from `rho0` to `rho1` over `dur` seconds, then `rho1`. `dur` 0 is a constant rate `rho1`. */
export interface Ramp { rho0: number; rho1: number; dur: number }

export const constantRamp = (stepSeconds: number): Ramp => ({ rho0: 1 / stepSeconds, rho1: 1 / stepSeconds, dur: 0 });

/** Steps counted after `tau` seconds. */
export function rampCount(r: Ramp, tau: number): number {
  if (tau <= 0) return 0;
  if (r.dur <= 0) return r.rho1 * tau;
  const t = Math.min(tau, r.dur);
  return r.rho0 * t + ((r.rho1 - r.rho0) * t * t) / (2 * r.dur) + (tau > r.dur ? r.rho1 * (tau - r.dur) : 0);
}

/** Seconds until `k` steps have been counted: the inverse of `rampCount`. */
export function rampTime(r: Ramp, k: number): number {
  if (k <= 0) return 0;
  if (r.dur <= 0) return k / r.rho1;
  const kEnd = rampCount(r, r.dur);
  if (k >= kEnd) return r.dur + (k - kEnd) / r.rho1;
  const a = (r.rho1 - r.rho0) / (2 * r.dur);
  if (Math.abs(a) < 1e-12) return k / r.rho0;
  return (-r.rho0 + Math.sqrt(r.rho0 * r.rho0 + 4 * a * k)) / (2 * a);
}

/** Tempos closer than this (BPM) do not glide. */
const MIN_GLIDE_BPM = 0.5;
/** Transitions shorter than this (s) are a step, not a glide. */
const MIN_GLIDE_S = 0.5;

/** The arpeggio's step ramp for a state: from the tempo that played when it was written (`grid.fromTempo`) to its own tempo
 *  over its transition. No ramp for a sudden or very short transition, a delayed state, or when there is no earlier tempo. */
export function arpRamp(s: Pick<EngineState, "arp" | "grid">): Ramp {
  const to = Math.max(20, s.arp.tempo), beats = RATE_BEATS[s.arp.rate];
  const from = s.grid?.fromTempo, dur = s.grid?.glide ?? 0;
  if (from === undefined || dur < MIN_GLIDE_S || Math.abs(from - to) < MIN_GLIDE_BPM) return { rho0: to / 60 / beats, rho1: to / 60 / beats, dur: 0 };
  return { rho0: Math.max(20, from) / 60 / beats, rho1: to / 60 / beats, dur };
}

/** The arpeggio's step plan for a state: how many steps have been counted `tau` seconds after it was written, when step `k` happens,
 *  and the rate that plays. For a state without a rate glide it is the ramp above; with one, the steps follow the rate path. */
export interface StepPlan {
  /** Steps counted since the state was written. */
  stepsAt(tau: number): number;
  /** Seconds after the state was written when `k` steps have been counted: the inverse of `stepsAt`. */
  timeOfStep(k: number): number;
  /** Seconds after the state was written when `beats` beats have passed since then (the inverse of `beatsAt`'s tempo integral). */
  timeOfBeats(beats: number): number;
  /** The arpeggio's rate `tau` seconds after the state was written (undefined for a plan that has none, like the bass's). */
  rateAt(tau: number): Rate | undefined;
  /** Length of step `k` (counted since the state was written) relative to a step at the state's own rate: 1 unless the rate glides. */
  lengthScale(k: number): number;
  /** Whether the step times are not simply one step length apart (a tempo or rate glide): the layer must then follow the plan. */
  varies: boolean;
}

/** The plan of a plain ramp (a constant or a tempo glide, no rate change). `rate` is the rate its steps have, if any. */
export function planOfRamp(r: Ramp, rate?: Rate): StepPlan {
  const beats = rate ? RATE_BEATS[rate] : 1;
  return {
    stepsAt: (tau) => rampCount(r, tau), timeOfStep: (k) => rampTime(r, k), timeOfBeats: (b) => rampTime(r, b / beats),
    rateAt: () => rate, lengthScale: () => 1, varies: r.dur > 0,
  };
}

const STRAIGHT_RATES: Rate[] = ["1/4", "1/8", "1/16"];

/** The rates a rate glide goes through, first to last: `from`, the straight rates strictly between the two, `to`. */
export function ratePath(from: Rate, to: Rate): Rate[] {
  const a = RATE_BEATS[from], b = RATE_BEATS[to], lo = Math.min(a, b), hi = Math.max(a, b);
  const mid = STRAIGHT_RATES.filter((r) => RATE_BEATS[r] > lo + 1e-9 && RATE_BEATS[r] < hi - 1e-9).sort((x, y) => (a > b ? RATE_BEATS[y] - RATE_BEATS[x] : RATE_BEATS[x] - RATE_BEATS[y]));
  return [from, ...mid, to];
}

/** The rate a state starts with when its arpeggio steps from the rate that played before (`grid.fromRate`) to its own, else undefined.
 *  It needs a glide, the tempo it came from, and a rate that differs; a Strudel state never steps (its synth fields are paused). */
export function steppedFromRate(s: { arp: Pick<EngineState["arp"], "rate">; grid?: EngineState["grid"]; engine?: EngineState["engine"]; pattern?: EngineState["pattern"] }): Rate | undefined {
  const g = s.grid;
  if (!g || g.fromTempo === undefined || g.fromRate === undefined || g.fromRate === s.arp.rate || (g.glide ?? 0) < MIN_GLIDE_S) return undefined;
  return s.engine === "strudel" && s.pattern ? undefined : g.fromRate;
}

/** The step plan of a state's arpeggio. With a rate glide, the tempo ramps as usual (in BPM, over `grid.glide`) and the rate goes through
 *  `ratePath`: switch `i` of `m` is nominally at `i / (m + 1)` of the glide, then moved on to the next bar line (if that is before the glide
 *  ends) or the next whole beat (never before the previous switch). On a whole beat the step counter is a whole number, whatever the rates
 *  (every rate divides a beat), as `nextGrid` starts the state on a step of its first rate. */
export function arpPlan(s: Pick<EngineState, "arp" | "grid" | "engine" | "pattern">): StepPlan {
  const first = steppedFromRate(s);
  if (!first) return planOfRamp(arpRamp(s), s.arp.rate);
  const g = s.grid!, D = g.glide!, to = Math.max(20, s.arp.tempo), from = Math.max(20, g.fromTempo!);
  const path = ratePath(first, s.arp.rate), m = path.length - 1;
  // beats per second over the glide, then constant
  const br: Ramp = { rho0: (Math.abs(from - to) < MIN_GLIDE_BPM ? to : from) / 60, rho1: to / 60, dur: D };
  const g0 = g.beat ?? (g.arp ?? 0) * RATE_BEATS[first], gEnd = g0 + rampCount(br, D);
  const bs = [0], cs = [0]; // start of each segment, in beats and in steps since the state was written
  let prev = g0;
  for (let i = 1; i <= m; i++) {
    const at = Math.max(g0 + rampCount(br, (i * D) / (m + 1)), prev + 1e-6);
    const bar = Math.ceil(at / 4 - 1e-9) * 4;
    prev = bar < gEnd ? bar : Math.ceil(at - 1e-9);
    bs.push(prev - g0); cs.push(cs[i - 1] + (bs[i] - bs[i - 1]) / RATE_BEATS[path[i - 1]]);
  }
  const seg = (xs: number[], x: number) => { let j = xs.length - 1; while (j > 0 && xs[j] > x + 1e-9) j--; return j; };
  const stepsOf = (b: number) => { const j = seg(bs, b); return cs[j] + (b - bs[j]) / RATE_BEATS[path[j]]; };
  const beatsOf = (k: number) => { const j = seg(cs, k); return bs[j] + (k - cs[j]) * RATE_BEATS[path[j]]; };
  return {
    stepsAt: (tau) => (tau <= 0 ? 0 : stepsOf(rampCount(br, tau))),
    timeOfStep: (k) => (k <= 0 ? 0 : rampTime(br, beatsOf(k))),
    timeOfBeats: (b) => rampTime(br, b),
    rateAt: (tau) => path[seg(bs, rampCount(br, tau))],
    lengthScale: (k) => RATE_BEATS[path[seg(cs, k)]] / RATE_BEATS[s.arp.rate],
    varies: true,
  };
}

/** Beats (quarter notes at the arpeggio's tempo) counted from the start of the session, `tau` seconds after a state was written.
 *  Continuous across states, also when the rate changes. A state stored before `grid.beat` existed falls back to its step count. */
export function beatsAt(s: Pick<EngineState, "arp" | "grid" | "engine" | "pattern">, tau: number): number {
  // a Strudel state has no tempo glide: its tempo is `pattern.bpm` from the first moment (Strudel's own tempo change is instant)
  if (s.engine === "strudel" && s.pattern) return (s.grid?.beat ?? 0) + (Math.max(0, tau) * s.pattern.bpm) / 60;
  const beats = RATE_BEATS[s.arp.rate];
  return (s.grid?.beat ?? (s.grid?.arp ?? 0) * beats) + rampCount(arpRamp(s), tau) * beats;
}

/** How long a state's tempo glide lasts, from the transition it is written with: none for a sudden or very short one, or a delayed state. */
export function glideSeconds(t: EngineState["transition"]): number {
  return t.curve === "sudden" || t.time < MIN_GLIDE_S || (t.delay !== undefined && t.delay > 0) ? 0 : t.time;
}

/** The tempo (BPM) of a state `tau` seconds after it was written. */
export function tempoAt(s: Pick<EngineState, "arp" | "grid" | "engine" | "pattern">, tau: number): number {
  if (s.engine === "strudel" && s.pattern) return s.pattern.bpm;
  const r = arpRamp(s), beats = RATE_BEATS[s.arp.rate];
  if (r.dur <= 0) return s.arp.tempo;
  const x = Math.min(1, Math.max(0, tau / r.dur));
  return (r.rho0 + (r.rho1 - r.rho0) * x) * 60 * beats;
}
