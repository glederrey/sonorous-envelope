"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const REFRESH_MS = 10_000;

interface Seen { image: string | null; seen_image: string | null; seen_at: string | null; taken_at: string | null; off: boolean }

/** "12 s", "3 min", "2 h" */
function ago(iso: string | null, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso ?? "")) / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`;
}

/** The owner sees the picture and sound the model was given by inspect("snapshot"), and when. Nothing renders for anyone else. */
export function WhatAiSaw({ supabase, sessionId }: { supabase: SupabaseClient; sessionId: string }) {
  const [owner, setOwner] = useState(false);
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<Seen | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase.from("sessions").select("owner_id").eq("id", sessionId).maybeSingle();
        if (!cancelled) setOwner(Boolean(data) && data!.owner_id === u.user.id);
      } catch { /* not the owner as far as we can tell */ }
    })();
    return () => { cancelled = true; };
  }, [supabase, sessionId]);

  // load when opened, then every 10 s while open
  useEffect(() => {
    if (!owner || !open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [{ data: snap }, { data: ses }] = await Promise.all([
          supabase.from("snapshots").select("image,seen_image,seen_at,taken_at").eq("session_id", sessionId).maybeSingle(),
          supabase.from("sessions").select("settings").eq("id", sessionId).maybeSingle(),
        ]);
        if (cancelled) return;
        const settings = ses?.settings && typeof ses.settings === "object" ? (ses.settings as Record<string, unknown>) : {};
        setRow({ image: snap?.image ?? null, seen_image: snap?.seen_image ?? null, seen_at: snap?.seen_at ?? null, taken_at: snap?.taken_at ?? null, off: settings.image_feedback === "off" });
        setNow(Date.now());
      } catch { /* keep what is shown */ }
    };
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [supabase, sessionId, owner, open]);

  // the relative times keep counting between loads
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!owner) return null;
  const alt = "What the AI saw: the picture on top, the sound of the last seconds below";
  const media = { width: "100%", display: "block", borderRadius: 8, marginTop: 10 } as const;
  return (
    <details className="pl-set se-sm" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>What the AI saw</summary>
      {row?.seen_image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.seen_image} alt={alt} style={media} />
          <p style={{ margin: "10px 0 0" }}>The AI looked at this {ago(row.seen_at, now)} ago.</p>
          <p style={{ margin: "4px 0 0", opacity: 0.7 }}>Below the picture: the last seconds of sound, low notes at the bottom; the white line is where its latest sound began.</p>
        </>
      ) : row?.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.image} alt={alt} style={media} />
          <p style={{ margin: "10px 0 0" }}>The latest picture the AI can ask for, taken {ago(row.taken_at, now)} ago. It has not looked yet.</p>
        </>
      ) : row ? (
        <p style={{ margin: "10px 0 0" }}>{row.off ? "Turned off under Settings." : "Nothing yet: the player takes a picture a few seconds after each new sound, while this page is open and playing."}</p>
      ) : null}
    </details>
  );
}
