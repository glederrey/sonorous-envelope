import type { ResolvedColour } from "@sonorous/engine";
import { clamp, frac, hash01, lerp, type Clock, type Item, type Layer, type SceneName } from "./scene-kit";
import { sceneHasLayers, sceneParts } from "./scenes";

export { hash01, SCENES, type Item, type Layer, type SceneName } from "./scene-kit";

// The picture that moves over the colours (docs/visuals.md). Everything here is a pure function of the colour, the tempo, the beat
// count and the time, so every listener sees the same thing, and a test can check the flash rule without a canvas.
//
// The flash rule (docs/safety.md): the beat pulse is designed to stay under the flash threshold by itself, at any tempo.
//   - Large elements (the wash over the whole field, the glow, the fog and aurora layers) together swing the relative luminance by at most MAX_LARGE_SWING (0.09),
//     at the worst pixel: the sum of their opacities, with no discount for the glow covering only part of the view.
//     A white layer of opacity `a` over a base moves the luminance by at most `a`. WCAG 2.3.1 counts a flash from a 10% change,
//     so nothing here is one, however fast it repeats.
//   - Saturated red gets no pulse at all.
//   - Small elements (motes, rings, streaks) may be faster and brighter, but together cover at most MAX_SMALL_AREA of the view.
//   - Above HALF_TIME_BPM the beat motion runs at half-time. That is for looks: the cap above is what keeps it safe.

export const PHRASE_BEATS = 16;       // 4 bars of 4 beats (4/4 is assumed, there is no meter)
export const MAX_LARGE_SWING = 0.09;
export const MAX_SMALL_AREA = 0.1;
export const MAX_ITEMS = 160;
export const MAX_ITEM_ALPHA = 0.5;
export const HALF_TIME_BPM = 180;

export interface Frame {
  /** opacity of a white layer over the whole field */
  wash: number;
  /** a white radial highlight; `hold` is the fraction of the radius that stays at full opacity (hard edge) */
  glow: { x: number; y: number; r: number; a: number; hold: number } | null;
  /** large soft things (fog, aurora): they share the luminance budget with the wash and the glow */
  layers: Layer[];
  items: Item[];
}

export const EMPTY_FRAME: Frame = { wash: 0, glow: null, layers: [], items: [] };
const NEUTRAL_FEEL = { depth: 0.5, lift: 0.5, jitter: 0, soft: 0.5, near: 0.5, irreg: 0.3 };

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
/** WCAG relative luminance of an sRGB colour given as 0 to 255 channels. */
export function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** WCAG's saturated red: R/(R+G+B) at least 0.8 and (R-G-B)*320 above 20. */
export function isSaturatedRed([r, g, b]: [number, number, number]): boolean {
  const sum = r + g + b;
  return sum > 0 && r / sum >= 0.8 && (r - g - b) * 320 > 20;
}
/** 0 when the base colours are saturated red (no pulse), else 1. */
export function redFactor(c: Pick<ResolvedColour, "h" | "s" | "l" | "secondary">): number {
  const reds = [hslToRgb(c.h, c.s, c.l), ...(c.secondary ? [hslToRgb(c.secondary.h, c.secondary.s, c.secondary.l)] : [])];
  return reds.some(isSaturatedRed) ? 0 : 1;
}

/** The share of the view a glow covers (a disc of radius r times the smaller side). `aspect` is width over height. */
export function glowArea(r: number, aspect: number): number {
  const a = aspect > 0 ? aspect : 1;
  return Math.min(1, Math.PI * r * r * (a <= 1 ? a : 1 / a));
}
/** What the large elements add to the luminance swing at the worst pixel: an upper bound on the change of relative luminance. */
export function largeSwing(f: Frame): number {
  return f.wash + (f.glow ? f.glow.a : 0) + f.layers.reduce((s, l) => s + l.a, 0);
}
/** The share of the view an item covers. `minW`: the thinnest line the painter draws, as a fraction of the smaller side (a line is never thinner than a pixel). */
export function itemArea(i: Item, aspect: number, minW = 0): number {
  const a = aspect > 0 ? aspect : 1, k = a <= 1 ? a : 1 / a; // the smaller side over the area
  const w = Math.max(i.w, minW);
  const area = i.kind === "dot" ? Math.PI * i.r * i.r * ((i.soft ?? 0) > 0.05 ? 2.56 : 1) : // a soft dot is painted at 1.6 times its radius
     i.kind === "ring" ? 2 * Math.PI * i.r * w * (i.sq ?? 1) ** 0.5 : i.kind === "wave" ? Math.max(1, a) * (w + 2 * i.r * 0.15) : i.r * w;
  return area * k;
}

