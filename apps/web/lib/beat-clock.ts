// The beat clock of the visuals. `beatsAt` (engine) says where the beat is on the shared timeline; this follows it smoothly.
// The picture must never snap when a state, a rate or a tempo changes: a snap is a jump in the brightness pulse, so it is a flash
// risk as well as ugly. The clock advances at the target's own speed and closes any gap at a bounded rate.

export interface LatencySource { outputLatency?: number; baseLatency?: number }

/** Seconds between the audio being scheduled and the listener hearing it. `outputLatency` where the browser has it (not Safari),
 *  `baseLatency` otherwise. `nudgeMs` is the listener's own correction for devices that cannot report it (Bluetooth). */
export function outputLatencySeconds(ctx: LatencySource | null | undefined, nudgeMs = 0): number {
  const raw = ctx?.outputLatency && ctx.outputLatency > 0 ? ctx.outputLatency : ctx?.baseLatency ?? 0;
  const nudge = Number.isFinite(nudgeMs) ? nudgeMs : 0;
  return Math.min(1, Math.max(0, (Number.isFinite(raw) ? raw : 0) + nudge / 1000));
}

/** A little above the top tempo (200 BPM), in beats per second. */
const MAX_BEATS_PER_SECOND = 4;

export class BeatClock {
  private phase: number | null = null;
  private lastTarget = 0;
  private lastMs = 0;
  private lastRate = 0;
  /** `maxCorrection`: most beats per second the clock may speed up or slow down to close a gap. `gain`: how hard it pulls (per second). */
  constructor(private readonly maxCorrection = 0.5, private readonly gain = 3, private readonly snapBeats = 16) {}

  /** The beats to draw at `nowMs`, given the beats the model says there are (`target`). */
  update(target: number, nowMs: number): number {
    const dt = (nowMs - this.lastMs) / 1000;
    if (this.phase === null || dt <= 0 || dt > 2 || Math.abs(target - this.phase) > this.snapBeats) {
      // first frame, a paused tab, a clock that went backwards, or a gap too big to glide over: start from the target
      this.phase = target; this.lastTarget = target; this.lastMs = nowMs; this.lastRate = 0;
      return target;
    }
    // the target's own speed, in beats per second. The schema's top tempo is 200 BPM (3.34 beats/s) at quarter-note steps, so a faster
    // "speed" is a jump in the target (a state with another rate or a late join), not music: keep the last plausible speed instead.
    const raw = (target - this.lastTarget) / dt;
    const rate = raw >= 0 && raw <= MAX_BEATS_PER_SECOND ? raw : this.lastRate;
    this.lastRate = rate;
    const err = target - this.phase;
    const correction = Math.max(-this.maxCorrection, Math.min(this.maxCorrection, err * this.gain));
    this.phase += (rate + correction) * dt;
    this.lastTarget = target; this.lastMs = nowMs;
    return this.phase;
  }

  reset() { this.phase = null; }
}

/** Fraction of the current beat, 0 to 1. */
export const beatFraction = (beats: number) => beats - Math.floor(beats);
