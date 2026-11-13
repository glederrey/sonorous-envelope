"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { EngineState } from "@sonorous/engine";
import { moodToEngineState, nextGrid, stretchMood, SCENES, type Mood } from "@sonorous/shared";
import { SAMPLES, stateOfStep } from "../../../lib/samples";
import { VisualCanvas } from "../../../components/player/visual-canvas";

type Scene = "own" | "none" | (typeof SCENES)[number];

// The emotions, as the model would send them (the player stretches them before use). Acceptance: tell them apart with "No hue" on.
const EMOTIONS: Array<{ id: string; name: string; mood: Mood }> = [
  { id: "happy", name: "Happy", mood: { warmth: 0.7, closeness: 0.6, joy: 0.9, calm: 0.35, spontaneity: 0.6, tension: 0 } },
  { id: "excited", name: "Excited", mood: { warmth: 0.8, closeness: 0.6, joy: 0.95, calm: 0.1, spontaneity: 0.8, tension: 0.1 } },
  { id: "content", name: "Content", mood: { warmth: 0.75, closeness: 0.7, joy: 0.7, calm: 0.9, spontaneity: 0.3, tension: 0 } },
  { id: "playful", name: "Playful", mood: { warmth: 0.7, closeness: 0.6, joy: 0.85, calm: 0.4, spontaneity: 0.9, tension: 0 } },
  { id: "nostalgic", name: "Nostalgic", mood: { warmth: 0.8, closeness: 0.6, joy: 0.4, calm: 0.5, spontaneity: 0.4, tension: 0 } },
  { id: "pensive", name: "Pensive", mood: { warmth: 0.3, closeness: 0.6, joy: 0.45, calm: 0.65, spontaneity: 0.3, tension: 0 } },
  { id: "dreamy", name: "Dreamy", mood: { warmth: 0.3, closeness: 0.5, joy: 0.6, calm: 0.7, spontaneity: 0.75, tension: 0 } },
  { id: "eager", name: "Eager", mood: { warmth: 0.5, closeness: 0.2, joy: 0.62, calm: 0.3, spontaneity: 0.6, tension: 0.1 } },
  { id: "cold-anger", name: "Cold anger", mood: { warmth: 0.1, closeness: 0.3, joy: 0.12, calm: 0.12, spontaneity: 0.6, tension: 0.85 } },
  { id: "dread", name: "Dread", mood: { warmth: 0.3, closeness: 0.4, joy: 0.15, calm: 0.65, spontaneity: 0.3, tension: 0.75 } },
  { id: "serene", name: "Serene", mood: { warmth: 0.5, closeness: 0.2, joy: 0.5, calm: 0.9, spontaneity: 0.2, tension: 0 } },
  { id: "hopeful", name: "Hopeful", mood: { warmth: 0.7, closeness: 0.5, joy: 0.75, calm: 0.6, spontaneity: 0.4, tension: 0 } },
  { id: "free", name: "Free", mood: { warmth: 0.5, closeness: 0.3, joy: 0.75, calm: 0.55, spontaneity: 0.5, tension: 0 } },
  { id: "peaceful", name: "Peaceful", mood: { warmth: 0.5, closeness: 0.6, joy: 0.5, calm: 0.9, spontaneity: 0.2, tension: 0 } },
  { id: "brooding", name: "Brooding", mood: { warmth: 0.4, closeness: 0.4, joy: 0.25, calm: 0.6, spontaneity: 0.3, tension: 0.35 } },
  { id: "analytical", name: "Analytical", mood: { warmth: 0.2, closeness: 0.3, joy: 0.5, calm: 0.6, spontaneity: 0.15, tension: 0.1 } },
  { id: "alert", name: "Alert", mood: { warmth: 0.2, closeness: 0.3, joy: 0.45, calm: 0.35, spontaneity: 0.4, tension: 0.5 } },
  { id: "driven", name: "Driven", mood: { warmth: 0.2, closeness: 0.3, joy: 0.7, calm: 0.3, spontaneity: 0.3, tension: 0.1 } },
  { id: "determined", name: "Determined", mood: { warmth: 0.4, closeness: 0.4, joy: 0.55, calm: 0.5, spontaneity: 0.2, tension: 0.4 } },
  { id: "restless", name: "Restless", mood: { warmth: 0.5, closeness: 0.4, joy: 0.45, calm: 0.45, spontaneity: 0.95, tension: 0.1 } },
  { id: "longing", name: "Longing", mood: { warmth: 0.7, closeness: 0.15, joy: 0.35, calm: 0.5, spontaneity: 0.3, tension: 0 } },
  { id: "curious", name: "Curious", mood: { warmth: 0.45, closeness: 0.7, joy: 0.55, calm: 0.55, spontaneity: 0.45, tension: 0.1 } },
  { id: "tender", name: "Tender", mood: { warmth: 0.9, closeness: 0.9, joy: 0.6, calm: 0.75, spontaneity: 0.3, tension: 0 } },
  { id: "awe", name: "Awe", mood: { warmth: 0.5, closeness: 0.1, joy: 0.8, calm: 0.9, spontaneity: 0.3, tension: 0 } },
  { id: "sad", name: "Sad", mood: { warmth: 0.3, closeness: 0.4, joy: 0.12, calm: 0.75, spontaneity: 0.2, tension: 0.05 } },
  { id: "melancholic", name: "Melancholic", mood: { warmth: 0.7, closeness: 0.7, joy: 0.25, calm: 0.8, spontaneity: 0.3, tension: 0.05 } },
  { id: "lonely", name: "Lonely", mood: { warmth: 0.2, closeness: 0.1, joy: 0.15, calm: 0.85, spontaneity: 0.2, tension: 0 } },
  { id: "anxious", name: "Anxious", mood: { warmth: 0.5, closeness: 0.4, joy: 0.5, calm: 0.25, spontaneity: 0.6, tension: 0.55 } },
  { id: "angry", name: "Angry", mood: { warmth: 0.35, closeness: 0.4, joy: 0.1, calm: 0.12, spontaneity: 0.6, tension: 0.9 } },
];
type Sync = "own" | "beat" | "phrase" | "free";

