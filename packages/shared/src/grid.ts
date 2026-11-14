import { arpRamp, beatsAt, glideSeconds, rampCount, tempoAt, type EngineState } from "@sonorous/engine";

// The shared timeline (roadmap #34): every state carries the step counters of the arpeggio and the bass layer at the moment
// it was written, in steps counted from the start of the session. With the state's creation time (server clock) a device
// knows where each step is, so devices playing together land on the same notes at the same moments.

const RATE_BEATS = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 } as const;

/** Step length of each layer, in seconds, for a state once its tempo glide is over. */
export function stepSecondsOf(s: Pick<EngineState, "arp" | "bass">) {
  return { arp: (60 / Math.max(20, s.arp.tempo)) * RATE_BEATS[s.arp.rate], bass: Math.max(0.2, s.bass.stepSeconds) };
}

/** The counters for a state written at `atMs`, given the previous state (its counters, step lengths and creation time). `next` is
 *  the state being written: its transition says how long the tempo glides from the tempo that plays now. */
export function nextGrid(prev: { effective: EngineState; created_at: string } | null, atMs: number, next?: Pick<EngineState, "transition"> & { arp?: Pick<EngineState["arp"], "rate"> }): NonNullable<EngineState["grid"]> {
  if (!prev) return { arp: 0, bass: 0, beat: 0 };
  const g = prev.effective.grid ?? { arp: 0, bass: 0 };
  // a state with a delay (the closing fade) starts later, but its steps are those of the layers it copies, so use its creation time
  const dt = Math.max(0, (atMs - new Date(prev.created_at).getTime()) / 1000);
  const d = stepSecondsOf(prev.effective);
  // the arpeggio's tempo may still be gliding (arpRamp); `fromTempo` is what plays at this moment, for the next glide to start from
  const arp = g.arp + rampCount(arpRamp(prev.effective), dt);
  // The state starts at a fractional step, and its notes fire when the step counter crosses an integer. For those notes to land on the
  // beat the counter and the beat must agree: `beat - arp * R` is a whole number of steps (R = beats per step of the NEW state's rate).
  // Without this a rate change leaves the picture's beat a fixed fraction of a step away from the notes for the rest of the session.
  const R = RATE_BEATS[next?.arp?.rate ?? prev.effective.arp.rate];
  // After a Strudel state the beat is Strudel's own (the paused synth's step counter has nothing to do with it): snapping it to the synth's
  // steps would move the picture's beat, and the bar Strudel's clock is taken from, by up to half a step at every state written.
  const strudelBefore = prev.effective.engine === "strudel" && Boolean(prev.effective.pattern);
  const beat = strudelBefore ? beatsAt(prev.effective, dt) : arp * R + R * Math.round((beatsAt(prev.effective, dt) - arp * R) / R);
  // A delayed state (the closing fade) starts later, while the state before it is still gliding its tempo. Its beats must carry on along that glide, or the picture's beat jumps
  // by the difference when the delayed state takes over (the scenes were redrawn at the end of a session): so it inherits what is left of the glide.
  const delayed = (next?.transition.delay ?? 0) > 0, left = Math.max(0, (g.glide ?? 0) - dt);
  return { arp, beat, bass: g.bass + dt / d.bass, fromTempo: Math.round(tempoAt(prev.effective, dt) * 100) / 100, ...(next ? { glide: delayed ? (left >= 0.5 ? Math.round(left * 100) / 100 : 0) : glideSeconds(next.transition) } : {}) };
}
