import type { ResolvedColour } from "@sonorous/engine";
import { clamp, frac, hash01, lerp, type Clock, type Item, type Layer, type SceneName } from "./scene-kit";
import { sceneParts } from "./scenes";
import { hslToRgb, isSaturatedRed, luminanceSwingPerAlpha, relLuminance, type Rgb } from "./colour-math";
import { colourPlay } from "./gradients";

export { hslToRgb, isSaturatedRed, relLuminance } from "./colour-math";

export { hash01, SCENES, GLYPHS, type Item, type Layer, type SceneName } from "./scene-kit";

// The picture that moves over the colours (docs/visuals.md). Everything here is a pure function of the colour, the tempo, the beat
// count and the time, so every listener sees the same thing, and a test can check the flash rule without a canvas.
//
// The flash rule is lifted for the large elements (Gael, 2026-11-13, docs/safety.md): MAX_LARGE_SWING (0.09) is the old target and `largeSwing` still measures it, but nothing scales the wash, the glow or the layers to it.
// What `capFrame` still does: small elements (motes, rings, streaks) together cover at most MAX_SMALL_AREA of the view, and at most MAX_ITEMS of them.
//   - Above HALF_TIME_BPM the beat motion runs at half-time, for looks.

export const PHRASE_BEATS = 16;       // 4 bars of 4 beats (4/4 is assumed, there is no meter)
export const MAX_LARGE_SWING = 0.09;
export const MAX_SMALL_AREA = 0.1;
export const MAX_ITEMS = 400;
export const MAX_ITEM_ALPHA = 0.5;
export const HALF_TIME_BPM = 180;

export interface Frame {
  /** opacity of a white layer over the whole field */
  wash: number;
  /** a white radial highlight; `hold` is the fraction of the radius that stays at full opacity (hard edge) */
  glow: { x: number; y: number; r: number; a: number; hold: number } | null;
  /** large soft things (aurora): they share the luminance budget with the wash and the glow */
  layers: Layer[];
  items: Item[];
}

/** Scenes made of light: on a bright base colour they vanish (nothing is lighter than a bright yellow). A darker veil goes under them, as dark as the base is bright. */
const LIGHT_SCENES = new Set<string>(["aurora", "sunbeam", "stars", "fireflies", "fireworks", "embers", "warp", "motes", "lightning", "cracks"]);
const ONE = new Float32Array([1]);
/** How much darker the base goes under a light scene, 0 to 0.65: from a relative luminance of 0.25 (0.12 for the aurora, which needs a dark sky) up to the full 0.65 at about 0.7. */
export function lightSceneDim(scene: string, bases: Rgb[]): number {
  if (!LIGHT_SCENES.has(scene) || !bases.length) return 0;
  const lum = bases.reduce((q, b) => q + relLuminance(b), 0) / bases.length;
  return clamp((lum - (scene === "aurora" ? 0.12 : 0.25)) * 1.5, 0, 0.65);
}
const DARK = (colour: Pick<ResolvedColour, "h">): Rgb => hslToRgb(colour.h, 0.3, 0.05);
const arc = (a: number, b: number, p: number) => (((a + ((((b - a) % 360) + 540) % 360 - 180) * p) % 360) + 360) % 360;
/** The colour a fraction `p` of the way from `a` to `b`: hue along the short arc, saturation, lightness, the second colour and the feel by line, everything else (scene, motion, shape...) from `b`.
 *  The player glides the colour that the scene and the lights are drawn from over the state's transition, so a new mood never makes the picture jump while the CSS base colour glides. */
