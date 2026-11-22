"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUEST_EMOJIS, GUEST_EMOJI_KEYS, isGuestEmoji, type GuestEmoji } from "@sonorous/shared";

const WINDOW_MS = 30 * 60_000;
const REFRESH_MS = 30_000;
const DEBOUNCE_MS = 1500;

/** For the owner: what guests pressed in the last 30 min, as a card of its own with one tile per emoji (big glyph, count under it).
 *  A tile pops when its count goes up (its key carries the count, so it mounts again). Reads the table through RLS (the owner's only).
 *  `nudge` changes on each emoji broadcast: the count is read again a moment later, so a burst is one read. Hidden when there is nothing. */
export function GuestCount({ supabase, sessionId, nudge }: { supabase: SupabaseClient; sessionId: string; nudge: number }) {
  const [counts, setCounts] = useState<Array<[GuestEmoji, number]>>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data } = await supabase.from("emoji_reactions").select("emoji").eq("session_id", sessionId).gte("created_at", since).limit(1000);
      if (cancelled || !data) return;
      const n = new Map<GuestEmoji, number>();
      for (const r of data as Array<{ emoji: string }>) if (isGuestEmoji(r.emoji)) n.set(r.emoji, (n.get(r.emoji) ?? 0) + 1);
      setCounts(GUEST_EMOJI_KEYS.filter((k) => n.has(k)).map((k): [GuestEmoji, number] => [k, n.get(k) as number]).sort((a, b) => b[1] - a[1])); // most pressed first, ties in the order of the set
    };
    const first = setTimeout(() => void load(), nudge === 0 ? 0 : DEBOUNCE_MS);
    const every = setInterval(() => void load(), REFRESH_MS);
    return () => { cancelled = true; clearTimeout(first); clearInterval(every); };
  }, [supabase, sessionId, nudge]);
  if (!counts.length) return null;
  const total = counts.reduce((s, [, n]) => s + n, 0);
  return (
    <section className="pl-reacts" aria-label="Guest reactions">
      <p className="pl-reacts-title"><span>Guest reactions</span><span className="pl-reacts-when">{total} in the last 30 min</span></p>
      <ul className="pl-reacts-grid">
        {counts.map(([k, n]) => (
          <li key={`${k}-${n}`} className="pl-react-tile" title={`${GUEST_EMOJIS[k].label}: ${n}`}>
            <span className="pl-react-glyph" aria-hidden>{GUEST_EMOJIS[k].glyph}</span>
            <span className="pl-react-n"><span className="se-visually-hidden">{GUEST_EMOJIS[k].label} </span>{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
