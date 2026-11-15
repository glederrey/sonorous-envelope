// The drawings of the Strudel picture: pianoroll, punchcard, wordfall, spiral, scope, fscope, spectrum, pitchwheel.
//
// The pianoroll family is Strudel's own `__pianoroll` and the pitch wheel its own `pitchwheel`, both from `@strudel/draw`, used unmodified: it draws into a canvas we hand it, from
// events we hand it, so none of Strudel's page-level code (`getDrawContext`, which would add a fixed canvas to the body) runs.
// The spiral and the scopes are written here after Strudel's `spiral.mjs` (packages/draw), `scope.mjs` and `spectrum.mjs` (packages/webaudio): the same geometry and options, reading plain events instead of Strudel's Hap objects and our own analyser instead of superdough's. Strudel is Copyright (C) Strudel contributors, AGPL-3.0-or-later (https://codeberg.org/uzu/strudel); this file is part
// of a work under the same licence (docs/licensing.md). The colours of the model's code go only into canvas colour properties.
import { __pianoroll, getTheme, pitchwheel, setTheme } from "@strudel/draw";
import type { DrawHap, Prim } from "./protocol";
import { SPIRAL_MAX_EVENTS, hideTinyLabels, spiralSpan, spiralSteps, type Lane } from "./viz";

/** What a drawing needs to know about the moment: where the music is, the events, the sound, and the colours of this session. */
export interface Env {
  /** the cycle the ear is at */
  cycle: number;
  draws: DrawHap[];
  colours: Map<number, string>;
  /** the sound, if the analyser is there: time-domain samples in -1..1 and frequency bins in dB */
  time: Float32Array | null;
  freq: Float32Array | null;
  /** the session's colours (from the model's colour field): active, quiet, the playhead, plain */
  accent: { active: string; inactive: string; head: string };
  /** device pixels per CSS pixel */
  dpr: number;
}

const num = (o: Record<string, Prim>, k: string, d: number) => (typeof o[k] === "number" ? (o[k] as number) : d);
const flag = (o: Record<string, Prim>, k: string, d: boolean) => (k in o ? Boolean(o[k]) : d);
const str = (o: Record<string, Prim>, k: string, d: string) => (typeof o[k] === "string" ? (o[k] as string) : d);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** A DrawHap as the Hap `__pianoroll` reads: a begin in cycles, an end, a duration, a value. Tags are filtered before the call. */
const asHap = (h: DrawHap) => ({ whole: { begin: h.c }, endClipped: h.c + h.l, duration: h.l, value: h.v, hasTag: () => true });

export class Painter {
  private canvases = new Map<string, HTMLCanvasElement>();
  private canvasFor(key: string, w: number, h: number, keep = false): CanvasRenderingContext2D | null {
    let cv = this.canvases.get(key);
    if (!cv) { cv = document.createElement("canvas"); this.canvases.set(key, cv); }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } else if (!keep) cv.getContext("2d")?.clearRect(0, 0, w, h);
    return cv.getContext("2d");
  }
  /** Forget the lane canvases (a new code, or a different set of drawings). */
  reset() { this.canvases.clear(); }

  paint(ctx: CanvasRenderingContext2D, lanes: Lane[], env: Env) {
    for (const lane of lanes) {
      const x = Math.round(lane.x), y = Math.round(lane.y), w = Math.max(1, Math.round(lane.w)), h = Math.max(1, Math.round(lane.h));
      const key = `${lane.spec.id}${lane.spec.inline ? "i" : "b"}`;
      const o = lane.spec.opts;
      switch (lane.spec.name) {
        case "pianoroll": case "punchcard": case "wordfall": {
          const c = this.canvasFor(key, w, h, o.smear ? true : false);
          if (!c) break;
          const cycles = num(o, "cycles", 4), playhead = num(o, "playhead", 0.5), hideNegative = flag(o, "hideNegative", false);
          const from = -cycles * playhead, to = cycles * (1 - playhead), t = env.cycle;
          let events = env.draws.filter((d) => d.viz.includes(lane.spec.id) && d.c < t + to && d.c + d.l > t + from && (!hideNegative || d.c >= 0));
          // punchcard folds the rows, wordfall is a vertical roll with labels (the same presets as Strudel's)
          const preset = lane.spec.name === "wordfall" ? { fold: 1, vertical: 1, labels: 1, stroke: 0, fillActive: 1, active: "#ffffff" } : lane.spec.name === "punchcard" ? { fold: 1 } : {};
          const merged = { ...preset, ...o } as Record<string, Prim>;
          // a label that would come out tiny or wider than its bar is left off (readable on a phone, instead of a smudge)
          if (merged.labels) events = hideTinyLabels(events, { vertical: Boolean(merged.vertical), fold: merged.fold === undefined ? true : Boolean(merged.fold), minMidi: num(merged, "minMidi", 10), maxMidi: num(merged, "maxMidi", 90), timeExtent: cycles }, w, h, 11 * env.dpr);
          __pianoroll({
            active: env.accent.active, inactive: env.accent.inactive, playheadColor: env.accent.head,
            ...merged, cycles, playhead, time: t, haps: events.map(asHap), ctx: c, id: undefined,
          });
          ctx.globalAlpha = lane.spec.inline ? 0.92 : 0.7; ctx.drawImage(c.canvas, x, y); ctx.globalAlpha = 1; // behind the code, a little softer so the code reads
          break;
        }
        case "spiral": spiral(ctx, x, y, w, h, lane.spec.id, o, env); break;
        case "scope": case "tscope": scope(ctx, x, y, w, h, lane.spec.id, o, env); break;
        case "fscope": fscope(ctx, x, y, w, h, lane.spec.id, o, env); break;
        case "spectrum": {
          const c = this.canvasFor(key, w, h, true);
          if (c) { spectrum(c, w, h, lane.spec.id, o, env); ctx.drawImage(c.canvas, x, y); }
          break;
        }
        case "pitchwheel": {
          const c = this.canvasFor(key, w, h, false);
          if (!c) break;
          setTheme({ ...getTheme(), foreground: env.accent.active });
          const t = env.cycle;
          const haps = env.draws.filter((d) => d.viz.includes(lane.spec.id) && d.c <= t && d.c + d.l > t).map(asHap);
          const o2: Record<string, Prim> = { ...o };
          if (typeof o2.root !== "number") delete o2.root;
          if (o2.mode !== "polygon" && o2.mode !== "flake") delete o2.mode;
          pitchwheel({ ...o2, haps, ctx: c, id: undefined });
          ctx.drawImage(c.canvas, x, y);
          break;
        }
      }
    }
  }
}

