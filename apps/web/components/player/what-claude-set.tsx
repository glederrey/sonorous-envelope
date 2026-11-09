"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeSet, type SetRow } from "../../lib/what-claude-set";

/** For signed-in members only: RLS lets a member read the session's states, a listener with just the link gets nothing. */
export function WhatClaudeSet({ supabase, sessionId, stateAt }: { supabase: SupabaseClient; sessionId: string; stateAt: number }) {
  const [row, setRow] = useState<SetRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("states").select("turn,final,created_at,clamps,effective,intent")
        .eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1);
      if (!cancelled && data?.[0]) setRow(data[0] as SetRow);
    })();
    return () => { cancelled = true; };
  }, [supabase, sessionId, stateAt]);
  if (!row) return null;
  const d = describeSet(row);
  return (
    <details className="pl-set se-sm">
      <summary>What the model set</summary>
      <dl>
        <dt>Mood sent</dt>
        <dd>{d.mood.map((m) => `${m.axis} ${m.value}`).join(" · ")}</dd>
        <dt>Playing</dt>
        <dd>{d.silence ? "Silence" : d.sound}</dd>
        <dt>Colour</dt>
        <dd>{d.colour}</dd>
        {d.overridden.length > 0 && (<><dt>Set by hand</dt><dd>{d.overridden.join(", ")}</dd></>)}
        {d.clamps.length > 0 && (<><dt>Changed by a safety rule</dt><dd>{d.clamps.join(", ")}</dd></>)}
        {d.note && (<><dt>Its note</dt><dd>{d.note}</dd></>)}
      </dl>
    </details>
  );
}