/** What the `silence` tool writes (service.ts): the same state with the volume 0, the layers off, a fade, and the grid carried on from the state before. */
function silentOf(prev: EngineState, prevAt: number, now: number): EngineState {
  const e: EngineState = JSON.parse(JSON.stringify(prev));
  e.volume = 0; delete e.engine; delete e.pattern; e.drone.on = false; e.bass.on = false; e.arp.on = false; e.transition = { time: 8, curve: "smooth" };
  e.grid = nextGrid({ effective: prev, created_at: new Date(prevAt).toISOString() }, now, e);
  return e;
}

export function VisualsLab() {
  const [bpm, setBpm] = useState(100);
  const [set, setSet] = useState<"emotions" | "samples" | "gradients">("emotions");
  const [play, setPlay] = useState(true);
  const [scene, setScene] = useState<Scene>("own");
  const [sync, setSync] = useState<Sync>("own");
  const [own, setOwn] = useState(true);
  const [grey, setGrey] = useState(false);
  const [silentAt, setSilentAt] = useState<number | null>(null); // the picture after a `silence` call, written the way the server writes it (same grid logic)
  const [only, setOnly] = useState("all"); // one panel, large, to judge a single canvas (the grid runs up to 25 at once)
  const [epoch, setEpoch] = useState(() => Date.now());
  const clock = useRef(0);
  const latency = useRef(() => 0).current;

  const panels = useMemo(() => (set === "samples" ? SAMPLES.map((s) => ({ id: s.id, name: s.name, seed: s.seed, state: stateOfStep(s.steps[0], s.id) }))
    : EMOTIONS.map((e) => { const m = stretchMood(e.mood); return { id: e.id, name: e.name, seed: 4242 + 977 * EMOTIONS.indexOf(e), state: moodToEngineState(m, m, 1) }; })).map((s) => {
    const state: EngineState = s.state;
    if (set === "gradients") state.colour = { ...state.colour, scene: "none" };
    if (!own || set === "gradients") { state.arp.tempo = bpm; state.arp.rate = "1/4"; }
    state.grid = { arp: 0, bass: 0, beat: 0 };
    if (scene !== "own" && set !== "gradients") state.colour = { ...state.colour, scene };
    if (sync !== "own") state.colour = { ...state.colour, sync };
    return { id: s.id, name: s.name, seed: s.seed, state };
  }), [bpm, scene, sync, set, own]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
      {/* in the player the canvas fills the visible field; here the field is a card, so the canvas takes the card's height */}
      <style>{".lab-field { overflow: hidden !important; scrollbar-width: none; } .lab-field::-webkit-scrollbar { display: none; } .lab-field > .pl-motion { height: 100%; position: static; }"}</style>
      <h1 style={{ margin: 0 }}>Visuals lab</h1>
      <p className="se-sm" style={{ margin: 0 }}>{set === "gradients" ? "Gradients: each emotion's moving colours with no scene. The lights take one to two minutes for an orbit at 100 BPM, so raise Tempo (the tempo slider applies automatically here) to see them move. Tick Colour play off to compare with the plain gradient. " : ""}Emotions as pictures (or the five landing samples). Same canvas and frame model as the player; tempo and scene are overridden here. The large-element flash cap is lifted (2026-11-13).</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label>Set <select value={set} onChange={(e) => { setSet(e.target.value as "emotions" | "samples" | "gradients"); setOnly("all"); setEpoch(Date.now()); }}><option>emotions</option><option>gradients</option><option>samples</option></select></label>
        <label><input type="checkbox" checked={own} onChange={(e) => { setOwn(e.target.checked); setEpoch(Date.now()); }} /> Mood's own tempo</label>
        <label>Tempo <input type="range" min={30} max={200} value={bpm} onChange={(e) => { setBpm(Number(e.target.value)); setEpoch(Date.now()); }} /> {bpm} BPM</label>
        <label>Scene <select value={scene} onChange={(e) => setScene(e.target.value as Scene)}>
          {(["own", "none", ...SCENES] as const).map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Sync <select value={sync} onChange={(e) => setSync(e.target.value as Sync)}>
          {(["own", "beat", "phrase", "free"] as const).map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Show <select value={only} onChange={(e) => { setOnly(e.target.value); setEpoch(Date.now()); }}>
          <option value="all">all</option>{panels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <button type="button" onClick={() => setSilentAt((v) => (v ? null : Date.now()))}>{silentAt ? "Back to sound" : "Silence (8 s fade)"}</button>
        <label><input type="checkbox" checked={play} onChange={(e) => setPlay(e.target.checked)} /> Colour play</label>
        <label><input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} /> No hue (grey)</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: only !== "all" ? "minmax(0, 720px)" : `repeat(auto-fit, minmax(${set === "gradients" ? 330 : 240}px, 1fr))`, gap: 12, filter: grey ? "grayscale(1)" : undefined }}>
        {panels.filter((p) => only === "all" || p.id === only).map((p) => {
          const c = p.state.colour;
          const style = {
            height: only !== "all" ? 560 : set === "gradients" ? 380 : 280, borderRadius: 12,
            "--pl-h": c.h, "--pl-s": c.s, "--pl-l": c.l, "--pl-h2": c.secondary?.h ?? c.h + 25, "--pl-s2": c.secondary?.s ?? c.s, "--pl-l2": c.secondary?.l ?? Math.max(0, c.l - 0.08),
          } as CSSProperties;
          return (
            <figure key={p.id} style={{ margin: 0 }}>
              <div className="pl-field lab-field" style={{ ...style, position: "relative" }} data-motion="still" data-texture={c.texture} data-shape={c.shape ?? "wash"}>
                <VisualCanvas source={silentAt ? { state: silentOf(p.state, epoch, silentAt), at: silentAt, seed: p.seed } : { state: p.state, at: epoch, seed: p.seed }} clockOffset={clock} latency={latency} active play={play} onFail={() => {}} />
                <div aria-hidden style={{ position: "absolute", inset: 0, background: "#000", borderRadius: 12, pointerEvents: "none", zIndex: 1, opacity: silentAt ? 1 : 0, transition: silentAt ? "opacity 8s ease-in-out" : "none" }} />
              </div>
              <figcaption className="se-sm">{p.name} · {c.scene ?? "none"} · {c.sync ?? "mood"}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
