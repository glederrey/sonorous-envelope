"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ControlsPanel, WHEN_MIN_WIDTH } from "../../../components/player/controls-panel";
import { ControlsMiddle } from "../../../components/player/controls-middle";
import { CopyLink } from "../../../components/copy-link";
import type { Face, Policy } from "../../../lib/mcp/modes";

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
const VIEWERS: Array<[Viewer, string]> = [["owner", "Owner"], ["listener", "Signed-in listener"], ["guest", "Guest (link)"]];

export function ControlsLab() {
  const [viewer, setViewer] = useState<Viewer>("owner");
  const [strudel, setStrudel] = useState(true);
  const [face, setFace] = useState<Face>("external");
  const [width, setWidth] = useState(390), [measured, setMeasured] = useState(0), [whenMin, setWhenMin] = useState(WHEN_MIN_WIDTH);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(0.8);
  const [gradientOn, setGradientOn] = useState(true), [visualsOn, setVisualsOn] = useState(true), [strudelVisuals, setStrudelVisuals] = useState(true);
  const [note, setNote] = useState("");
  const [mounted, setMounted] = useState(false); // the link and QR buttons read the window: draw them on the client only
  useEffect(() => setMounted(true), []);
  const policy: Policy = "auto";
  // an owner is someone whose id is the session's owner; a signed-in listener is someone else's
  const supabase = useMemo(() => fakeClient(viewer === "owner" ? "me" : "someone-else"), [viewer]);
  const playsPattern = strudel && face === "external";

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
    <div style={{ "--pl-h": 140, "--pl-s": 0.35, "--pl-l": 0.16, minHeight: "calc(100dvh - var(--se-header-h) - var(--se-footer-h))", background: "hsl(140 35% 16%)", padding: 16 } as CSSProperties}>
      <div className="pl-panel" style={{ maxWidth: 640, margin: "0 auto 16px", gap: 10 }}>
        <p className="se-sm" style={{ margin: 0 }}>Controls lab: the player&apos;s controls with made-up state. Nothing is saved or sent.</p>
        {pick(VIEWERS, viewer, setViewer, "Who is looking")}
        {pick([["strudel", "Strudel plays"], ["synth", "Synth plays"]], strudel ? "strudel" : "synth", (v) => setStrudel(v === "strudel"), "What plays")}
        {pick([["external", "External face"], ["internal", "Internal face"]] as Array<[Face, string]>, face, setFace, "Face")}
        <label className="pl-slider" style={{ gridTemplateColumns: "150px 1fr 70px" }}><span>Panel width</span><input type="range" min={280} max={640} step={1} value={width} onChange={(e) => setWidth(Number(e.target.value))} /><output>{width} px</output></label>
        <label className="pl-slider" style={{ gridTemplateColumns: "150px 1fr 70px" }}><span>Hide turn below</span><input type="range" min={280} max={640} step={5} value={whenMin} onChange={(e) => setWhenMin(Number(e.target.value))} /><output>{whenMin} px</output></label>
        <p className="se-sm" style={{ margin: 0 }}>Measured panel width: {Math.round(measured)} px. The turn text shows from {whenMin} px up.</p>
        {note && <p className="se-sm" role="status" style={{ margin: 0 }}>{note}</p>}
      </div>
      {mounted && <main className="pl-stage" style={{ padding: 0 }}>
        <div style={{ width, maxWidth: "100%" }}>
          <ControlsPanel whenMinWidth={whenMin} onWidth={setMeasured}
            midTurn={false}
            faceLabel={face === "internal" ? "Internal" : "External"}
            faceTitle=""
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
              patternPlays={playsPattern} strudelVisuals={strudelVisuals} onStrudelVisuals={setStrudelVisuals}
            />}
            extra={viewer !== "guest" ? <details className="pl-set se-sm"><summary>What the model set</summary></details> : null}
            shareText={shareText} shareAction={shareAction} qrPath="/s/demo"
          />
        </div>
      </main>}
    </div>
  );
}
