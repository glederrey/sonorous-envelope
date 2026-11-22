"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUEST_EMOJIS, GUEST_EMOJI_KEYS, type GuestEmoji } from "@sonorous/shared";
import { deviceId } from "../../lib/device-id";

/** How long the row waits after a press: the server lets one device press once every 2 s. */
const COOLDOWN_MS = 2000;

/** The "React" row for everyone who is not the owner (#152): emojis the owner's player floats over the picture and the AI hears about as
 *  counts. Always shown, in every mode. The pressed emoji also floats once on this screen (`onSent`). */
export function GuestReact({ supabase, sessionId, onSent }: { supabase: SupabaseClient; sessionId: string; onSent: (emoji: GuestEmoji) => void }) {
  const [wait, setWait] = useState(false);
  const [slow, setSlow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const press = async (emoji: GuestEmoji) => {
    setWait(true);
    timers.current.push(setTimeout(() => setWait(false), COOLDOWN_MS));
    onSent(emoji);
    const { data } = await supabase.rpc("send_emoji", { p_session: sessionId, p_device: deviceId(), p_emoji: emoji });
    if ((data as { ok?: boolean; reason?: string } | null)?.reason === "slow_down") {
      setSlow(true);
      timers.current.push(setTimeout(() => setSlow(false), 3000));
    }
  };
  return (
    <div className="pl-owner se-sm pl-guest">
      <p className="pl-owner-title">React</p>
      <div className="pl-emoji-row" role="group" aria-label="Send a reaction">
        {GUEST_EMOJI_KEYS.map((k) => (
          <button key={k} type="button" className="se-btn pl-emoji-btn" disabled={wait} aria-label={GUEST_EMOJIS[k].label} title={GUEST_EMOJIS[k].label} onClick={() => void press(k)}>
            <span aria-hidden>{GUEST_EMOJIS[k].glyph}</span>
          </button>
        ))}
      </div>
      {slow && <p className="pl-local" role="status">Slow down a little.</p>}
    </div>
  );
}
