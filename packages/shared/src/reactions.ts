// The owner's reaction buttons (player-ui.md) and how they are told to the model. They are information about how the sound
// landed, not commands: the model decides what to do with them.

export const REACTION_KINDS = ["calmer", "softer", "darker", "brighter", "slower", "faster", "stormier", "harsher", "more_of_this", "less_of_this"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_LABELS: Record<ReactionKind, string> = {
  calmer: "Calmer", softer: "Softer", darker: "Darker", brighter: "Brighter",
  slower: "Slower", faster: "Faster", stormier: "Stormier", harsher: "Harsher", more_of_this: "More of this", less_of_this: "Less of this",
};

/** "What I heard" (#129): how the sound read to the listener, in every mode. Information for the model, never steering, so it is
 *  returned in its own `heard` field and also in Self. Stored as reactions with these kinds (migration 0018). */
export const HEARD_KINDS = ["heard_calm", "heard_tender", "heard_warm", "heard_joyful", "heard_playful", "heard_hesitant", "heard_sad", "heard_tense", "heard_anxious", "heard_reproach"] as const;
export type HeardKind = (typeof HEARD_KINDS)[number];
export const HEARD_LABELS: Record<HeardKind, string> = {
  heard_calm: "Calm", heard_tender: "Tender", heard_warm: "Warm", heard_joyful: "Joyful", heard_playful: "Playful",
  heard_hesitant: "Hesitant", heard_sad: "Sad", heard_tense: "Tense", heard_anxious: "Anxious", heard_reproach: "Blaming", // "Reproach" was unclear to the tester (v0.22.0); the stored kind stays
};
/** How a press reads to the model: More/Less of this always ask for an audible change (tester report v0.22.0: "more of this" read as
 *  "keep it" changed nothing), and a heard kind uses the word on its button. */
const SAID: Record<string, string> = {
  more_of_this: "more of this (go further in the direction of your last change)",
  less_of_this: "less of this (take back part of your last change)",
  heard_reproach: "blaming",
};
export const isHeard = (kind: string): boolean => kind.startsWith("heard_");

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
    .map(([kind, v]) => `${SAID[kind] ?? (isHeard(kind) ? kind.slice(6) : kind).replaceAll("_", " ")}${v.n > 1 ? ` x${v.n}` : ""}, ${short(Math.max(0, (nowMs - v.last) / 1000))}`);
}
