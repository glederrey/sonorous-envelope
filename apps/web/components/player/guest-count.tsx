"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUEST_EMOJIS, GUEST_EMOJI_KEYS, isGuestEmoji, type GuestEmoji } from "@sonorous/shared";

const WINDOW_MS = 30 * 60_000;
const REFRESH_MS = 30_000;
const DEBOUNCE_MS = 1500;

/** For the owner: what listeners pressed in the last 30 min, "Listeners: ❤️ 3 · 👍 1". Reads the table through RLS (the owner's only).
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
  return (
    <p className="pl-local pl-guest-count" aria-live="off">
      Listeners: {counts.map(([k, n]) => <span key={k} title={GUEST_EMOJIS[k].label}>{GUEST_EMOJIS[k].glyph} {n}</span>).reduce<ReactNode[]>((a, x, i) => (i ? [...a, " · ", x] : [x]), [])}
    </p>
  );
}
