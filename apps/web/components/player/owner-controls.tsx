"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Face, Policy } from "../../lib/mcp/modes";
import { Maximize2 } from "lucide-react";
import { REACTION_KINDS, REACTION_LABELS, type ReactionKind } from "@sonorous/shared";

const FADE_CHOICES: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: "300", label: "5 minutes", seconds: 300 }, { value: "900", label: "15 minutes", seconds: 900 },
  { value: "1800", label: "30 minutes", seconds: 1800 }, { value: "3600", label: "1 hour", seconds: 3600 },
  { value: "never", label: "Never", seconds: null },
];

/** Opposites side by side; the last row is the like or dislike, not a direction. */
const REACTION_PAIRS: ReactionKind[][] = [["slower", "faster"], ["darker", "brighter"], ["calmer", "stormier"], ["softer", "harsher"], ["less_of_this", "more_of_this"]];

/** The Strudel buttons, in the style of Gradient and Scenes. "Allow Strudel" is the owner's (it is saved on the session); "Strudel visuals" is
 *  each listener's own (saved on the device): the code and its drawings instead of the scenes, while Strudel plays. */
export function StrudelToggles({ allow, visuals, fullscreen }: { allow?: { on: boolean; set: (v: boolean) => void }; visuals?: { on: boolean; set: (v: boolean) => void }; fullscreen: () => void }) {
  return (
    <div className="pl-toggles pl-toggles-strudel" data-count={(allow ? 1 : 0) + (visuals ? 1 : 0) + 1}>
      {allow && (
        <button type="button" className="se-btn pl-toggle" aria-pressed={allow.on} onClick={() => allow.set(!allow.on)}
          title="Strudel is live-coded music the model writes. It runs in a sandbox in your browser, on the external face only.">
          <span className="pl-check" aria-hidden />Allow Strudel
        </button>
      )}
      {visuals && (
        <button type="button" className="se-btn pl-toggle" aria-pressed={visuals.on} onClick={() => visuals.set(!visuals.on)}
          title="While Strudel plays: the code and what it draws, instead of the scenes.">
          <span className="pl-check" aria-hidden />Strudel visuals
        </button>
      )}
      <button type="button" className="se-btn pl-toggle pl-full-btn" onClick={fullscreen} title="Only the picture: no header, controls or footer. Esc or a tap on the picture brings them back.">
        <Maximize2 size={16} aria-hidden />Fullscreen
      </button>
    </div>
  );
}

const POLICIES: Array<{ value: Policy; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "The model chooses its face, and says so when it switches" },
  { value: "internal", label: "Internal", hint: "Locked: the sound stays the model's own state" },
  { value: "external", label: "External", hint: "Locked: the sound is made for you, and you can steer it" },
];

/**
 * For the owner only. Reaction buttons, shown in the external face only (the internal face is how the model feels, and
 * nobody steers that), and the "fade after" setting (the external face never fades, so it is hidden there).
 */
export function OwnerControls({ supabase, sessionId, face, policy, onChanged, afterFace, strudelVisuals, onStrudelVisuals, patternPlays, onFullscreen }: { supabase: SupabaseClient; sessionId: string; face: Face; policy: Policy; onChanged: () => void; afterFace?: ReactNode; strudelVisuals: boolean; onStrudelVisuals: (v: boolean) => void; /** a Strudel pattern plays here: a listener who is not the owner sees the visuals button only then */ patternPlays: boolean; onFullscreen: () => void }) {
  const [owner, setOwner] = useState<{ id: string; raw: Record<string, unknown> } | null>(null);
  const [rest, setRest] = useState("900");
  const [pending, setPending] = useState<Array<{ kind: ReactionKind }>>([]);
  const [error, setError] = useState("");
  const [allowCode, setAllowCode] = useState(true);

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
      const { data } = await supabase.from("sessions").select("owner_id,settings,allow_code").eq("id", sessionId).maybeSingle();
      if (cancelled || !data || data.owner_id !== u.user.id) return;
      const raw = data.settings && typeof data.settings === "object" ? (data.settings as Record<string, unknown>) : {};
      setOwner({ id: u.user.id, raw });
      setAllowCode(data.allow_code !== false);
      const r = raw.rest_after;
      setRest(r === null ? "never" : typeof r === "number" ? String(r) : "900");
      void loadPending();
    })();
    const timer = setInterval(() => void loadPending(), 15_000); // a reaction disappears from the list once the model has read it
    return () => { cancelled = true; clearInterval(timer); };
  }, [supabase, sessionId, loadPending]);
  if (!owner) return <><StrudelToggles visuals={patternPlays ? { on: strudelVisuals, set: onStrudelVisuals } : undefined} fullscreen={onFullscreen} />{afterFace}</>; // not the owner: no controls, but the visuals button and the code are still for everyone

  const external = face === "external";
  const choose = async (value: Policy) => {
    setError("");
    const { error: e } = await supabase.rpc("set_mode_policy", { p_session: sessionId, p_policy: value });
    if (e) setError("Could not change that. Try again."); else onChanged();
  };

  const chooseCode = async (value: boolean) => {
    setError(""); setAllowCode(value);
    const { error: e } = await supabase.rpc("set_allow_code", { p_session: sessionId, p_allow: value });
    if (e) { setAllowCode(!value); setError("Could not change that. Try again."); } else onChanged();
  };

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
      <div className="pl-owner se-sm">
        <p className="pl-owner-title">Face</p>
        <div className="pl-seg" role="radiogroup" aria-label="Which face the sound has">
          {POLICIES.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={policy === o.value} title={o.hint} className="se-btn pl-seg-btn" onClick={() => void choose(o.value)}>{o.label}</button>
          ))}
        </div>
        <p className="pl-local">{POLICIES.find((o) => o.value === policy)?.hint}.</p>
      </div>
      <StrudelToggles allow={{ on: allowCode, set: (v) => void chooseCode(v) }} visuals={{ on: strudelVisuals, set: onStrudelVisuals }} fullscreen={onFullscreen} />
      <p className="pl-local se-sm">Allow Strudel lets the model play live code. Strudel visuals shows its code and drawings instead of the scenes.</p>
      {afterFace}
      {external && (
        <details className="pl-set se-sm">
          <summary>How is it landing?</summary>
          <div className="pl-reactions" role="group" aria-label="Reactions the model will hear about">
            {REACTION_PAIRS.flat().map((k) => (
              <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{REACTION_LABELS[k]}</button>
            ))}
          </div>
          <p className="pl-local" aria-live="polite">
            {waiting ? `Waiting for Claude: ${waiting}. It reads them on its next message.` : "The model reads these on its next message, then changes the sound."}
          </p>
          {error && <p role="alert">{error}</p>}
        </details>
      )}
      {!external && (
        <details className="pl-set se-sm">
          <summary>Settings</summary>
          <div className="pl-setting">
            <div>
              <label htmlFor="pl-fade" className="pl-setting-name">Fade to silence after</label>
              <p className="pl-local">With no update from the model for this long, the sound fades. The model can change it too.</p>
            </div>
            <select id="pl-fade" value={rest} onChange={(e) => void setFade(e.target.value)}>
              {FADE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {error && <p role="alert">{error}</p>}
        </details>
      )}
    </>
  );
}