/** Strudel's `scope`: the waveform, aligned to a rising zero crossing, with a soft glow. */
function scope(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, id: number, o: Record<string, Prim>, env: Env) {
  const colour = str(o, "color", env.colours.get(id) ?? env.accent.active);
  const thickness = num(o, "thickness", 3) * env.dpr * 0.6, scale = num(o, "scale", 0.25), pos = num(o, "pos", 0.75), trigger = num(o, "trigger", 0);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.lineWidth = thickness; ctx.strokeStyle = colour; ctx.lineJoin = "round"; ctx.shadowColor = colour; ctx.shadowBlur = 10 * env.dpr; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  const data = env.time;
  if (!data) { ctx.moveTo(x0, y0 + pos * h); ctx.lineTo(x0 + w, y0 + pos * h); }
  else {
    let start = 0;
    if (flag(o, "align", true)) { for (let i = 1; i < data.length; i++) if (data[i - 1] > -trigger && data[i] <= -trigger) { start = i; break; } }
    const n = data.length - start, slice = w / n;
    for (let i = 0; i < n; i++) { const yy = y0 + (pos - scale * data[start + i]) * h; i ? ctx.lineTo(x0 + i * slice, yy) : ctx.moveTo(x0, yy); }
  }
  ctx.stroke(); ctx.restore();
}

/** Strudel's `fscope`: the spectrum as bars from a baseline. */
function fscope(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, id: number, o: Record<string, Prim>, env: Env) {
  const colour = str(o, "color", env.colours.get(id) ?? env.accent.active);
  const scale = num(o, "scale", 0.25), pos = num(o, "pos", 0.75), lean = num(o, "lean", 0.5), min = num(o, "min", -150), max = num(o, "max", 0);
  const data = env.freq;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.fillStyle = colour; ctx.globalAlpha = 0.85;
  if (!data) ctx.fillRect(x0, y0 + pos * h, w, Math.max(1, env.dpr));
  else {
    const slice = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const v = clamp((data[i] - min) / ((max - min) || 1), 0, 1) * scale; // min equal to max is allowed: no 0/0
      ctx.fillRect(x0 + i * slice, y0 + (pos - v * lean) * h, Math.max(slice, 1), v * h);
    }
  }
  ctx.restore();
}

