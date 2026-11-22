"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GUEST_EMOJIS, isGuestEmoji } from "@sonorous/shared";

/** Emojis from listeners rise over the picture and fade (#152). At most `MAX_FLOATING` at once: more are dropped. */
export const MAX_FLOATING = 12;
const LIFE_MS = 3200; // a little more than the CSS animation, in case animationend never fires (hidden tab)

interface Floating { id: number; glyph: string; x: number }

/** `float(key)` starts one emoji; `layer` goes inside the player's stage. */
export function useEmojiFloat() {
  const [items, setItems] = useState<Floating[]>([]);
  const next = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => { const t = timers.current; return () => t.forEach(clearTimeout); }, []);
  const float = useCallback((key: string) => {
    if (!isGuestEmoji(key)) return;
    const id = next.current++;
    setItems((cur) => (cur.length >= MAX_FLOATING ? cur : [...cur, { id, glyph: GUEST_EMOJIS[key].glyph, x: 8 + Math.random() * 84 }]));
    const t = setTimeout(() => { timers.current.delete(t); setItems((cur) => cur.filter((i) => i.id !== id)); }, LIFE_MS);
    timers.current.add(t);
  }, []);
  const layer = (
    <div className="pl-emojis" aria-hidden>
      {items.map((i) => <span key={i.id} className="pl-emoji" style={{ left: `${i.x}%` }}>{i.glyph}</span>)}
    </div>
  );
  return { float, layer };
}
