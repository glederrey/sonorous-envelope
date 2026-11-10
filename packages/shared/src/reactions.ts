// The owner's reaction buttons (player-ui.md) and how they are told to the model. They are information about how the sound
// landed, not commands: the model decides what to do with them.

export const REACTION_KINDS = ["calmer", "softer", "darker", "brighter", "slower", "faster", "more_of_this", "less_of_this"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_LABELS: Record<ReactionKind, string> = {
  calmer: "Calmer", softer: "Softer", darker: "Darker", brighter: "Brighter",
  slower: "Slower", faster: "Faster", more_of_this: "More of this", less_of_this: "Less of this",
};

const short = (s: number) => (s < 90 ? `${Math.max(1, Math.round(s))} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);

/** Reactions since the last call, as short lines for the feedback: "calmer x2, last 3 min ago". Repeats of a kind are folded.
 *  At most 8 lines. The same kind sent many times keeps its count. */
export function describeReactions(rows: Array<{ kind: string; created_at: string }>, nowMs: number): string[] {
  const by = new Map<string, { n: number; last: number }>();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime(), e = by.get(r.kind);
    by.set(r.kind, { n: (e?.n ?? 0) + 1, last: Math.max(e?.last ?? 0, t) });
  }
  return [...by.entries()].sort((a, b) => b[1].last - a[1].last).slice(0, 8)
    .map(([kind, v]) => `${kind.replaceAll("_", " ")}${v.n > 1 ? ` x${v.n}` : ""}, ${short(Math.max(0, (nowMs - v.last) / 1000))}`);
}
