"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { REACTION_KINDS, REACTION_LABELS, type ReactionKind } from "@sonorous/shared";

const FADE_CHOICES: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: "300", label: "5 minutes", seconds: 300 }, { value: "900", label: "15 minutes", seconds: 900 },
  { value: "1800", label: "30 minutes", seconds: 1800 }, { value: "3600", label: "1 hour", seconds: 3600 },
  { value: "never", label: "Never", seconds: null },
];

/** The external face: the sound is for the listener, so their reactions may steer it. (Older sessions say "outer".) */
export const isExternal = (mode: string | null | undefined) => mode === "external" || mode === "outer";

/**
 * For the owner only. Reaction buttons, shown in the external face only (the internal face is how the model feels, and
 * nobody steers that), and the "fade after" setting (the external face never fades, so it is hidden there).
 */
export function OwnerControls({ supabase, sessionId }: { supabase: SupabaseClient; sessionId: string }) {
  const [owner, setOwner] = useState<{ id: string; raw: Record<string, unknown>; mode: string } | null>(null);
  const [rest, setRest] = useState("900");
  const [pending, setPending] = useState<Array<{ kind: ReactionKind }>>([]);
  const [error, setError] = useState("");

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from("reactions").select("kind").eq("session_id", sessionId).is("delivered_at", null)
      .in("kind", REACTION_KINDS as unknown as string[]);
    if (data) setPending(data as Array<{ kind: ReactionKind }>);
  }, [supabase, sessionId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("sessions").select("owner_id,settings,mode").eq("id", sessionId).maybeSingle();
      if (cancelled || !data || data.owner_id !== u.user.id) return;
      const raw = data.settings && typeof data.settings === "object" ? (data.settings as Record<string, unknown>) : {};
      setOwner({ id: u.user.id, raw, mode: String(data.mode ?? "inner") });
      const r = raw.rest_after;
      setRest(r === null ? "never" : typeof r === "number" ? String(r) : "900");
      void loadPending();
    })();
    const timer = setInterval(() => void loadPending(), 15_000); // a reaction disappears from the list once the model has read it
    return () => { cancelled = true; clearInterval(timer); };
  }, [supabase, sessionId, loadPending]);
  if (!owner) return null;

  const external = isExternal(owner.mode);

  const react = async (kind: ReactionKind) => {
    setError("");
    setPending((p) => [...p, { kind }]); // shown at once; every press counts, none is swallowed
    const { error: e } = await supabase.from("reactions").insert({ session_id: sessionId, user_id: owner.id, kind });
    if (e) { setError("Could not send that. Try again."); void loadPending(); }
  };
  const setFade = async (value: string) => {
    setRest(value);
    const seconds = FADE_CHOICES.find((c) => c.value === value)?.seconds ?? null;
    const raw = { ...owner.raw, rest_after: seconds };
    const { error: e } = await supabase.from("sessions").update({ settings: raw }).eq("id", sessionId);
    if (e) setError("Could not save that. Try again."); else setOwner({ ...owner, raw });
  };

  const counts = new Map<ReactionKind, number>();
  for (const p of pending) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  const waiting = [...counts].map(([k, n]) => `${REACTION_LABELS[k].toLowerCase()}${n > 1 ? ` ×${n}` : ""}`).join(", ");
  return (
    <>
      {external && (
        <div className="pl-owner se-sm">
          <p className="pl-owner-title">How is it landing?</p>
          <div className="pl-reactions" role="group" aria-label="Reactions the model will hear about">
            {REACTION_KINDS.map((k) => (
              <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{REACTION_LABELS[k]}</button>
            ))}
          </div>
          <p className="pl-local" aria-live="polite">
            {waiting ? `Waiting for Claude: ${waiting}. It reads them on its next message.` : "The model reads these on its next message, then changes the sound."}
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {!external && (
        <details className="pl-set se-sm">
          <summary>Settings</summary>
          <label className="pl-fade">
            <span>Fade to silence after</span>
            <select value={rest} onChange={(e) => void setFade(e.target.value)}>
              {FADE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <p className="pl-local">With no update from the model for this long, the sound fades. The model can change it too.</p>
          {error && <p role="alert">{error}</p>}
        </details>
      )}
    </>
  );
}
