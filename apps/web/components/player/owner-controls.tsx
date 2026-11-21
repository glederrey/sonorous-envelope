"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FACES, MODE_HINT, MODE_LABEL, forListener, type Face, type Policy } from "../../lib/mcp/modes";
import { HEARD_KINDS, HEARD_LABELS, REACTION_KINDS, REACTION_LABELS, isHeard, type HeardKind, type ReactionKind } from "@sonorous/shared";

type Said = ReactionKind | HeardKind;
const LABEL: Record<Said, string> = { ...REACTION_LABELS, ...HEARD_LABELS };

/** Opposites side by side; the last row is the like or dislike, not a direction. */
const REACTION_PAIRS: ReactionKind[][] = [["slower", "faster"], ["darker", "brighter"], ["calmer", "stormier"], ["softer", "harsher"], ["less_of_this", "more_of_this"]];

/** The Strudel buttons, in the style of Gradient and Scenes. "Allow Strudel" is the owner's (it is saved on the session); "Strudel visuals" is
 *  each listener's own (saved on the device): the code and its drawings instead of the scenes, while Strudel plays. */
export function StrudelToggles({ allow, visuals, code }: { allow?: { on: boolean; set: (v: boolean) => void }; visuals: { on: boolean; set: (v: boolean) => void }; code: { on: boolean; set: (v: boolean) => void } }) {
  return (
    <div className="pl-toggles">
      {allow && (
        <button type="button" className="se-btn pl-toggle" style={{ gridColumn: "1 / -1" }} aria-pressed={allow.on} onClick={() => allow.set(!allow.on)}
          title={`Strudel is live-coded music the AI writes. It runs in a sandbox in your browser, in the ${MODE_LABEL.external} and ${MODE_LABEL.sandbox} modes only.`}>
          <span className="pl-check" aria-hidden />Allow Strudel
        </button>
      )}
      <button type="button" className="se-btn pl-toggle" aria-pressed={visuals.on} onClick={() => visuals.set(!visuals.on)}
        title="While Strudel plays: the code and what it draws, instead of the scenes.">
        <span className="pl-check" aria-hidden />Strudel visuals
      </button>
      <button type="button" className="se-btn pl-toggle" aria-pressed={code.on && visuals.on} disabled={!visuals.on} onClick={() => code.set(!code.on)}
        title="The AI's code over the picture. Off leaves only what the code draws; the code stays readable under “The code playing” below.">
        <span className="pl-check" aria-hidden />Strudel code
      </button>
    </div>
  );
}

const POLICIES: Array<{ value: Policy; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "The AI may offer another mode, and switches only after you say yes" },
  ...FACES.map((f) => ({ value: f, label: MODE_LABEL[f], hint: `Locked: ${MODE_HINT[f]}` })),
];

/**
 * For the owner only. Reaction buttons, shown in the listener modes only (in the internal mode the sound is how the model feels,
 * and nobody steers that). Nothing fades by itself (2026-11-21), so there is no "fade after" setting any more.
 */
