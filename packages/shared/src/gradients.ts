import type { ResolvedColour } from "@sonorous/engine";
import { clamp, hash01, lerp, noise1, type Clock, type Feel, type Layer } from "./scene-kit";
import { hslToRgb, isSaturatedRed, matchedLayer, luminanceSwingPerAlpha } from "./colour-math";

// Colour play: the gradient that moves (docs/visuals.md). Two or three large lights of other hues drift over the field on slow orbits, and
// swell and shift hue on the beat. The brightness does not move: every light is painted at the lightness that changes the luminance of the
// field least (`matchedLayer`), and its swing is counted in the flash budget at its real value (`Layer.k`). So the colours can be strong and can
// pulse with the music without being a flash: a flash is a change of brightness, and this changes the colour only. A light that would be
// saturated red does not pulse at all.

/** The hues of the lights: close to the field's own for a gentle mood, wide apart (towards the complement) for a tense one, wider with joy. */
export function playHues(h: number, feel: Feel, lift2: number): number[] {
  const spread = lerp(55, 170, clamp(feel.jitter * 1.1)) + 35 * Math.max(0, lift2);
  return [h + spread, h - spread * 0.8, h + spread * 0.35 + (feel.jitter > 0.5 ? 180 - spread : 0), h - spread * 0.4, h + spread * 1.3].map((x) => ((x % 360) + 360) % 360);
}

/** The matched colour of a hue that drifts: the two neighbouring 5-degree steps are blended (hue along the short arc, saturation and lightness linearly, the swing the larger of the two plus a margin), so the lightness never jumps as the hue moves. */
function drifted(bases: Clock["bases"], hue: number, sat: number) {
  const x = (((hue % 360) + 360) % 360) / 5, i = Math.floor(x), f = x - i, a = matchedLayer(bases, i * 5, sat), b = matchedLayer(bases, (i + 1) * 5, sat);
  const dh = ((((b.hue - a.hue) % 360) + 540) % 360) - 180;
  return { hue: (a.hue + dh * f + 360) % 360, sat: lerp(a.sat, b.sat, f), l: lerp(a.l, b.l, f), k: Math.max(a.k, b.k) * 1.1 };
}

const VIGNETTES = new Map<string, Float32Array>();
/** A static field of 0 (centre) to 1 (edges): the vignette. Cached by size and tightness; the lights' colour is applied by the painter. */
function vignetteGrid(gw: number, gh: number, asp0: number, tight0: number): Float32Array {
  const asp = Math.round(asp0 * 20) / 20, tight = Math.round(tight0 * 10) / 10; // the cache key's own rounding, so the cached grid is what the key says
  const key = `${gw}x${gh}|${Math.round(asp * 20)}|${Math.round(tight * 10)}`; let g = VIGNETTES.get(key);
  if (g) return g;
  g = new Float32Array(gw * gh);
  const lo = lerp(0.75, 0.2, tight), hi = lerp(1.35, 0.7, tight); // near: the dark starts close to the middle and closes in; far: only the corners
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const d = Math.hypot(((i + 0.5) / gw - 0.5) * Math.max(asp, 0.5) * 2, ((j + 0.5) / gh - 0.5) * 2) / 1.4, u = clamp((d - lo) / (hi - lo));
    g[j * gw + i] = u * u * (3 - 2 * u);
  }
  VIGNETTES.set(key, g); if (VIGNETTES.size > 40) VIGNETTES.delete(VIGNETTES.keys().next().value as string);
  return g;
}

/** Four lights, five for a tense mood. Each has its own centre, amplitude, direction and size: they circle on orbits of 10 to 40 beats that never close (a slow noise wanders them),
 *  the smaller ones show their edges sliding across the field, each breathes in size over the phrase, and on the beat they jump a little and swell. Hues stay fixed within a state:
 *  the matched lightness is chosen per hue step, so a drifting hue would flicker. */
