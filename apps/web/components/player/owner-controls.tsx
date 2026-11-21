"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FACES, MODE_HINT, MODE_LABEL, forListener, type Face, type Policy } from "../../lib/mcp/modes";
import { HEARD_KINDS, HEARD_LABELS, REACTION_KINDS, REACTION_LABELS, isHeard, type HeardKind, type ReactionKind } from "@sonorous/shared";

type Said = ReactionKind | HeardKind;
const LABEL: Record<Said, string> = { ...REACTION_LABELS, ...HEARD_LABELS };

const FADE_CHOICES: Array<{ value: string; label: string; seconds: number | null }> = [
  { value: "300", label: "5 minutes", seconds: 300 }, { value: "900", label: "15 minutes", seconds: 900 },
  { value: "1800", label: "30 minutes", seconds: 1800 }, { value: "3600", label: "1 hour", seconds: 3600 },
  { value: "never", label: "Never", seconds: null },
];

/** Opposites side by side; the last row is the like or dislike, not a direction. */
const REACTION_PAIRS: ReactionKind[][] = [["slower", "faster"], ["darker", "brighter"], ["calmer", "stormier"], ["softer", "harsher"], ["less_of_this", "more_of_this"]];

/** The Strudel buttons, in the style of Gradient and Scenes. "Allow Strudel" is the owner's (it is saved on the session); "Strudel visuals" is
 *  each listener's own (saved on the device): the code and its drawings instead of the scenes, while Strudel plays. */
export function StrudelToggles({ allow, visuals, code }: { allow?: { on: boolean; set: (v: boolean) => void }; visuals: { on: boolean; set: (v: boolean) => void }; code: { on: boolean; set: (v: boolean) => void } }) {
  return (
    <div className="pl-toggles">
      {allow && (
        <button type="button" className="se-btn pl-toggle" style={{ gridColumn: "1 / -1" }} aria-pressed={allow.on} onClick={() => allow.set(!allow.on)}
          title={`Strudel is live-coded music the model writes. It runs in a sandbox in your browser, in the ${MODE_LABEL.external} and ${MODE_LABEL.sandbox} modes only.`}>
          <span className="pl-check" aria-hidden />Allow Strudel
        </button>
      )}
      <button type="button" className="se-btn pl-toggle" aria-pressed={visuals.on} onClick={() => visuals.set(!visuals.on)}
        title="While Strudel plays: the code and what it draws, instead of the scenes.">
        <span className="pl-check" aria-hidden />Strudel visuals
      </button>
      <button type="button" className="se-btn pl-toggle" aria-pressed={code.on && visuals.on} disabled={!visuals.on} onClick={() => code.set(!code.on)}
        title="The model's code over the picture. Off leaves only what the code draws; the code stays readable under Strudel code below.">
        <span className="pl-check" aria-hidden />Strudel code
      </button>
    </div>
  );
}

const POLICIES: Array<{ value: Policy; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "The model may offer another mode, and switches only after you say yes" },
  ...FACES.map((f) => ({ value: f, label: MODE_LABEL[f], hint: `Locked: ${MODE_HINT[f]}` })),
];

/**
 * For the owner only. Reaction buttons, shown in the listener modes only (in the internal mode the sound is how the model feels,
 * and nobody steers that), and the "fade after" setting (the listener modes never fade, so it is hidden there).
 */
