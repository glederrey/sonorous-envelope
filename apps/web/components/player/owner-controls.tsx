"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REACTION_KINDS, REACTION_LABELS, type ReactionKind } from "@sonorous/shared";

const FADE_CHOICES: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: "300", label: "5 minutes", seconds: 300 }, { value: "900", label: "15 minutes", seconds: 900 },
  { value: "1800", label: "30 minutes", seconds: 1800 }, { value: "3600", label: "1 hour", seconds: 3600 },
  { value: "never", label: "Never", seconds: null },
];

/** For the owner only: reaction buttons (told to the model on its next call) and the "fade after" setting. */
export function OwnerControls({ supabase, sessionId }: { supabase: SupabaseClient; sessionId: string }) {
  const [owner, setOwner] = useState<{ id: string; raw: Record<string, unknown> } | null>(null);
  const [rest, setRest] = useState("900");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("sessions").select("owner_id,settings").eq("id", sessionId).maybeSingle();
      if (cancelled || !data || data.owner_id !== u.user.id) return;
      const raw = data.settings && typeof data.settings === "object" ? (data.settings as Record<string, unknown>) : {};
      setOwner({ id: u.user.id, raw });
      const r = raw.rest_after;
      setRest(r === null ? "never" : typeof r === "number" ? String(r) : "900");
    })();
    return () => { cancelled = true; };
  }, [supabase, sessionId]);
  if (!owner) return null;

  const react = async (kind: ReactionKind) => {
    if (busy) return;
    setBusy(true); setError("");
    const { error: e } = await supabase.from("reactions").insert({ session_id: sessionId, user_id: owner.id, kind });
    if (e) setError("Could not send that. Try again."); else setSent(REACTION_LABELS[kind]);
    setTimeout(() => setBusy(false), 1000); // a second between presses, so a reaction is a signal and not a flood
    setTimeout(() => setSent(null), 2500);
  };
  const setFade = async (value: string) => {
    setRest(value);
    const seconds = FADE_CHOICES.find((c) => c.value === value)?.seconds ?? null;
    const raw = { ...owner.raw, rest_after: seconds };
    const { error: e } = await supabase.from("sessions").update({ settings: raw }).eq("id", sessionId);
    if (e) setError("Could not save that. Try again."); else setOwner({ ...owner, raw });
  };

  return (
    <div className="pl-owner se-sm">
      <p className="pl-owner-title">How is it landing? <span aria-live="polite">{sent ? `Sent: ${sent}` : ""}</span></p>
      <div className="pl-reactions" role="group" aria-label="Reactions the model will hear about">
        {REACTION_KINDS.map((k) => (
          <button key={k} type="button" className="se-btn pl-react" disabled={busy} onClick={() => void react(k)}>{REACTION_LABELS[k]}</button>
        ))}
      </div>
      <label className="pl-fade">
        <span>Fade to silence after</span>
        <select value={rest} onChange={(e) => void setFade(e.target.value)}>
          {FADE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <p className="pl-local">No update from the model for this long, and the sound fades. The model can change it too.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
