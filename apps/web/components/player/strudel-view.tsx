"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Painter, type Env } from "../../lib/strudel/draw";
import { fitFont, sweepOffset, lanes, litKey, litSpans, runs, tokenize, type VizStore } from "../../lib/strudel/viz";
import type { StrudelOutput } from "../../lib/strudel/output";
import { picLog } from "../../lib/debug";

// The picture of a Strudel state (docs/implementation/strudel.md, "The picture"): the model's code fills the background, the parts that
// sound light up as they sound, and the drawings the code asked for (`.pianoroll()`, `.scope()`...) are drawn behind it. It replaces the
// scenes of the visual canvas while Strudel plays and the listener has "Strudel visuals" on. The canvas still runs underneath, only to
// keep the level (the fades and the first-bar wait) and the beat; this view reads both from it.
// The look follows strudel.cc: the code in a monospace face, the active parts of the mini-notation marked, drawings behind.

interface Props {
  store: VizStore;
  output: () => StrudelOutput | null;
  /** how much of the picture shows now (0 to 1) and where the beat is: written by the visual canvas every frame */
  level: MutableRefObject<number>;
  beats: MutableRefObject<number>;
  /** false: fade out (a synth sound took over, or the listener turned the visuals off) */
  shown: boolean;
  /** written every frame: how opaque the whole view is (0 to 1). The visual canvas keeps painting the scenes under it until it is opaque, so the scenes and this view cross-fade */
  opacity: MutableRefObject<number>;
  /** the model's colour: the highlights, the drawings and the code take their hue from it */
  hue: number;
  /** "Strudel code": false hides the code and leaves only the drawings (default true) */
  showCode?: boolean;
}

const DPR_MAX = 1.5; // the drawings are soft; a lower resolution keeps a phone smooth
const TAIL_S = 0.18; // seconds a lit part stays after its note ends
const IN_S = 1.5; // seconds the code and its drawings take to fade in once the view is black (still capped by the level, so a bar-synced start waits for the bar)
const OUT_S = 1.5; // seconds the view and its content take to fade out together: what comes after (a scene, the field) crossfades in under them
const CODE_S = 0.6; // seconds the code takes to fade when the listener turns "Strudel code" off or on (#61)
const START_WAIT_S = 4; // a pattern whose code marks nothing still shows its code after this long
const SWAP_S = 0.5; // seconds the old code's drawings take to fade out over the new code's (v0.19.2 tests: they swapped at once)

