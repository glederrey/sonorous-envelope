"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Face, Policy } from "../../lib/mcp/modes";
import { OwnerControls, StrudelToggles } from "./owner-controls";
import { StrudelPanel } from "./strudel-panel";

/** The middle of the controls: the owner's block (mode, Allow Strudel, Strudel visuals, reactions, settings), or for a listener the
 *  Strudel visuals button while a pattern plays, and under either the Strudel code panel. Shared by the player and /dev/controls. */
export function ControlsMiddle({ supabase, sessionId, signedIn, face, policy, onChanged, pattern, patternPlays, strudelVisuals, onStrudelVisuals }: {
  supabase: SupabaseClient; sessionId: string; signedIn: boolean; face: Face; policy: Policy; onChanged: () => void;
  /** the code that plays now, when Strudel does */
  pattern: { code: string; bpm: number } | null;
  patternPlays: boolean; strudelVisuals: boolean; onStrudelVisuals: (v: boolean) => void;
}) {
  const code = pattern ? <StrudelPanel code={pattern.code} bpm={pattern.bpm} /> : null;
  // the code sits right under the Mode block for the owner, and on its own for a listener
  return signedIn
    ? <OwnerControls supabase={supabase} sessionId={sessionId} face={face} policy={policy} onChanged={onChanged} afterFace={code} strudelVisuals={strudelVisuals} onStrudelVisuals={onStrudelVisuals} patternPlays={patternPlays} />
    : <>{patternPlays && <StrudelToggles visuals={{ on: strudelVisuals, set: onStrudelVisuals }} />}{code}</>;
}
