"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Face, Policy } from "../../lib/mcp/modes";
import { OwnerControls, StrudelToggles } from "./owner-controls";

/** The middle of the controls: the owner's block (mode, Allow Strudel, Strudel visuals, reactions, settings), or for a listener the
 *  Strudel visuals button while a pattern plays, and under either the Strudel code panel. Shared by the player and /dev/controls. */
export function ControlsMiddle({ supabase, sessionId, signedIn, face, policy, onChanged, pattern, patternPlays, strudelVisuals, onStrudelVisuals, strudelCode, onStrudelCode, listeningUntil, clockOffset }: {
  supabase: SupabaseClient; sessionId: string; signedIn: boolean; face: Face; policy: Policy; onChanged: () => void;
  /** the code that plays now, when Strudel does */
  pattern: { code: string; bpm: number } | null;
  patternPlays: boolean; strudelVisuals: boolean; onStrudelVisuals: (v: boolean) => void;
  /** "Strudel code": the model's code over the picture (off: only its drawings) */
  strudelCode: boolean; onStrudelCode: (v: boolean) => void;
  /** live tuning: see OwnerControls */
  listeningUntil?: number | null; clockOffset?: number;
}) {
  void pattern; // the code playing is shown in the info card (`extra`), with what the model set and what the AI can see
  return signedIn
    ? <OwnerControls supabase={supabase} sessionId={sessionId} face={face} policy={policy} onChanged={onChanged} strudelVisuals={strudelVisuals} onStrudelVisuals={onStrudelVisuals} strudelCode={strudelCode} onStrudelCode={onStrudelCode} patternPlays={patternPlays} listeningUntil={listeningUntil} clockOffset={clockOffset} />
    : <>{patternPlays && <StrudelToggles visuals={{ on: strudelVisuals, set: onStrudelVisuals }} code={{ on: strudelCode, set: onStrudelCode }} />}</>;
}
