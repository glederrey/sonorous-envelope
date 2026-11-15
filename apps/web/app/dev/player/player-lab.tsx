"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineState } from "@sonorous/engine";
import { moodToEngineState, nextGrid, stretchMood, type Mood } from "@sonorous/shared";
import { Player } from "../../../components/player/player";

// A stand-in for the Supabase client that serves the states this page writes, in the shape `player_poll` returns. The states are built the
// way service.ts builds them (set_sound, strudel_mode on and off, silence with end). Nothing leaves the page.

type Row = { id: string; effective: EngineState; seed: number; turn: number; final: boolean; created_at: string };
type Scene = NonNullable<EngineState["colour"]["scene"]>;

const MOOD: Mood = { warmth: 0.5, closeness: 0.6, joy: 0.6, calm: 0.6, spontaneity: 0.5, tension: 0 };
const CODE = `stack(
  s("bd*2 [~ bd] sd:3").bank("RolandTR909"),
  s("hh*8").gain(0.4),
  note("<c2 g2 eb2 bb1>").s("sawtooth").lpf(500)
).pianoroll()`;

class Script {
  rows: Row[] = [];
  ended = false;
  nudge: (() => void) | null = null;
  private turn = 0;
  get last() { return this.rows[this.rows.length - 1] ?? null; }
  push(e: EngineState, ended = false) {
    const now = Date.now(), prev = this.last;
    e.grid = nextGrid(prev ? { effective: prev.effective, created_at: prev.created_at } : null, now, e);
    this.rows.push({ id: `lab-${this.rows.length}`, effective: e, seed: 77, turn: ++this.turn, final: true, created_at: new Date(now).toISOString() });
    this.ended = ended;
    this.nudge?.();
  }
  client(): SupabaseClient {
    const chain = (): unknown => {
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, is: () => c, in: () => c, order: () => c, limit: () => c, update: () => c, insert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
      };
      return c;
    };
    const rpc = async (name: string, args: { p_known?: string | null }) => {
      if (name !== "player_poll") return { data: null, error: null };
      const v = `${this.rows.length}:${this.ended}`;
      if (args.p_known === v) return { data: { same: true }, error: null };
      return { data: { v, now: new Date().toISOString(), mode: "external", mode_policy: "auto", allow_code: true, settings: { rest_after: null }, ended: this.ended, state: this.last }, error: null };
    };
    const channel = () => {
      const ch = { on: (_t: string, _f: unknown, cb: () => void) => { this.nudge = cb; return ch; }, subscribe: () => ch };
      return ch;
    };
    return { auth: { getUser: async () => ({ data: { user: null } }) }, from: chain, rpc, channel, removeChannel: async () => {} } as unknown as SupabaseClient;
  }
}

const copy = (e: EngineState): EngineState => JSON.parse(JSON.stringify(e));
/** set_sound: the mapped mood with a scene, the colour the tester knows (green, hue about 88) */
function synth(scene: Scene, time: number): EngineState {
  const e = moodToEngineState(stretchMood(MOOD), stretchMood(MOOD), 1);
  e.colour = { ...e.colour, h: 88, s: 0.35, l: 0.2, scene };
  e.transition = { time, curve: "smooth" };
  return e;
}

