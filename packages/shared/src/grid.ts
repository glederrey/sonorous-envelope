import { arpRamp, glideSeconds, rampCount, tempoAt, type EngineState } from "@sonorous/engine";

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
export function nextGrid(prev: { effective: EngineState; created_at: string } | null, atMs: number, next?: Pick<EngineState, "transition">): NonNullable<EngineState["grid"]> {
  if (!prev) return { arp: 0, bass: 0 };
  const g = prev.effective.grid ?? { arp: 0, bass: 0 };
  // a state with a delay (the closing fade) starts later, but its steps are those of the layers it copies, so use its creation time
  const dt = Math.max(0, (atMs - new Date(prev.created_at).getTime()) / 1000);
  const d = stepSecondsOf(prev.effective);
  // the arpeggio's tempo may still be gliding (arpRamp); `fromTempo` is what plays at this moment, for the next glide to start from
  return { arp: g.arp + rampCount(arpRamp(prev.effective), dt), bass: g.bass + dt / d.bass, fromTempo: Math.round(tempoAt(prev.effective, dt) * 100) / 100, ...(next ? { glide: glideSeconds(next.transition) } : {}) };
}