/** Strudel's `spectrum`: a spectrogram that scrolls left; the newest column is drawn at the right edge. It keeps its own canvas. */
function spectrum(c: CanvasRenderingContext2D, w: number, h: number, id: number, o: Record<string, Prim>, env: Env) {
  const data = env.freq;
  if (!data) return;
  const colour = str(o, "color", env.colours.get(id) ?? env.accent.active);
  const speed = Math.max(1, Math.round(num(o, "speed", 1) * env.dpr)), min = num(o, "min", -80), max = num(o, "max", 0);
  c.globalCompositeOperation = "copy"; c.drawImage(c.canvas, -speed, 0); c.globalCompositeOperation = "source-over";
  c.clearRect(w - speed, 0, speed, h);
  c.fillStyle = colour;
  const n = data.length, lim = Math.log(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const norm = clamp((data[i] - min) / ((max - min) || 1), 0, 1);
    const next = (Math.log(i + 1) / lim) * h;
    c.globalAlpha = norm;
    c.fillRect(w - speed, h - next, speed, Math.max(2 * env.dpr * 0.5, next - prev));
    prev = next;
  }
  c.globalAlpha = 1;
}

// polar coordinates -> x, y (Strudel's spiral.mjs)
const fromPolar = (angle: number, radius: number, cx: number, cy: number) => { const r = ((angle - 90) * Math.PI) / 180; return [cx + Math.cos(r) * radius, cy + Math.sin(r) * radius]; };
const onSpiral = (angle: number, margin: number, cx: number, cy: number, rotate: number) => fromPolar((angle + rotate) * 360, margin * angle, cx, cy);

/** Strudel's `spiral`: the events wind round a centre, one turn a cycle; the playhead is the short bright piece at the start. */
function spiral(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, id: number, o: Record<string, Prim>, env: Env) {
  const stretch = num(o, "stretch", 1), size = num(o, "size", 80) * env.dpr * (Math.min(w, h) / (600 * env.dpr)), thickness = num(o, "thickness", size / 2);
  const cap = str(o, "cap", "butt") as CanvasLineCap, inset = num(o, "inset", 3), padding = num(o, "padding", 0), steady = num(o, "steady", 1);
  const headLen = num(o, "playheadLength", 0.02), headThick = num(o, "playheadThickness", thickness);
  const fade = flag(o, "fade", true), colourIdle = flag(o, "colorizeInactive", false);
  const active = str(o, "activeColor", env.accent.active), inactive = str(o, "inactiveColor", env.accent.inactive), head = str(o, "playheadColor", env.accent.head);
  const cx = x0 + w / 2, cy = y0 + h / 2, time = env.cycle, rotate = steady * time, min = -2;
  // A band is never thicker than the gap between two turns (0.9 of it), so a large `stretch` still shows a spiral and not a flat disc.
  const maxThick = (size / stretch) * 0.9;
  const segment = (from: number, to: number, colour: string, thick: number, opacity: number, rot: number, linecap: CanvasLineCap) => {
    from *= stretch; to *= stretch; rot *= stretch;
    thick = Math.min(thick, maxThick);
    const steps = spiralSteps((to - from) / stretch, stretch); // a bounded number of pieces, whatever the code's options say
    const margin = size / stretch;
    if (linecap === "butt") {
      // A band with square ends is filled as one shape, its ends on the radius through its first and last point. A stroked band is cut square
      // to its own chord, so two neighbours leave a thin wedge open on the outside of the turn (and run on, they double up where translucent);
      // filled, they share the radius exactly.
      const edge = (a: number, off: number) => fromPolar((a + rot) * 360, margin * a + off, cx, cy);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const [px, py] = edge(from + ((to - from) * i) / steps, thick / 2); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      for (let i = steps; i >= 0; i--) { const [px, py] = edge(from + ((to - from) * i) / steps, -thick / 2); ctx.lineTo(px, py); }
      ctx.closePath(); ctx.globalAlpha = opacity; ctx.fillStyle = colour; ctx.fill();
      return;
    }
    ctx.lineWidth = thick; ctx.lineCap = linecap; ctx.strokeStyle = colour; ctx.beginPath();
    const [sx, sy] = onSpiral(from, margin, cx, cy, rot); ctx.moveTo(sx, sy);
    for (let i = 1; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps, [px, py] = onSpiral(a, margin, cx, cy, rot);
      ctx.lineTo(px, py);
    }
    ctx.globalAlpha = opacity; ctx.stroke();
  };
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  let drawn = 0;
  for (const d of env.draws) {
    if (!d.viz.includes(id)) continue;
    const span = spiralSpan(d.c, d.l, time);
    if (!span) continue;
    if (++drawn > SPIRAL_MAX_EVENTS) break;
    const isActive = d.c <= time && d.c + d.l > time;
    const colour = typeof d.v.color === "string" ? d.v.color : active;
    segment(span[0] + inset, span[1] + inset - padding, colourIdle || isActive ? colour : inactive, thickness, fade ? 1 - Math.abs((d.c - time) / min) : 1, rotate, cap);
  }
  segment(inset - headLen, inset, head, headThick, 1, rotate, cap);
  ctx.restore(); ctx.globalAlpha = 1;
}