export function blendColour(a: ResolvedColour, b: ResolvedColour, p: number): ResolvedColour {
  if (p >= 0.999) return b;
  if (p <= 0.001) return { ...b, h: a.h, s: a.s, l: a.l, ...(a.secondary && b.secondary ? { secondary: a.secondary } : {}), ...(a.feel && b.feel ? { feel: a.feel } : {}), pulseHz: a.pulseHz };
  const out: ResolvedColour = { ...b, h: arc(a.h, b.h, p), s: lerp(a.s, b.s, p), l: lerp(a.l, b.l, p), pulseHz: lerp(a.pulseHz, b.pulseHz, p) };
  if (a.secondary && b.secondary) out.secondary = { h: arc(a.secondary.h, b.secondary.h, p), s: lerp(a.secondary.s, b.secondary.s, p), l: lerp(a.secondary.l, b.secondary.l, p) };
  if (a.feel && b.feel) out.feel = { depth: lerp(a.feel.depth, b.feel.depth, p), lift: lerp(a.feel.lift, b.feel.lift, p), jitter: lerp(a.feel.jitter, b.feel.jitter, p), soft: lerp(a.feel.soft, b.feel.soft, p), near: lerp(a.feel.near, b.feel.near, p), irreg: lerp(a.feel.irreg, b.feel.irreg, p) };
  return out;
}
export const EMPTY_FRAME: Frame = { wash: 0, glow: null, layers: [], items: [] };
const NEUTRAL_FEEL = { depth: 0.5, lift: 0.5, jitter: 0, soft: 0.5, near: 0.5, irreg: 0.3 };

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
const piece = (t: number, stops: ReadonlyArray<readonly [number, number]>) => { if (t >= 1) return 0; for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, a0] = stops[i - 1], [t1, a1] = stops[i]; return a0 + (a1 - a0) * ((t - t0) / (t1 - t0 || 1)); } return 0; };
const TINT_FALL = [[0, 1], [0.55, 0.5], [1, 0]] as const, BLOB_FALL = [[0, 1], [0.3, 0.85], [1, 0]] as const;
/** What the large elements add to the luminance swing at one point of the view (x, y as fractions): the wash, the glow and every layer, each at its own opacity, falloff and swing per unit of
 *  opacity (`k`), as the painter draws them. An upper bound on the change of relative luminance there. A ribbon or a veil counts at its full opacity everywhere. */
export function swingAt(f: Frame, px: number, py: number, aspect = 0.6): number {
  const asp = aspect > 0 ? aspect : 0.6, m = Math.min(asp, 1);
  let sw = f.wash;
  if (f.glow) { const g = f.glow, d = Math.hypot((px - g.x) * asp, py - g.y) / m / Math.max(1e-6, g.r); sw += piece(d, [[0, g.a], [Math.min(0.95, g.hold), g.a], [1, 0]]); }
  for (const l of f.layers) {
    if (l.kind === "ribbon" || l.kind === "veil") { sw += l.a * (l.k ?? 1); continue; }
    const d = Math.hypot(((px - l.x) * asp) / (l.sx ?? 1), py - l.y) / m / Math.max(1e-6, l.r);
    sw += l.a * (l.k ?? 1) * piece(d, l.kind === "tint" ? TINT_FALL : BLOB_FALL);
  }
  return sw;
}
/** The swing at the worst pixel: the largest `swingAt` over a grid of the view and the centres of the glow and the layers (where the falloffs peak). Overlapping lights add where they overlap,
 *  and only there, which is what the rule says ("at the worst pixel"). */
export function largeSwing(f: Frame, aspect = 0.6): number {
  let worst = 0;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) worst = Math.max(worst, swingAt(f, (i + 0.5) / 7, (j + 0.5) / 9, aspect));
  if (f.glow) worst = Math.max(worst, swingAt(f, f.glow.x, f.glow.y, aspect));
  for (const l of f.layers) if (l.kind !== "ribbon" && l.kind !== "veil") worst = Math.max(worst, swingAt(f, clamp(l.x), clamp(l.y), aspect));
  return worst;
}
function pathArea(i: Item, aspect: number, w: number): number {
  const p = i.pts ?? [], X = aspect >= 1 ? aspect : 1, Y = aspect < 1 ? 1 / aspect : 1; // the view in units of its smaller side
  let len = 0; for (let k = 2; k < p.length; k += 2) len += Math.hypot((p[k] - p[k - 2]) * X, (p[k + 1] - p[k - 1]) * Y);
  return len * w;
}
/** The share of the view an item covers. `minW`: the thinnest line the painter draws, as a fraction of the smaller side (a line is never thinner than a pixel). */
export function itemArea(i: Item, aspect: number, minW = 0): number {
  const a = aspect > 0 ? aspect : 1, k = a <= 1 ? a : 1 / a; // the smaller side over the area
  const w = Math.max(i.w, minW);
  const area = i.kind === "dot" ? Math.PI * i.r * i.r * ((i.soft ?? 0) > 0.05 ? 2.56 : 1) : // a soft dot is painted at 1.6 times its radius
     i.kind === "ring" ? 2 * Math.PI * i.r * w * (i.sq ?? 1) ** 0.5 : i.kind === "path" ? pathArea(i, a, w) : i.kind === "leaf" ? i.r * i.r : i.kind === "seed" ? Math.PI * i.r * i.r : i.kind === "wave" ? Math.max(1, a) * w * (1 + 4 * i.r) : i.r * w;
  return area * k;
}