export function colourPlay(colour: ResolvedColour, feel: Feel, c: Clock): Layer[] {
  const shape = colour.shape ?? "wash";
  const hues = playHues(colour.h, feel, c.lift2), n = feel.jitter > 0.5 ? 5 : 4;
  const sat = clamp(colour.s * 1.3 + 0.25, 0.45, 0.9);
  const period = Math.max(lerp(30, 12, clamp(0.5 * feel.depth + 0.5 * feel.jitter)), 6 * c.bps); // beats for the first orbit: never under 12 beats, never under about 6 s, whatever the tempo
  const out: Layer[] = [];
  for (let i = 0; i < n; i++) {
    const hs = (j: number) => hash01(i, c.seed + 70 + j), dir = i % 2 ? -1 : 1;
    const P = period * (0.75 + 0.3 * i + 0.2 * hs(1)), phi = 2 * Math.PI * hs(2), A = 0.16 + 0.26 * hs(3);
    const m = drifted(c.bases, hues[i] + 18 * Math.sin((2 * Math.PI * c.beats) / 48 + phi), sat); // the hue wanders a few degrees over three phrases; the matched lightness is blended between steps so it never flickers
    const pulses = !isSaturatedRed(hslToRgb(m.hue, m.sat, m.l)) && c.red > 0;
    // the gradient does not follow the beat (the scene does): each light swells slowly over the phrase (four bars)
    const swell = pulses ? 0.5 - 0.5 * Math.cos(2 * Math.PI * ((c.beats / 16 + i / n) % 1)) : 0;
    let cx = 0.5 + (hs(4) - 0.5) * 0.3 + A * Math.sin((2 * Math.PI * c.b * dir) / P + phi) + 0.17 * noise1(c.b / 16 + i * 5, c.seed + 80);
    let cy = 0.5 + (hs(5) - 0.5) * 0.3 + A * 0.9 * Math.cos((2 * Math.PI * c.b * dir) / (P * 1.27) + phi * 1.7) + 0.17 * noise1(c.b / 19 + i * 7, c.seed + 90)
      - 0.1 * c.lift2 + 0.05 * c.lift2 * Math.sin((2 * Math.PI * c.beats) / 32 + phi); // joy lifts the lights, sorrow lets them sink, and over the phrase they rise and settle a little
    if (shape === "glow") { cx = 0.5 + (cx - 0.5) * 0.45; cy = 0.58 + (cy - 0.58) * 0.45; } // a radial light: the lights gather round the middle
    else if (shape === "sweep") { const ang = (2 * Math.PI * c.b * dir) / (P * 2) + (i * 2 * Math.PI) / n; cx = 0.5 + 0.3 * Math.cos(ang) + 0.05 * (cx - 0.5); cy = 0.6 + 0.27 * Math.sin(ang) + 0.05 * (cy - 0.5); } // a conic turn: the lights ride a ring that turns slowly
    const breathe = 1 + 0.3 * Math.sin((2 * Math.PI * c.beats) / 16 + phi);
    out.push({
      kind: "tint", x: cx, y: cy, r: lerp(0.35, 0.58, hs(6)) * lerp(0.9, 1.25, feel.near) * breathe * (1 + 0.1 * swell),
      a: clamp(lerp(0.5, 0.72, 0.5 + 0.5 * (feel.lift - 0.5)) * (0.85 + 0.35 * swell), 0, 0.8), dh: 0, hue: m.hue, sat: m.sat * 100, l: m.l * 100, k: m.k,
    });
  }
  // The vignette: the edges darken, tight and strong for a close mood, only the corners for a distant one. After the lights, and part of the gradient.
  const asp = c.aspect > 0 ? c.aspect : 0.6, GW = 40, GH = Math.round(clamp(GW / asp, 30, 100)), tight = clamp(feel.near);
  out.push({ kind: "veil", x: 0.5, y: 0.5, r: 1, a: 0.08 + 0.4 * tight * tight, dh: 0, hue: colour.h, sat: 25, l: 3, k: Math.max(0.01, ...c.bases.map((b) => luminanceSwingPerAlpha(b, hslToRgb(colour.h, 0.25, 0.03)))), gw: GW, gh: GH, grid: vignetteGrid(GW, GH, asp, tight) });
  return out;
}
