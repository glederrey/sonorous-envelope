// The emoji reactions of people listening by the link who are not the owner (#152). One list for the buttons, the floating glyphs and
// the text the model reads. The SQL check on public.emoji_reactions.emoji (migration 0028) lists the same keys: change both together.

export const GUEST_EMOJIS = {
  thumbs_up: { glyph: "👍", label: "thumbs up" },
  thumbs_down: { glyph: "👎", label: "thumbs down" },
  heart: { glyph: "❤️", label: "heart" },
  happy: { glyph: "😊", label: "happy" },
  unhappy: { glyph: "🙁", label: "unhappy" },
  sad: { glyph: "😢", label: "sad" },
  crying: { glyph: "😭", label: "crying" },
} as const;
export type GuestEmoji = keyof typeof GUEST_EMOJIS;
export const GUEST_EMOJI_KEYS = Object.keys(GUEST_EMOJIS) as GuestEmoji[];
export const isGuestEmoji = (k: string): k is GuestEmoji => Object.hasOwn(GUEST_EMOJIS, k);

/** Guest presses as one short line for the feedback: "❤️ 3 · 👍 1, over the last 4 min". Counts only, most frequent first (ties in the order
 *  of the set). The span runs from the oldest press, at least 1 min. Undefined when there is nothing. */
export function describeEmojis(rows: Array<{ emoji: string; created_at: string }>, nowMs: number): string | undefined {
  const n = new Map<GuestEmoji, number>();
  let oldest = nowMs;
  for (const r of rows) {
    if (!isGuestEmoji(r.emoji)) continue;
    n.set(r.emoji, (n.get(r.emoji) ?? 0) + 1);
    oldest = Math.min(oldest, new Date(r.created_at).getTime());
  }
  if (!n.size) return undefined;
  const order = (k: GuestEmoji) => GUEST_EMOJI_KEYS.indexOf(k);
  const parts = [...n.entries()].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0])).map(([k, c]) => `${GUEST_EMOJIS[k].glyph} ${c}`);
  const min = Math.max(1, Math.round((nowMs - oldest) / 60_000));
  return `${parts.join(" · ")}, over the last ${min} min`;
}
