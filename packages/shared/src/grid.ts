import type { EngineState } from "@sonorous/engine";

// The shared timeline (roadmap #34): every state carries the step counters of the arpeggio and the bass layer at the moment
// it was written, in steps counted from the start of the session. With the state's creation time (server clock) a device
// knows where each step is, so devices playing together land on the same notes at the same moments.

const RATE_BEATS = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 } as const;

/** Step length of each layer, in seconds, for a state. No glide: it follows the state's own tempo. */
export function stepSecondsOf(s: Pick<EngineState, "arp" | "bass">) {
  return { arp: (60 / Math.max(20, s.arp.tempo)) * RATE_BEATS[s.arp.rate], bass: Math.max(0.2, s.bass.stepSeconds) };
}

/** The counters for a state written at `atMs`, given the previous state (its counters, step lengths and creation time). */
export function nextGrid(prev: { effective: EngineState; created_at: string } | null, atMs: number): { arp: number; bass: number } {
  if (!prev) return { arp: 0, bass: 0 };
  const g = prev.effective.grid ?? { arp: 0, bass: 0 };
  // a state with a delay (the closing fade) starts later, but its steps are those of the layers it copies, so use its creation time
  const dt = Math.max(0, (atMs - new Date(prev.created_at).getTime()) / 1000);
  const d = stepSecondsOf(prev.effective);
  return { arp: g.arp + dt / d.arp, bass: g.bass + dt / d.bass };
}
