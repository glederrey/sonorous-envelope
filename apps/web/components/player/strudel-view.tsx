"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Painter, type Env } from "../../lib/strudel/draw";
import { fitFont, lanes, litKey, litSpans, runs, tokenize, type VizStore } from "../../lib/strudel/viz";
import type { StrudelOutput } from "../../lib/strudel/output";

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
  /** the model's colour: the highlights, the drawings and the code take their hue from it */
  hue: number;
}

const DPR_MAX = 1.5; // the drawings are soft; a lower resolution keeps a phone smooth
const TAIL_S = 0.18; // seconds a lit part stays after its note ends

export function StrudelView({ store, output, level, beats, shown, hue }: Props) {
  const root = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), pre = useRef<HTMLPreElement>(null);
  const live = useRef({ shown, hue, output, store });
  live.current = { shown, hue, output, store };

  useEffect(() => {
    const el = root.current, canvas = cv.current, code = pre.current, ctx = canvas?.getContext("2d");
    if (!el || !canvas || !code || !ctx) return;
    const painter = new Painter();
    let raf = 0, vis = 0, last = 0, w = 1, h = 1, dpr = 1, cssW = 1, cssH = 1;
    let seenVersion = -1, seenCode = "", cls: Uint8Array = new Uint8Array(0), key = "", cleared = true, time: Float32Array | null = null, freq: Float32Array | null = null;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX); cssW = r.width; cssH = r.height;
      w = Math.max(1, Math.round(r.width * dpr)); h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      seenCode = ""; // the font is set again
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const { shown: on, hue: hu, output, store: st } = live.current;
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0.016; last = now;
      // follows the canvas's level while it is shown; fades out by itself otherwise
      vis = on ? level.current : vis * Math.exp(-dt / 0.45);
      if (vis < 0.004) { vis = 0; if (!cleared) { ctx.clearRect(0, 0, w, h); code.replaceChildren(); key = ""; cleared = true; } el.style.visibility = "hidden"; return; }
      el.style.visibility = "visible"; el.style.opacity = String(vis);
      cleared = false;

      const cycle = beats.current / 4, cps = st.bpm / 240;
      st.prune(cycle);

      // the code: tokenised once per code, then runs rebuilt when what is lit changes (a few times per note, not every frame)
      if (st.code !== seenCode) {
        seenCode = st.code; cls = tokenize(st.code); key = "\u0000";
        code.style.fontSize = `${fitFont(st.code, cssW, cssH)}px`;
      }
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

      // the drawings behind the code
      ctx.clearRect(0, 0, w, h);
      if (st.specs.length) {
        const needsSound = st.specs.some((s) => s.name === "scope" || s.name === "tscope" || s.name === "fscope");
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
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [level, beats]);

  return (
    <div ref={root} className="pl-strudel" aria-hidden style={{ visibility: "hidden", opacity: 0 }}>
      <canvas ref={cv} className="pl-strudel-cv" />
      <pre ref={pre} className="pl-strudel-code" />
    </div>
  );
}