export function PlayerLab() {
  const [gen, setGen] = useState(0);
  const script = useMemo(() => { void gen; return new Script(); }, [gen]);
  const client = useMemo(() => script.client(), [script]);
  const [log, setLog] = useState<string[]>([]);
  const [fadeIn, setFadeIn] = useState(1);
  const timers = useRef<number[]>([]);
  const note = (t: string) => setLog((l) => [...l.slice(-7), `${new Date().toLocaleTimeString()} ${t}`]);

  const setSound = (scene: Scene) => { script.push(synth(scene, fadeIn)); note(`set_sound ${scene} (transition ${fadeIn} s)`); };
  const strudelOn = () => {
    const base = script.last ? copy(script.last.effective) : synth("aurora", 2);
    base.engine = "strudel"; base.pattern = { code: CODE, bpm: 110 }; base.transition = { time: 2, curve: "smooth" };
    script.push(base); note("strudel_mode on");
  };
  // what strudel_mode off writes since v0.18.6 (service.ts): silent, no scene, the paused synth's other fields kept
  const strudelOff = () => {
    if (!script.last) return;
    const e = copy(script.last.effective);
    delete e.engine; delete e.pattern; e.volume = 0; e.colour = { ...e.colour, scene: "none" }; delete e.colour.sceneAuto; e.transition = { time: 2, curve: "smooth" };
    script.push(e); note("strudel_mode off");
  };
  // silence with end after a closing sound (service.ts): only the volume fades, after the closing sound's transition
  const silenceEnd = () => {
    if (!script.last) return;
    const e = copy(script.last.effective);
    delete e.engine; delete e.pattern; e.volume = 0;
    e.transition = { time: 6, curve: "smooth", delay: Math.max(0, script.last.effective.transition.time - (Date.now() - Date.parse(script.last.created_at)) / 1000) };
    script.push(e, true); note("silence end");
  };
  // `silence` (volume 0, the scene kept, 3 s), then a new scene after `s` seconds: the old scene must keep fading out, never come back
  const silenceThen = (s: number) => {
    clear();
    if (script.last) { const e = copy(script.last.effective); e.volume = 0; e.transition = { time: 3, curve: "smooth" }; script.push(e); note("silence (scene kept)"); }
    later(s, () => setSound("caustics"));
  };
  const later = (s: number, f: () => void) => { timers.current.push(window.setTimeout(f, s * 1000)); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const offThen = (s: number) => { clear(); strudelOff(); later(s, () => setSound("stars")); };
  const closing = () => { clear(); strudelOff(); later(3, () => setSound("waves")); later(9, silenceEnd); };
  const reset = () => { clear(); setLog([]); setGen((g) => g + 1); };

  const box: CSSProperties = { position: "fixed", top: 8, left: 8, zIndex: 20, maxWidth: 340,  padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.75)", color: "#eee", fontSize: 12 };
  const btn = "se-btn";
  return (
    <>
      <details open style={box} data-lab>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Player lab</summary>
        <span>Press Start listening first, then: Synth aurora, Strudel on, then a hand-over.</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <button type="button" className={btn} onClick={() => setSound("aurora")}>Synth aurora</button>
          <button type="button" className={btn} onClick={strudelOn}>Strudel on</button>
          <button type="button" className={btn} onClick={() => { clear(); strudelOff(); }}>Strudel off</button>
          <button type="button" className={btn} onClick={() => setSound("stars")}>set_sound stars</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[0.5, 1.5, 3, 8].map((s) => <button key={s} type="button" className={btn} onClick={() => offThen(s)}>Off, stars after {s} s</button>)}
          <button type="button" className={btn} onClick={() => { clear(); setSound("stars"); }}>Strudel straight to stars</button>
          <button type="button" className={btn} onClick={() => { clear(); setSound("fireflies"); }}>set_sound fireflies</button>
          {[0.5, 1.5, 3].map((s) => <button key={s} type="button" className={btn} onClick={() => silenceThen(s)}>Silence, caustics after {s} s</button>)}
          <button type="button" className={btn} onClick={closing}>Closing: off, waves at 3 s, end at 9 s</button>
          <button type="button" className={btn} onClick={reset}>Reset</button>
        </div>
        <label>set_sound transition <select value={fadeIn} onChange={(e) => setFadeIn(Number(e.target.value))}>{[0.5, 1, 2, 4].map((t) => <option key={t} value={t}>{t} s</option>)}</select></label>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
      </details>
      <Player key={gen} sessionId="lab" signedIn={false} client={client} />
    </>
  );
}