export function OwnerControls({ picture, stateAt, supabase, sessionId, face, policy, onChanged, afterFace, strudelVisuals, onStrudelVisuals, strudelCode, onStrudelCode, patternPlays, listeningUntil = null, clockOffset = 0 }: { picture?: ReactNode; /** when the sound playing now was written: a new one may have read the presses */ stateAt?: number; supabase: SupabaseClient; sessionId: string; face: Face; policy: Policy; onChanged: () => void; afterFace?: ReactNode; strudelVisuals: boolean; onStrudelVisuals: (v: boolean) => void; strudelCode: boolean; onStrudelCode: (v: boolean) => void; /** a Strudel pattern plays here: a listener who is not the owner sees the visuals button only then */ patternPlays: boolean;
  /** live tuning: when the model's `listen` call stops waiting (the server's clock, ms since the epoch; null when it does not wait), and the server's clock minus this device's */ listeningUntil?: number | null; clockOffset?: number }) {
  const [owner, setOwner] = useState<{ id: string; raw: Record<string, unknown> } | null>(null);
  const [pending, setPending] = useState<Array<{ kind: Said }>>([]);
  const [error, setError] = useState("");
  const [allowCode, setAllowCode] = useState(true);
  const [, setSecond] = useState(0);
  const listening = listeningUntil !== null && listeningUntil > Date.now() + clockOffset; // the AI is inside `listen` now

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
      void loadPending();
    })();
    return () => { cancelled = true; };
  }, [supabase, sessionId, loadPending]);
  // a reaction disappears from the list once the model has read it; while the model waits for presses it reads them within seconds
  useEffect(() => {
    const timer = setInterval(() => void loadPending(), listening ? 2_000 : 15_000);
    return () => clearInterval(timer);
  }, [loadPending, listening]);
  // after a wait (tester report v0.22.0): a press made during it is being answered; a wait with no press ended, and presses now go
  // with the next message. Live tuning stays on: it is the listener's standing wish.
  const [afterWait, setAfterWait] = useState<"answering" | "idle" | null>(null);
  const pressedInWait = useRef(false), wasListening = useRef(false);
  useEffect(() => {
    if (listening) { wasListening.current = true; setAfterWait(null); return; }
    if (!wasListening.current) return;
    wasListening.current = false;
    const next = pressedInWait.current ? "answering" : "idle";
    pressedInWait.current = false;
    setAfterWait(next);
    if (next === "answering") { const t = setTimeout(() => setAfterWait("idle"), 60_000); return () => clearTimeout(t); } // it did not listen again
  }, [listening]);
  // a press the AI has read must leave the line at once (tester report v0.22.1): look again when a new sound arrives and when a wait starts or ends
  useEffect(() => { void loadPending(); }, [stateAt, listening, loadPending]);
  // the countdown of the line under the buttons
  useEffect(() => {
    if (listeningUntil === null) return;
    const timer = setInterval(() => setSecond((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [listeningUntil]);
  if (!owner) return <><details className="pl-set se-sm pl-group"><summary>Visuals</summary>{picture}{patternPlays && <StrudelToggles visuals={{ on: strudelVisuals, set: onStrudelVisuals }} code={{ on: strudelCode, set: onStrudelCode }} />}</details>{afterFace}</>; // not the owner: no controls, but the visuals button and the code are still for everyone

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
    if (listening) pressedInWait.current = true;
    const { error: e } = await supabase.from("reactions").insert({ session_id: sessionId, user_id: owner.id, kind });
    if (e) { setError("Could not send that. Try again."); void loadPending(); }
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
  const sent = [waiting, heardWaiting].filter(Boolean).join(", ");
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
      {/* closed by default: a new listener sees Mute, Volume and Mode, and opens the rest when they want to */}
      <details className="pl-set se-sm pl-group">
        <summary>Visuals and Strudel</summary>
        {picture}
        <StrudelToggles allow={{ on: allowCode, set: (v) => void chooseCode(v) }} visuals={{ on: strudelVisuals, set: onStrudelVisuals }} code={{ on: strudelCode, set: onStrudelCode }} />
        <p className="pl-local">The AI may play live code. Visuals show it instead of the scenes.</p>
      </details>
      {/* Feedback to the AI: everything here reaches the AI. Live tuning covers both blocks below (a press in either reaches it while it
          listens), in the listener modes only: in Self the AI never waits for presses. */}
      <details className="pl-set se-sm pl-group">
        <summary>Feedback to the AI</summary>
        {listener && <>
          <button type="button" className="se-btn pl-toggle" aria-pressed={live} onClick={() => void setLive(!live)}
            title="After each answer the AI waits about 20 s for your presses and answers each at once; every press gives it 20 s more. While it waits the chat shows it working: press stop to type at once.">
            <span className="pl-check" aria-hidden />Live tuning
          </button>
          <p className="pl-local" aria-live="polite" style={{ marginTop: 10 }}>
            {listening ? <>The AI is listening: your presses reach it now<span aria-hidden>{` (${secondsLeft} s)`}</span>.{sent ? ` Sent: ${sent}.` : ""}</>
              : live ? (afterWait === "answering" ? "The AI is answering your press…"
                : afterWait === "idle" ? `Not listening now: your presses reach the AI with your next message.${sent ? ` Sent: ${sent}.` : ""}`
                : "On: after each answer, the AI waits for your presses.")
              : "Off: your presses reach the AI with your next message."}
          </p>
        </>}
        <button type="button" className="se-btn pl-toggle" style={{ marginTop: listener ? 12 : 0 }} aria-pressed={seeing} onClick={() => void setSeeing(!seeing)}
          title="The AI can ask for a small picture of this player and a spectrogram of its last 10 s of sound output. Nothing from your camera or microphone.">
          <span className="pl-check" aria-hidden />Let the AI see the picture
        </button>
        <p className="pl-local" style={{ marginTop: 10 }}>The AI can ask for a small picture of this player and its last seconds of sound.</p>
        {error && <p role="alert">{error}</p>}
        {listener && (
          <details className="pl-set se-sm">
            <summary>Guide the sound</summary>
            <div className="pl-reactions" role="group" aria-label="Reactions the AI will hear about">
              {REACTION_PAIRS.flat().map((k) => (
                <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{REACTION_LABELS[k]}</button>
              ))}
            </div>
            {!live && (
              <p className="pl-local" aria-live="polite">
                {waiting ? `Waiting for the AI: ${waiting}. It reads them on its next message.` : "The AI reads these on its next message, then changes the sound."}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </details>
        )}
        <details className="pl-set se-sm">
          <summary>Tell the AI what you heard</summary>
          <p className="pl-local" style={{ marginTop: 10 }}>How does the sound read to you? The AI gets it as information, never as an order, in every mode.</p>
          <div className="pl-reactions" role="group" aria-label="What you heard, told to the AI">
            {HEARD_KINDS.map((k) => (
              <button key={k} type="button" className="se-btn pl-react" onClick={() => void react(k)}>{HEARD_LABELS[k]}</button>
            ))}
          </div>
          {!(listener && live) && (
            <p className="pl-local" aria-live="polite">
              {heardWaiting ? `Waiting for the AI: ${heardWaiting}. It reads them on its next message.` : "The AI reads this on its next message and compares it with what it meant."}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </details>
      </details>
    </>
  );
}
