"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { EngineState } from "@sonorous/engine";
import { SAMPLES, stateOfStep } from "../../../lib/samples";
import { VisualCanvas } from "../../../components/player/visual-canvas";

type Scene = "own" | "none" | "motes" | "ripples" | "rain";
type Sync = "own" | "beat" | "phrase" | "free";

export function VisualsLab() {
  const [bpm, setBpm] = useState(100);
  const [scene, setScene] = useState<Scene>("own");
  const [sync, setSync] = useState<Sync>("own");
  const [grey, setGrey] = useState(false);
  const [epoch, setEpoch] = useState(() => Date.now());
  const clock = useRef(0);
  const latency = useRef(() => 0).current;

  const panels = useMemo(() => SAMPLES.map((s) => {
    const state: EngineState = stateOfStep(s.steps[0], s.id);
    state.arp.tempo = bpm; state.arp.rate = "1/4"; state.grid = { arp: 0, bass: 0, beat: 0 };
    if (scene !== "own") state.colour = { ...state.colour, scene };
    if (sync !== "own") state.colour = { ...state.colour, sync };
    return { id: s.id, name: s.name, seed: s.seed, state };
  }), [bpm, scene, sync]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Visuals lab</h1>
      <p className="se-sm" style={{ margin: 0 }}>The five landing emotions as pictures. Same canvas and frame model as the player; tempo and scene are overridden here. The pulse stays under the flash limit at every tempo.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label>Tempo <input type="range" min={30} max={200} value={bpm} onChange={(e) => { setBpm(Number(e.target.value)); setEpoch(Date.now()); }} /> {bpm} BPM</label>
        <label>Scene <select value={scene} onChange={(e) => { setScene(e.target.value as Scene); setEpoch(Date.now()); }}>
          {(["own", "none", "motes", "ripples", "rain"] as const).map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Sync <select value={sync} onChange={(e) => { setSync(e.target.value as Sync); setEpoch(Date.now()); }}>
          {(["own", "beat", "phrase", "free"] as const).map((x) => <option key={x}>{x}</option>)}</select></label>
        <label><input type="checkbox" checked={grey} onChange={(e) => setGrey(e.target.checked)} /> No hue (grey)</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, filter: grey ? "grayscale(1)" : undefined }}>
        {panels.map((p) => {
          const c = p.state.colour;
          const style = {
            height: 280, borderRadius: 12,
            "--pl-h": c.h, "--pl-s": c.s, "--pl-l": c.l, "--pl-h2": c.secondary?.h ?? c.h + 25, "--pl-s2": c.secondary?.s ?? c.s, "--pl-l2": c.secondary?.l ?? Math.max(0, c.l - 0.08),
          } as CSSProperties;
          return (
            <figure key={p.id} style={{ margin: 0 }}>
              <div className="pl-field" style={style} data-motion="still" data-texture={c.texture} data-shape={c.shape ?? "wash"}>
                <VisualCanvas source={{ state: p.state, at: epoch, seed: p.seed }} clockOffset={clock} latency={latency} active onFail={() => {}} />
              </div>
              <figcaption className="se-sm">{p.name} · {c.scene ?? "none"} · {c.sync ?? "mood"}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