/** The flash budget. Idempotent. Scales the large elements down to MAX_LARGE_SWING, and drops small ones past MAX_SMALL_AREA or MAX_ITEMS. */
export function capFrame(f: Frame, aspect = 0.6, minW = 0): Frame {
  let { wash } = f, glow = f.glow ? { ...f.glow, a: Math.max(0, f.glow.a) } : null;
  let layers = f.layers.map((l) => ({ ...l, a: Math.max(0, l.a) }));
  wash = clamp(wash, 0, MAX_LARGE_SWING);
  const swing = wash + (glow ? glow.a : 0) + layers.reduce((s, l) => s + l.a, 0);
  if (swing > MAX_LARGE_SWING + 1e-9) { // the tolerance keeps the function idempotent in floating point
    const k = MAX_LARGE_SWING / swing;
    wash *= k; if (glow) glow.a *= k;
    layers = layers.map((l) => ({ ...l, a: l.a * k }));
  }
  const items: Item[] = [];
  let area = 0;
  for (const i of f.items) {
    if (items.length >= MAX_ITEMS) break;
    const a = itemArea(i, aspect, minW);
    if (area + a > MAX_SMALL_AREA) continue;
    area += a; items.push({ ...i, a: clamp(i.a, 0, MAX_ITEM_ALPHA) });
  }
  return { wash, glow, layers, items };
}

/** The same picture at a fraction of its opacity (the fade with the sound after silence). */
export function scaleFrame(f: Frame, k: number): Frame {
  if (k >= 0.999) return f;
  return { wash: f.wash * k, glow: f.glow ? { ...f.glow, a: f.glow.a * k } : null, layers: f.layers.map((l) => ({ ...l, a: l.a * k })), items: f.items.map((i) => ({ ...i, a: i.a * k })) };
}

export interface FrameInput {
  colour: ResolvedColour;
  bpm: number;
  /** beats from the beat clock (follows `beatsAt`); only the fraction matters for the pulse */
  beats: number;
  /** seconds, for the `free` sync */
  t: number;
  seed?: number;
  /** A scene that is fading out while the colour's own fades in: the picture never swaps a scene at once. `k` is the progress of the new one, 0 to 1. */
  from?: { scene: SceneName | "none"; density?: number; speed?: number; k: number };
}

