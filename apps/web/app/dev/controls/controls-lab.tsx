"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ControlsPanel, WHEN_MIN_WIDTH } from "../../../components/player/controls-panel";
import { ControlsMiddle } from "../../../components/player/controls-middle";
import { CopyLink } from "../../../components/copy-link";
import { FACES, MODE_HINT, MODE_LABEL, forListener, type Face, type Policy } from "../../../lib/mcp/modes";
import { VisualCanvas } from "../../../components/player/visual-canvas";
import { SAMPLES, stateOfStep } from "../../../lib/samples";

// A stand-in for the Supabase client, only for what the owner's block asks of it: who is signed in, who owns the session, and answers
// that say "saved". Nothing leaves the page.
function fakeClient(ownerId: string): SupabaseClient {
  const done = { data: [], error: null };
  const chain = (table: string): unknown => {
    const c: Record<string, unknown> = {
      select: () => c, eq: () => c, is: () => c, in: () => c, update: () => c, insert: async () => ({ error: null }),
      maybeSingle: async () => ({ data: table === "sessions" ? { owner_id: ownerId, settings: { rest_after: 900 }, allow_code: true } : null, error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(done).then(ok),
    };
    return c;
  };
  return { auth: { getUser: async () => ({ data: { user: { id: "me" } } }) }, from: chain, rpc: async () => ({ error: null }) } as unknown as SupabaseClient;
}

const CODE = `stack(
  s("bd*2 [~ sd]").bank("RolandTR909"),
  note("<c2 g2>").s("sawtooth").lpf(400)
)`;

type Viewer = "owner" | "listener" | "guest";
// What sits behind the panel, to judge its opacity and blur: a plain colour, a live scene (the real canvas on a sample state), or code
type Behind = "plain" | "scene" | "code";
const BEHIND: Array<[Behind, string]> = [["plain", "Plain"], ["scene", "Scene"], ["code", "Code"]];
const SCENE_STATES = SAMPLES.map((s) => ({ id: s.id, name: s.name.split(",")[0], seed: s.seed, state: stateOfStep(s.steps[0], s.id) }));
const VIEWERS: Array<[Viewer, string]> = [["owner", "Owner"], ["listener", "Signed-in listener"], ["guest", "Guest (link)"]];

export function ControlsLab() {
  const [viewer, setViewer] = useState<Viewer>("owner");
  const [strudel, setStrudel] = useState(true);
  const [face, setFace] = useState<Face>("external");
  const [width, setWidth] = useState(390), [measured, setMeasured] = useState(0), [whenMin, setWhenMin] = useState(WHEN_MIN_WIDTH);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(0.8);
  const [gradientOn, setGradientOn] = useState(true), [visualsOn, setVisualsOn] = useState(true), [strudelVisuals, setStrudelVisuals] = useState(true), [strudelCode, setStrudelCode] = useState(true);
  const [note, setNote] = useState("");
  const [behind, setBehind] = useState<Behind>("scene"), [sample, setSample] = useState(SCENE_STATES[0].id);
  const [epoch] = useState(() => Date.now());
  const clock = useRef(0), latency = useRef(() => 0).current;
  const bg = SCENE_STATES.find((s) => s.id === sample) ?? SCENE_STATES[0];
  const [mounted, setMounted] = useState(false); // the link and QR buttons read the window: draw them on the client only
  useEffect(() => setMounted(true), []);
  const [policy, setPolicy] = useState<Policy>("auto");
  // an owner is someone whose id is the session's owner; a signed-in listener is someone else's
  const supabase = useMemo(() => fakeClient(viewer === "owner" ? "me" : "someone-else"), [viewer]);
  const playsPattern = strudel && forListener(face);

  const shareAction = viewer === "guest"
    ? <><a className="se-btn" href="/add">Add to your AI</a><CopyLink path="/s/demo" label="Copy link" /></>
    : <CopyLink path="/s/demo" label="Copy link" />;
  const shareText = viewer === "guest" ? "Want your AI to make sound for you too?" : "Anyone with the link can listen. Nobody else can change anything.";

  const pick = <T extends string>(items: Array<[T, string]>, value: T, set: (v: T) => void, label: string) => (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map(([v, text]) => <button key={v} type="button" role="radio" aria-checked={value === v} className="se-btn pl-seg-btn" onClick={() => set(v)}>{text}</button>)}
    </div>
  );

  return (
    <div style={{ "--pl-h": 140, "--pl-s": 0.35, "--pl-l": 0.16, minHeight: "calc(100dvh - var(--se-header-h) - var(--se-footer-h))", background: "hsl(140 35% 16%)", padding: 16, position: "relative", isolation: "isolate" } as CSSProperties}>
      <style>{".lab-bg { position: fixed !important; inset: 0; z-index: -1; overflow: hidden; height: auto !important; } .lab-bg > .pl-motion { position: absolute !important; inset: 0; width: 100% !important; height: 100% !important; } .lab-code { margin: 0; padding: 24px; font: 15px/1.5 var(--font-mono); color: hsl(160 80% 70%); white-space: pre; animation: lab-scroll 14s linear infinite; } @keyframes lab-scroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }"}</style>
      {mounted && behind === "scene" && (
        <div className="pl-field lab-bg" data-motion="still" data-canvas="on" data-shape={bg.state.colour.shape ?? "wash"}
          style={{ "--pl-h": bg.state.colour.h, "--pl-s": bg.state.colour.s, "--pl-l": bg.state.colour.l, "--pl-h2": bg.state.colour.secondary?.h ?? bg.state.colour.h + 25, "--pl-s2": bg.state.colour.secondary?.s ?? bg.state.colour.s, "--pl-l2": bg.state.colour.secondary?.l ?? Math.max(0, bg.state.colour.l - 0.08) } as CSSProperties}>
          <VisualCanvas source={{ state: bg.state, at: epoch, seed: bg.seed }} clockOffset={clock} latency={latency} active play visuals onFail={() => {}} />
        </div>
      )}
      {behind === "code" && <div className="lab-bg" aria-hidden style={{ background: "#05070a" }}><pre className="lab-code">{Array.from({ length: 40 }, () => CODE).join("\n")}</pre></div>}
      <div className="pl-panel" style={{ maxWidth: 640, margin: "0 auto 16px", gap: 10 }}>
        <p className="se-sm" style={{ margin: 0 }}>Controls lab: the player&apos;s controls with made-up state. Nothing is saved or sent.</p>
        {pick(VIEWERS, viewer, setViewer, "Who is looking")}
        {pick([["strudel", "Strudel plays"], ["synth", "Synth plays"]], strudel ? "strudel" : "synth", (v) => setStrudel(v === "strudel"), "What plays")}
        {pick(FACES.map((f) => [f, MODE_LABEL[f]] as [Face, string]), face, setFace, "Mode")}
        {pick([["auto", "Auto"], ...FACES.map((f) => [f, MODE_LABEL[f]] as [Policy, string])], policy, setPolicy, "Owner's choice (mode row)")}
        {pick(BEHIND, behind, setBehind, "Behind the panel")}
        {behind === "scene" && pick(SCENE_STATES.map((s) => [s.id, s.name] as [string, string]), sample, setSample, "Scene")}
        <label className="pl-slider" style={{ gridTemplateColumns: "150px 1fr 70px" }}><span>Panel width</span><input type="range" min={280} max={640} step={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} /><output>{width} px</output></label>
        <label className="pl-slider" style={{ gridTemplateColumns: "150px 1fr 70px" }}><span>Hide turn below</span><input type="range" min={280} max={640} step={5} value={whenMin} onChange={(e) => setWhenMin(Number(e.target.value))} /><output>{whenMin} px</output></label>
        <p className="se-sm" style={{ margin: 0 }}>Measured panel width: {Math.round(measured)} px. The turn text shows from {whenMin} px up.</p>
        {note && <p className="se-sm" role="status" style={{ margin: 0 }}>{note}</p>}
      </div>
      {mounted && <main className="pl-stage" style={{ padding: 0 }}>
        <div style={{ width, maxWidth: "100%" }}>
          <ControlsPanel whenMinWidth={whenMin} onWidth={setMeasured}
            midTurn={false}
            faceLabel={MODE_LABEL[face]}
            faceTitle={MODE_HINT[face]}
            strudelTag={playsPattern}
            locked={false}
            when="Turn 3 · 12 s ago"
            onHide={() => setNote("Hide controls pressed")}
            onFullscreen={() => setNote("Fullscreen pressed (the player hides everything but the picture)")}
            audioState="running" muted={muted} onResume={() => {}} onToggleMute={() => setMuted((m) => !m)}
            volume={volume} onVolume={setVolume}
            picture={{ gradientOn, visualsOn, onGradient: () => setGradientOn((v) => !v), onVisuals: () => setVisualsOn((v) => !v) }}
            middle={<ControlsMiddle key={viewer}
              supabase={supabase} sessionId="demo" signedIn={viewer !== "guest"} face={face} policy={policy} onChanged={() => {}}
              pattern={playsPattern ? { code: CODE, bpm: 110 } : null}
              patternPlays={playsPattern} strudelVisuals={strudelVisuals} onStrudelVisuals={setStrudelVisuals} strudelCode={strudelCode} onStrudelCode={setStrudelCode}
            />}
            extra={viewer !== "guest" ? <details className="pl-set se-sm"><summary>What the model set</summary></details> : null}
            shareText={shareText} shareAction={shareAction} qrPath="/s/demo"
          />
        </div>
      </main>}
    </div>
  );
}
