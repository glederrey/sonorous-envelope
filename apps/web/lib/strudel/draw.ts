// The drawings of the Strudel picture: pianoroll, punchcard, wordfall, scope, fscope.
//
// The pianoroll family is Strudel's own `__pianoroll` from `@strudel/draw`, used unmodified: it draws into a canvas we hand it, from
// events we hand it, so none of Strudel's page-level code (`getDrawContext`, which would add a fixed canvas to the body) runs.
// The scopes are written here after Strudel's `scope.mjs` (packages/webaudio): the same geometry and options, reading our own analyser instead of superdough's. Strudel is Copyright (C) Strudel contributors, AGPL-3.0-or-later (https://codeberg.org/uzu/strudel); this file is part
// of a work under the same licence (docs/licensing.md). The colours of the model's code go only into canvas colour properties.
import { __pianoroll } from "@strudel/draw";
import type { DrawHap, Prim } from "./protocol";
import type { Lane } from "./viz";

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
          const haps = env.draws
            .filter((d) => d.viz.includes(lane.spec.id) && d.c < t + to && d.c + d.l > t + from && (!hideNegative || d.c >= 0))
            .map(asHap);
          // punchcard folds the rows, wordfall is a vertical roll with labels (the same presets as Strudel's)
          const preset = lane.spec.name === "wordfall" ? { fold: 1, vertical: 1, labels: 1, stroke: 0, fillActive: 1, active: "#ffffff" } : lane.spec.name === "punchcard" ? { fold: 1 } : {};
          __pianoroll({
            active: env.accent.active, inactive: env.accent.inactive, playheadColor: env.accent.head,
            ...preset, ...o, cycles, playhead, time: t, haps, ctx: c, id: undefined,
          });
          ctx.globalAlpha = lane.spec.inline ? 0.92 : 0.7; ctx.drawImage(c.canvas, x, y); ctx.globalAlpha = 1; // behind the code, a little softer so the code reads
          break;
        }
        case "scope": case "tscope": scope(ctx, x, y, w, h, lane.spec.id, o, env); break;
        case "fscope": fscope(ctx, x, y, w, h, lane.spec.id, o, env); break;
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
      const v = clamp((data[i] - min) / (max - min), 0, 1) * scale;
      ctx.fillRect(x0 + i * slice, y0 + (pos - v * lean) * h, Math.max(slice, 1), v * h);
    }
  }
  ctx.restore();
}