/** What is left of the flash budget. Idempotent. Drops small elements past MAX_SMALL_AREA or MAX_ITEMS; the large elements are no longer capped (Gael, 2026-11-13). */
export function capFrame(f: Frame, aspect = 0.6, minW = 0): Frame {
  let { wash } = f, glow = f.glow ? { ...f.glow, a: Math.max(0, f.glow.a) } : null;
  let layers = f.layers.map((l) => ({ ...l, a: Math.max(0, l.a) }));
  wash = Math.max(0, wash); // no ceiling on the large elements any more (Gael, 2026-11-13): `MAX_LARGE_SWING` is the old target and `largeSwing` still measures it, but nothing is scaled down to it
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
  /** how many times the scene has started on this device (the player counts), for scenes that roll a look at their start */
  epoch?: number;
  /** false: no gradient (colour play, the slow moving colours). The listener can turn it off */
  play?: boolean;
  /** false: no scene. The listener can turn it off; the base colour stays */
  visuals?: boolean;
  /** width over height of the view, when known */
  aspect?: number;
  /** width of the picture in pixels, when known: the veil scenes use it to pick how fine their field is */
  px?: number;
  /** A scene that is fading out while the colour's own fades in: the picture never swaps a scene at once. `k` is the progress of the new one, 0 to 1. */
  from?: { scene: SceneName | "none"; density?: number; speed?: number; epoch?: number; k: number };
}

/** One frame of the motion, before the flash budget. Use `drawFrame` for the capped one. */
export function visualFrame(input: FrameInput): Frame {
  const { colour, bpm, beats, t, seed = 1 } = input, from = input.visuals === false ? undefined : input.from;
  const feel = colour.feel ?? NEUTRAL_FEEL;
  const motion = colour.motion;
  const scene = input.visuals === false ? "none" : colour.scene ?? "none";
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

  // No wash and no glow any more (Gael, 2026-11-13): the picture is a base colour, a slow gradient (colour play) and the scene. The beat shows in the scene.
  const wash = 0, glow: Frame["glow"] = null;

  const shownBases: Rgb[] = [hslToRgb(colour.h, colour.s, colour.l), ...(colour.secondary ? [hslToRgb(colour.secondary.h, colour.secondary.s, colour.secondary.l)] : [])];
  // Under a light scene on a bright base a dark veil is painted over the base colour (first layer), so every scene and the gradient work against the darkened colour: `bases` is what the eye then sees.
  const dim = Math.max(lightSceneDim(scene, shownBases), from ? lightSceneDim(from.scene, shownBases) : 0), dk = DARK(colour);
  const bases: Rgb[] = dim > 0.01 ? shownBases.map((b) => [b[0] + (dk[0] - b[0]) * dim, b[1] + (dk[1] - b[1]) * dim, b[2] + (dk[2] - b[2]) * dim] as Rgb) : shownBases;
  const clock: Clock = { b, beatPh, beatIdx, beats, kick, hit, amp, lift2, sync, seed, epoch: input.epoch ?? 0, red, aspect: input.aspect ?? 0.6, px: input.px ?? 600, bps: sync === "free" ? 1.5 : (bpm * half) / 60, h: colour.h, s: colour.s, bases };
  const now = sceneParts(scene, colour.density ?? 0.4, colour.speed ?? 0.4, feel, clock, from ? clamp(from.k) : 1);
  const old = from && from.k < 0.999 ? sceneParts(from.scene, from.density ?? 0.4, from.speed ?? 0.4, feel, { ...clock, epoch: from.epoch ?? 0 }, 1 - clamp(from.k)) : null;
  const play = motion === "still" || input.play === false ? [] : colourPlay(colour, feel, clock);
  const under: Layer[] = dim > 0.01 ? [{ kind: "veil", x: 0.5, y: 0.5, r: 1, a: dim, dh: 0, hue: colour.h, sat: 30, l: 5, k: Math.max(0.01, ...shownBases.map((b) => luminanceSwingPerAlpha(b, dk))), gw: 1, gh: 1, grid: ONE }] : [];
  return { wash, glow, layers: [...under, ...play, ...(old ? [...now.layers, ...old.layers] : now.layers)], items: old ? [...now.items, ...old.items] : now.items };
}

/** The frame to paint: the motion, then the flash budget. */
export function drawFrame(input: FrameInput, aspect = 0.6, minW = 0): Frame {
  return capFrame(visualFrame({ ...input, aspect }), aspect, minW);
}