/** One frame of the motion, before the flash budget. Use `drawFrame` for the capped one. */
export function visualFrame({ colour, bpm, beats, t, seed = 1, from }: FrameInput): Frame {
  const feel = colour.feel ?? NEUTRAL_FEEL;
  const motion = colour.motion;
  const scene = colour.scene ?? "none";
  if (motion === "still" && scene === "none" && (!from || from.scene === "none")) return EMPTY_FRAME;
  const sync = colour.sync ?? (feel.depth >= 0.55 ? "beat" : "phrase");
  const half = bpm > HALF_TIME_BPM ? 0.5 : 1;
  const b = sync === "free" ? t * 1.5 : beats * half;       // free runs at a calm 90 BPM of its own
  const beatIdx = Math.floor(b), beatPh = frac(b);
  const lift2 = (feel.lift - 0.5) * 2;                       // -1 contracts and sinks, +1 expands and rises
  const amp = sync === "phrase" ? 0.8 : clamp(feel.depth);
  const sharp = clamp(feel.jitter * 1.2 + (1 - feel.soft) * 0.3);
  const red = redFactor(colour);

  // the envelope of the motion, 0 to 1: peak on the beat (sine, or a quick decay when sharp), or a slow swell over the phrase
  const env = sync === "phrase"
    ? 0.5 - 0.5 * Math.cos(2 * Math.PI * frac(beats / PHRASE_BEATS))
    : lerp(0.5 + 0.5 * Math.cos(2 * Math.PI * beatPh), (1 - beatPh) ** 2, sharp);
  const kick = (1 - beatPh) ** 2;                            // a short bump right after each beat
  // The beat also shows in the shape, not only in the brightness (which the flash budget holds down): the bar's first beat hits hardest.
  // Phrase sync stays calm: no per-beat bump there.
  const weight = sync === "beat" ? (beatIdx % 4 === 0 ? 1 : 0.7) : 1;
  const hit = sync === "beat" ? kick * weight * amp : 0;
  const accent = sync === "beat" && feel.jitter > 0.4 ? Math.max(0, 1 - Math.abs(beatPh - 0.5) * 8) * 0.03 * feel.jitter : 0; // an off-beat accent for tension

  let wash = 0;
  if (motion === "pulse") wash = (0.04 * amp * env * weight + accent) * red;

  let glow: Frame["glow"] = null;
  if (motion === "pulse") {
    // a pulse also opens a glow on the beat, so joy, closeness and warmth show in it as well as in the other motions
    const size = lerp(0.45, 0.9, feel.near);
    const jx = (hash01(beatIdx, seed) - 0.5) * 0.12 * feel.jitter, jy = (hash01(beatIdx, seed + 7) - 0.5) * 0.12 * feel.jitter;
    glow = { x: 0.5 + jx, y: 0.55 - 0.06 * lift2 + jy, r: size * (1 + 0.25 * lift2 * amp * env + 0.14 * hit), a: 0.05 * amp * env * weight * red, hold: 0.5 * (1 - feel.soft) };
  } else if (motion === "drift" || motion === "breathe") {
    const size = lerp(0.55, 1, feel.near);
    const jx = (hash01(beatIdx, seed) - 0.5) * 0.12 * feel.jitter, jy = (hash01(beatIdx, seed + 7) - 0.5) * 0.12 * feel.jitter;
    const grow = 1 + 0.08 * lift2 * amp * kick + 0.1 * hit;
    if (motion === "drift") {
      const x = 0.5 + 0.35 * Math.sin((2 * Math.PI * beats) / 64) + jx, y = 0.5 + 0.3 * Math.sin((2 * Math.PI * beats) / 83 + 1) - 0.08 * lift2 + jy;
      glow = { x, y, r: 0.55 * size * grow, a: (0.07 + 0.02 * amp * env) * red, hold: 0.5 * (1 - feel.soft) };
    } else {
      const sw = sync === "beat" ? env : 0.5 - 0.5 * Math.cos(2 * Math.PI * frac(beats / PHRASE_BEATS));
      glow = { x: 0.5 + jx, y: 0.55 - 0.06 * lift2 + jy, r: lerp(0.35, 0.6, sw) * size * grow, a: 0.09 * (0.2 + 0.8 * sw) * red, hold: 0.5 * (1 - feel.soft) };
    }
  }

  const clock: Clock = { b, beatPh, beatIdx, beats, kick, hit, amp, lift2, sync, seed, red };
  const now = sceneParts(scene, colour.density ?? 0.4, colour.speed ?? 0.4, feel, clock, from ? clamp(from.k) : 1);
  // A scene made of large soft layers (fog, an aurora, the mist under the rain, the hearth light of the embers) shares the luminance budget: the
  // motion's own wash and glow step back, by a factor that follows the crossfade, never a switch.
  const layered = from && from.k < 0.999 ? clamp(from.k) * (sceneHasLayers(scene) ? 1 : 0) + (1 - clamp(from.k)) * (sceneHasLayers(from.scene) ? 1 : 0) : sceneHasLayers(scene) ? 1 : 0;
  const back = lerp(1, 0.25, layered);
  wash *= back; if (glow) glow = { ...glow, a: glow.a * back };
  const old = from && from.k < 0.999 ? sceneParts(from.scene, from.density ?? 0.4, from.speed ?? 0.4, feel, clock, 1 - clamp(from.k)) : null;
  return { wash, glow, layers: old ? [...now.layers, ...old.layers] : now.layers, items: old ? [...now.items, ...old.items] : now.items };
}

/** The frame to paint: the motion, then the flash budget. */
export function drawFrame(input: FrameInput, aspect = 0.6, minW = 0): Frame {
  return capFrame(visualFrame(input), aspect, minW);
}