export function OwnerControls({ supabase, sessionId, face, policy, onChanged, afterFace, strudelVisuals, onStrudelVisuals, strudelCode, onStrudelCode, patternPlays, listeningUntil = null, clockOffset = 0 }: { supabase: SupabaseClient; sessionId: string; face: Face; policy: Policy; onChanged: () => void; afterFace?: ReactNode; strudelVisuals: boolean; onStrudelVisuals: (v: boolean) => void; strudelCode: boolean; onStrudelCode: (v: boolean) => void; /** a Strudel pattern plays here: a listener who is not the owner sees the visuals button only then */ patternPlays: boolean;
  /** live tuning: when the model's `listen` call stops waiting (the server's clock, ms since the epoch; null when it does not wait), and the server's clock minus this device's */ listeningUntil?: number | null; clockOffset?: number }) {
  const [owner, setOwner] = useState<{ id: string; raw: Record<string, unknown> } | null>(null);
  const [rest, setRest] = useState("900");
  const [pending, setPending] = useState<Array<{ kind: Said }>>([]);
  const [error, setError] = useState("");
  const [allowCode, setAllowCode] = useState(true);
  const [, setSecond] = useState(0);
  const listening = listeningUntil !== null && listeningUntil > Date.now() + clockOffset; // the model is inside `listen` now

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from("reactions").select("kind").eq("session_id", sessionId).is("delivered_at", null)
      .in("kind", [...REACTION_KINDS, ...HEARD_KINDS] as string[]);
    if (data) setPending(data as Array<{ kind: Said }>);
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
    return () => { cancelled = true; };
  }, [supabase, sessionId, loadPending]);
  // a reaction disappears from the list once the model has read it; while the model waits for presses it reads them within seconds
  useEffect(() => {
    const timer = setInterval(() => void loadPending(), listening ? 2_000 : 15_000);
    return () => clearInterval(timer);
  }, [loadPending, listening]);
  // the countdown of the line under the buttons
  useEffect(() => {
    if (listeningUntil === null) return;
    const timer = setInterval(() => setSecond((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [listeningUntil]);
  if (!owner) return <>{patternPlays && <StrudelToggles visuals={{ on: strudelVisuals, set: onStrudelVisuals }} code={{ on: strudelCode, set: onStrudelCode }} />}{afterFace}</>; // not the owner: no controls, but the visuals button and the code are still for everyone

  const listener = forListener(face);
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

  const react = async (kind: Said) => {
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

  const live = owner.raw.live === true;
  const setLive = async (value: boolean) => {
    setError("");
    const raw = { ...owner.raw, live: value };
    setOwner({ ...owner, raw });
    const { error: e } = await supabase.from("sessions").update({ settings: raw }).eq("id", sessionId);
    if (e) { setOwner(owner); setError("Could not save that. Try again."); }
  };
  const seeing = owner.raw.image_feedback !== "off"; // on_request is the default
  const setSeeing = async (value: boolean) => {
    setError("");
    const raw = { ...owner.raw, image_feedback: value ? "on_request" : "off" };
    setOwner({ ...owner, raw });
    const { error: e } = await supabase.from("sessions").update({ settings: raw }).eq("id", sessionId);
    if (e) { setOwner(owner); setError("Could not save that. Try again."); }
  };
  const secondsLeft = listening ? Math.max(1, Math.ceil((listeningUntil! - Date.now() - clockOffset) / 1000)) : 0;

  const counts = new Map<Said, number>();
  for (const p of pending) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  const waitingOf = (heard: boolean) => [...counts].filter(([k]) => isHeard(k) === heard).map(([k, n]) => `${LABEL[k].toLowerCase()}${n > 1 ? ` ×${n}` : ""}`).join(", ");
  const waiting = waitingOf(false), heardWaiting = waitingOf(true);
  return (
    <>
      <div className="pl-owner se-sm">
        <p className="pl-owner-title">Mode</p>
        <div className="pl-seg" role="radiogroup" aria-label="Which mode the sound is in">
          {POLICIES.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={policy === o.value} title={o.hint} className="se-btn pl-seg-btn" data-active={face === o.value ? "true" : undefined} onClick={() => void choose(o.value)}>
              {o.label}{face === o.value && <span className="se-visually-hidden"> (playing now)</span>}
            </button>
          ))}
        </div>
        <p className="pl-local">{POLICIES.find((o) => o.value === policy)?.hint}.</p>
      </div>
      <StrudelToggles allow={{ on: allowCode, set: (v) => void chooseCode(v) }} visuals={{ on: strudelVisuals, set: onStrudelVisuals }} code={{ on: strudelCode, set: onStrudelCode }} />
      <p className="pl-local se-sm">The model may play live code. Visuals show it instead of the scenes.</p>
      {afterFace}
      {listener && (
        <details className="pl-set se-sm">
          <summary>Guide the sound</summary>
          <div className="pl-reactions" role="group" aria-label="Reactions the model will hear about">
            {REACTION_PAIRS.flat().map((k) => (
              <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{REACTION_LABELS[k]}</button>
            ))}
          </div>
          <div className="pl-toggles">
            <button type="button" className="se-btn pl-toggle" style={{ gridColumn: "1 / -1" }} aria-pressed={live} onClick={() => void setLive(!live)}
              title="After each answer the AI waits about 20 s for your presses and answers each at once; every press gives it 20 s more. While it waits the chat shows it working: press stop to type at once.">
              <span className="pl-check" aria-hidden />Live tuning
            </button>
          </div>
          <p className="pl-local" aria-live="polite">
            {listening ? <>The AI is listening: your presses reach it now<span aria-hidden>{` (${secondsLeft} s)`}</span>.{waiting ? ` Sent: ${waiting}.` : ""}</>
              : live ? "Live tuning is on: the AI listens after its next answer."
              : waiting ? `Waiting for the AI: ${waiting}. It reads them on its next message.` : "The model reads these on its next message, then changes the sound."}
          </p>
          {error && <p role="alert">{error}</p>}
        </details>
      )}
      <details className="pl-set se-sm">
        <summary>What I heard</summary>
        <p className="pl-local" style={{ marginTop: 10 }}>Tell the model how the sound reads to you. In every mode; it does not steer the sound.</p>
        <div className="pl-reactions" role="group" aria-label="What you heard, told to the model">
          {HEARD_KINDS.map((k) => (
            <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{HEARD_LABELS[k]}</button>
          ))}
        </div>
        <p className="pl-local" aria-live="polite">
          {heardWaiting ? `Waiting for the AI: ${heardWaiting}. It reads them on its next message.` : "The model reads this on its next message and compares it with what it meant."}
        </p>
        {error && <p role="alert">{error}</p>}
      </details>
      <details className="pl-set se-sm">
        <summary>Settings</summary>
        {!listener && (
          <div className="pl-setting">
            <div>
              <label htmlFor="pl-fade" className="pl-setting-name">Fade to silence after</label>
              <p className="pl-local">With no update from the model for this long, the sound fades. The model can change it too.</p>
            </div>
            <select id="pl-fade" value={rest} onChange={(e) => void setFade(e.target.value)}>
              {FADE_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div className="pl-toggles">
          <button type="button" className="se-btn pl-toggle" style={{ gridColumn: "1 / -1" }} aria-pressed={seeing} onClick={() => void setSeeing(!seeing)}
            title="The AI can ask for a small picture of what you see and of the last 8 s of sound, taken by this player. Nothing from your camera or microphone.">
            <span className="pl-check" aria-hidden />Let the AI see the picture
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </details>
    </>
  );
}
