import type { EngineState, Rate } from "./types";

// The tempo glides (third outside test), and the shared timeline (roadmap #34) still has to hold: every device must know which
// step happens when. So the step rate is a linear ramp over the state's transition, and these pure functions give the step
// count after a time and the time of a step, in closed form. Server and engine use the same ones.

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

/** Beats (quarter notes at the arpeggio's tempo) counted from the start of the session, `tau` seconds after a state was written.
 *  Continuous across states, also when the rate changes. A state stored before `grid.beat` existed falls back to its step count. */
export function beatsAt(s: Pick<EngineState, "arp" | "grid">, tau: number): number {
  const beats = RATE_BEATS[s.arp.rate];
  return (s.grid?.beat ?? (s.grid?.arp ?? 0) * beats) + rampCount(arpRamp(s), tau) * beats;
}

/** How long a state's tempo glide lasts, from the transition it is written with: none for a sudden or very short one, or a delayed state. */
export function glideSeconds(t: EngineState["transition"]): number {
  return t.curve === "sudden" || t.time < MIN_GLIDE_S || (t.delay !== undefined && t.delay > 0) ? 0 : t.time;
}

/** The tempo (BPM) of a state `tau` seconds after it was written. */
export function tempoAt(s: Pick<EngineState, "arp" | "grid">, tau: number): number {
  const r = arpRamp(s), beats = RATE_BEATS[s.arp.rate];
  if (r.dur <= 0) return s.arp.tempo;
  const x = Math.min(1, Math.max(0, tau / r.dur));
  return (r.rho0 + (r.rho1 - r.rho0) * x) * 60 * beats;
}
