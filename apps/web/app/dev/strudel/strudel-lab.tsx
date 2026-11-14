"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AudioOutput } from "../../../components/player/audio";
import { VizStore } from "../../../lib/strudel/viz";
import type { StrudelOutput } from "../../../lib/strudel/output";
import { StrudelToggles } from "../../../components/player/owner-controls";

const StrudelView = dynamic(() => import("../../../components/player/strudel-view").then((m) => m.StrudelView), { ssr: false });

const PRESETS: Record<string, string> = {
  "Code only": `// a small groove
stack(
  s("bd*2 [~ bd] sd:3").bank("RolandTR909"),
  s("hh*8").gain(0.4),
  note("<c2 g2 eb2 bb1>").s("sawtooth").lpf(500)
)`,
  "Pianoroll": `$: note("c4 eb4 g4 <bb4 d5>").s("sine").color("cyan").pianoroll({ labels: 1 })
$: note("<c2 g2>*2").s("sawtooth").lpf(400).color("magenta")`,
  "Scope": `stack(
  note("c3 e3 g3 b3").s("sawtooth").lpf(900).gain(0.5),
  s("bd*2, hh*8").bank("RolandTR909")
).scope({ thickness: 4 })`,
  "Spiral + spectrum": `note("<c3 eb3 g3 bb3>*4").s("triangle").room(0.5).color("orange").spiral({ steady: 0.96 })
  .spectrum()`,
  "Pitchwheel": `note("<c3 e3 g3 b3 d4>*3").s("triangle").color("hotpink").pitchwheel()`,
  "Inline lanes": `stack(
  s("bd sd, hh*4").bank("RolandTR909"),
  note("<c3 g3>*2").s("sine")
)._pianoroll({ labels: 1 })._scope()`,
};

export function StrudelLab() {
  const [name, setName] = useState("Pianoroll");
  const [code, setCode] = useState(PRESETS.Pianoroll);
  const [bpm, setBpm] = useState(100);
  const [hue, setHue] = useState(220);
  const [started, setStarted] = useState(false);
  const [allow, setAllow] = useState(true), [visuals, setVisuals] = useState(true); // the two buttons of the player, here only to look at
  const [report, setReport] = useState("");
  const store = useMemo(() => new VizStore(), []);
  useEffect(() => { (window as unknown as { __viz: VizStore; __op: { current: number }; __lv: { current: number } }).__viz = store; (window as unknown as { __op: unknown }).__op = opacity; (window as unknown as { __lv: unknown }).__lv = level; }, [store]); // for the headless check
  const level = useRef(1), beats = useRef(0), opacity = useRef(0);
  const audio = useRef<AudioOutput | null>(null), out = useRef<StrudelOutput | null>(null);
  const t0 = useRef(0), bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const tick = () => { beats.current = ((performance.now() - t0.current) / 1000) * (bpmRef.current / 60); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);
  useEffect(() => () => { out.current?.close(); void audio.current?.close(); }, []);

  async function play() {
    if (!audio.current) {
      const a = await AudioOutput.start();
      a.setGain(0.5);
      audio.current = a; t0.current = performance.now();
      const { StrudelOutput } = await import("../../../lib/strudel/output");
      out.current = new StrudelOutput(a.context, a.strudelBus, {
        cycleNow: () => beats.current / 4, latency: () => a.latency, viz: store,
        onReport: (_id, r) => setReport(JSON.stringify(r)),
      });
      setStarted(true);
    }
    await out.current?.play({ id: null, code, bpm, seed: 1 });
  }

  return (
    <div className="pl-field" style={{ "--pl-h": hue, "--pl-t": "1s" } as React.CSSProperties}>
      {started && <StrudelView store={store} output={() => out.current} level={level} beats={beats} shown={visuals} opacity={opacity} hue={hue} />}
      <main className="pl-stage">
        <section className="pl-panel" aria-label="Strudel lab">
          <div className="pl-toggles" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {Object.keys(PRESETS).map((k) => (
              <button key={k} type="button" className="se-btn pl-toggle" aria-pressed={name === k} onClick={() => { setName(k); setCode(PRESETS[k]); }}>{k}</button>
            ))}
          </div>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={6} spellCheck={false} aria-label="Strudel code" style={{ fontFamily: "var(--font-mono)", fontSize: 13, width: "100%" }} />
          <StrudelToggles allow={{ on: allow, set: setAllow }} visuals={{ on: visuals, set: setVisuals }} />
          <label className="pl-slider"><span>Tempo</span><input type="range" min={60} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /><output>{bpm}</output></label>
          <label className="pl-slider"><span>Hue</span><input type="range" min={0} max={360} value={hue} onChange={(e) => setHue(Number(e.target.value))} /><output>{hue}</output></label>
          <button type="button" className="se-btn se-btn-primary pl-mute" onClick={() => void play()}>{started ? "Play this code" : "Start and play"}</button>
          <p className="pl-local se-sm" role="status">{report}</p>
        </section>
      </main>
    </div>
  );
}