export function StrudelView({ store, output, level, beats, shown, opacity, hue, showCode = true }: Props) {
  const root = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), pre = useRef<HTMLPreElement>(null);
  const live = useRef({ shown, hue, output, store, showCode });
  live.current = { shown, hue, output, store, showCode };

  useEffect(() => {
    const el = root.current, canvas = cv.current, code = pre.current, ctx = canvas?.getContext("2d");
    if (!el || !canvas || !code || !ctx) return;
    const painter = new Painter();
    let codeK = showCode ? 1 : 0; // the code's own fade for "Strudel code" (on and off over CODE_S)
    let seenResets = -1, begun = false, resetT = 0, startK = 0; // the code waits for the first sound of a pattern that starts
    let raf = 0, vis = 0, op = 0, op0 = 0, onT = 0, inT = 0, wasOn = false, outT = 0, out0 = 0, last = 0, w = 1, h = 1, dpr = 1, cssW = 1, cssH = 1;
    const snap = document.createElement("canvas"), sctx = snap.getContext("2d");
    let seenSwaps = store.swaps, swapT = SWAP_S; // the last frame of the old drawings, held and faded out over the new ones
    let seenVersion = -1, seenCode = "", cls: Uint8Array = new Uint8Array(0), key = "", cleared = true, time: Float32Array | null = null, freq: Float32Array | null = null;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX); cssW = r.width; cssH = r.height;
      w = Math.max(1, Math.round(r.width * dpr)); h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      seenCode = ""; // the font is set again
    };
    picLog("strudel view mount");
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const { shown: on, hue: hu, output, store: st, showCode: codeOn } = live.current;
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016; last = now;
      codeK = codeOn ? Math.min(1, codeK + dt / CODE_S) : Math.max(0, codeK - dt / CODE_S);
      // a pattern that starts (a reload, Strudel on) sounds on the next bar: its code comes in with the first sound, not before it
      // (tester report v0.22.0). Code that marks nothing comes in after START_WAIT_S anyway.
      if (st.resets !== seenResets) { seenResets = st.resets; begun = false; resetT = 0; }
      resetT += dt;
      if (!begun) { const c = beats.current / 4; begun = resetT > START_WAIT_S || st.marks.some((m) => m.c <= c) || st.draws.some((h) => h.c <= c); }
      startK = begun ? Math.min(1, startK + dt / CODE_S) : 0;
      // The whole view (`op`) is opaque while it is shown, even in a silence, so the colour field never shows through a fade: the content fades
      // to black inside it. Coming on (Strudel starts, or the listener turns the visuals back on) the view's black
      // background and the code and its drawings come in together over IN_S (at once when almost nothing shows behind; before v0.19.4 the black came first, a dip).
      // It fades out over the scenes when a synth sound takes over or it is switched off.
      // Fading out is the same crossfade the other way (v0.19.5, the owner asked for both directions alike): the content and the black view fade
      // together over OUT_S, so the scene behind comes up under the drawings. Before, the content went black first (about 0.3 s), a dip; the old wording:
      // up from black whether a silence came first (strudel_mode off) or the synth state arrived straight away.
      // Over a scene that shows (the listener turns the drawings back on, or a pattern takes over from a sounding synth state) it is one
      // crossfade: the view's black and its content come in together over IN_S, so the scene never dips to black first (v0.19.3 tests).
      if (on) {
        if (!wasOn) { op0 = op; onT = 0; inT = 0; if (level.current < 0.05) op = 1; picLog("strudel view on", { opacity: +op0.toFixed(2), level: +level.current.toFixed(2) }); }
        if (op < 1) { onT += dt; const k = Math.min(1, onT / IN_S); op = op0 + (1 - op0) * k * k * (3 - 2 * k); if (k >= 1) op = 1; }
        inT += dt;
      } else {
        if (wasOn) { outT = 0; out0 = op; picLog("strudel view off", { opacity: +op.toFixed(2), level: +level.current.toFixed(2) }); }
        outT += dt;
        const k = Math.min(1, outT / OUT_S);
        op = out0 * (1 - k * k * (3 - 2 * k));
      }
      wasOn = on;
      if (op < (on ? 0.004 : 0.03)) op = 0;
      opacity.current = op;
      // the content follows the canvas's level (the fades of the sound, the first bar) and the view's own opacity
      // while it fades out the content only ever dims: a synth sound rising behind it (its level) must not bring the code back
      const fin = Math.min(1, inT / IN_S);
      vis = on ? Math.min(level.current, op, fin * fin * (3 - 2 * fin)) : Math.min(vis, level.current, op);
      if (op === 0) { if (!cleared) { ctx.clearRect(0, 0, w, h); code.replaceChildren(); key = ""; cleared = true; } el.style.visibility = "hidden"; return; }
      el.style.visibility = "visible"; el.style.opacity = String(op); el.style.setProperty("--sv-k", String(vis));
      canvas.style.opacity = String(vis);
      code.style.opacity = String(vis * codeK * startK);
      if (vis < 0.004) { if (!cleared) { ctx.clearRect(0, 0, w, h); code.replaceChildren(); key = ""; cleared = true; } return; }
      cleared = false;

      const cycle = beats.current / 4, cps = st.bpm / 240;
      st.prune(cycle);

      // the code: tokenised once per code, then runs rebuilt when what is lit changes (a few times per note, not every frame)
      if (st.code !== seenCode) {
        seenCode = st.code; cls = tokenize(st.code); key = "\u0000";
        code.style.fontSize = `${fitFont(st.code, cssW, cssH)}px`;
      }
      // code taller than the view: sweep slowly over it, top to bottom and back (the page itself never scrolls)
      code.scrollTop = sweepOffset(now / 1000, code.scrollHeight - code.clientHeight);
      const lit = litSpans(st.marks, cycle, TAIL_S * cps);
      const k = litKey(lit);
      if (k !== key) {
        key = k;
        const frag = document.createDocumentFragment();
        for (const r of runs(st.code, cls, lit)) {
          const s = document.createElement("span");
          s.className = `sv${r.cls}`;
          s.textContent = r.text; // the model's text goes in as text, never as markup
          if (r.lit >= 0) {
            const l = lit[r.lit];
            s.classList.add("svh");
            s.style.setProperty("--lv", String(Math.ceil(l.level * 4) / 4));
            if (l.colour) s.style.setProperty("--hc", l.colour);
          }
          frag.appendChild(s);
        }
        code.replaceChildren(frag);
      }

      // the drawings behind the code. New code's drawings have just replaced the old: keep the last frame of the old ones (still on the canvas) to fade out over them
      if (st.swaps !== seenSwaps) {
        seenSwaps = st.swaps;
        if (sctx) { if (snap.width !== w || snap.height !== h) { snap.width = w; snap.height = h; } sctx.clearRect(0, 0, w, h); sctx.drawImage(canvas, 0, 0); swapT = 0; picLog("strudel drawings crossfade", { s: SWAP_S }); }
      }
      ctx.clearRect(0, 0, w, h);
      if (st.specs.length) {
        const needsSound = st.specs.some((s) => s.name === "scope" || s.name === "tscope" || s.name === "fscope" || s.name === "spectrum");
        const out = needsSound ? output() : null;
        if (needsSound && out) {
          if (!time || time.length !== out.soundSamples) { time = new Float32Array(out.soundSamples); freq = new Float32Array(out.soundBins); }
          out.readSound(time, freq!);
        }
        const env: Env = {
          cycle, draws: st.draws, colours: st.colours, time: needsSound ? time : null, freq: needsSound ? freq : null, dpr,
          accent: { active: `hsl(${Math.round(hu)} 85% 72%)`, inactive: `hsl(${Math.round(hu)} 38% 52%)`, head: `hsl(${Math.round(hu)} 30% 94%)` },
        };
        painter.paint(ctx, lanes(st.specs, w, h), env);
      } else painter.reset();
      if (swapT < SWAP_S) {
        swapT += dt;
        const k = Math.min(1, swapT / SWAP_S);
        if (k < 1 && snap.width === w && snap.height === h) { ctx.globalAlpha = 1 - k * k * (3 - 2 * k); ctx.drawImage(snap, 0, 0); ctx.globalAlpha = 1; }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { picLog("strudel view unmount"); cancelAnimationFrame(raf); ro.disconnect(); };
  }, [level, beats, opacity]);

  return (
    <div ref={root} className="pl-strudel" aria-hidden style={{ visibility: "hidden", opacity: 0 }}>
      <canvas ref={cv} className="pl-strudel-cv" />
      <pre ref={pre} className="pl-strudel-code" />
    </div>
  );
}
