import type { ResolvedColour } from "@sonorous/engine";

// The picture that moves over the colours (docs/visuals.md). Everything here is a pure function of the colour, the tempo, the beat
// count and the time, so every listener sees the same thing, and a test can check the flash rule without a canvas.
//
// The flash rule (docs/safety.md): the beat pulse is designed to stay under the flash threshold by itself, at any tempo.
//   - Large elements (the wash over the whole field, the glow) together swing the relative luminance by at most MAX_LARGE_SWING (0.09).
//     A white layer of opacity `a` over a base moves the luminance by at most `a`, so the sum of the opacities is a safe bound.
//     WCAG 2.3.1 counts a flash from a 10% change, so nothing here is one, however fast it repeats.
//   - Saturated red gets no pulse at all.
//   - Small elements (motes, rings, streaks) may be faster and brighter, but together cover at most MAX_SMALL_AREA of the view.
//   - Above HALF_TIME_BPM the beat motion runs at half-time. That is for looks: the cap above is what keeps it safe.

export const PHRASE_BEATS = 16;       // 4 bars of 4 beats (4/4 is assumed, there is no meter)
export const MAX_LARGE_SWING = 0.09;
export const MAX_SMALL_AREA = 0.1;
export const MAX_ITEMS = 48;
export const MAX_ITEM_ALPHA = 0.5;
export const HALF_TIME_BPM = 180;

export interface Item {
  kind: "dot" | "ring" | "streak";
  /** centre, 0 to 1 of the width and height */
  x: number; y: number;
  /** radius (dot, ring) or length (streak), as a fraction of the smaller side */
  r: number;
  /** stroke width for a ring or a streak, same unit */
  w: number;
  a: number;
}
export interface Frame {
  /** opacity of a white layer over the whole field */
  wash: number;
  /** a white radial highlight; `hold` is the fraction of the radius that stays at full opacity (hard edge) */
  glow: { x: number; y: number; r: number; a: number; hold: number } | null;
  items: Item[];
}

export const EMPTY_FRAME: Frame = { wash: 0, glow: null, items: [] };
const NEUTRAL_FEEL = { depth: 0.5, lift: 0.5, jitter: 0, soft: 0.5, near: 0.5, irreg: 0.3 };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const frac = (x: number) => x - Math.floor(x);
/** A deterministic number in [0, 1) from two integers. */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

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
/** What the large elements add to the luminance swing: a safe upper bound on the change of relative luminance. */
export function largeSwing(f: Frame, aspect: number): number {
  return f.wash + (f.glow ? f.glow.a * glowArea(f.glow.r, aspect) : 0);
}
function itemArea(i: Item, aspect: number): number {
  const a = aspect > 0 ? aspect : 1, k = a <= 1 ? a : 1 / a; // the smaller side over the area
  const area = i.kind === "dot" ? Math.PI * i.r * i.r : i.kind === "ring" ? 2 * Math.PI * i.r * i.w : i.r * i.w;
  return area * k;
}

/** The flash budget. Idempotent. Scales the large elements down to MAX_LARGE_SWING, and drops small ones past MAX_SMALL_AREA or MAX_ITEMS. */
export function capFrame(f: Frame, aspect = 0.6): Frame {
  let { wash } = f, glow = f.glow ? { ...f.glow } : null;
  wash = clamp(wash, 0, MAX_LARGE_SWING);
  const swing = wash + (glow ? glow.a * glowArea(glow.r, aspect) : 0);
  if (swing > MAX_LARGE_SWING + 1e-9) { // the tolerance keeps the function idempotent in floating point
    const k = MAX_LARGE_SWING / swing;
    wash *= k; if (glow) glow.a *= k;
  }
  const items: Item[] = [];
  let area = 0;
  for (const i of f.items) {
    if (items.length >= MAX_ITEMS) break;
    const a = itemArea(i, aspect);
    if (area + a > MAX_SMALL_AREA) continue;
    area += a; items.push({ ...i, a: clamp(i.a, 0, MAX_ITEM_ALPHA) });
  }
  return { wash, glow, items };
}

export interface FrameInput {
  colour: ResolvedColour;
  bpm: number;
  /** beats from the beat clock (follows `beatsAt`); only the fraction matters for the pulse */
  beats: number;
  /** seconds, for the `free` sync */
  t: number;
  seed?: number;
}

/** One frame of the motion, before the flash budget. Use `drawFrame` for the capped one. */
export function visualFrame({ colour, bpm, beats, t, seed = 1 }: FrameInput): Frame {
  const feel = colour.feel ?? NEUTRAL_FEEL;
  const motion = colour.motion;
  const scene = colour.scene ?? "none";
  if (motion === "still" && scene === "none") return EMPTY_FRAME;
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
  const accent = sync === "beat" && feel.jitter > 0.4 ? Math.max(0, 1 - Math.abs(beatPh - 0.5) * 8) * 0.03 * feel.jitter : 0; // an off-beat accent for tension

  let wash = 0;
  if (motion === "pulse") wash = (0.07 * amp * env + accent) * red;

  let glow: Frame["glow"] = null;
  if (motion === "drift" || motion === "breathe") {
    const size = lerp(0.55, 1, feel.near);
    const jx = (hash01(beatIdx, seed) - 0.5) * 0.12 * feel.jitter, jy = (hash01(beatIdx, seed + 7) - 0.5) * 0.12 * feel.jitter;
    const grow = 1 + 0.08 * lift2 * amp * kick;
    if (motion === "drift") {
      const x = 0.5 + 0.35 * Math.sin((2 * Math.PI * beats) / 64) + jx, y = 0.5 + 0.3 * Math.sin((2 * Math.PI * beats) / 83 + 1) - 0.08 * lift2 + jy;
      glow = { x, y, r: 0.55 * size * grow, a: (0.07 + 0.02 * amp * env) * red, hold: 0.5 * (1 - feel.soft) };
    } else {
      const sw = sync === "beat" ? env : 0.5 - 0.5 * Math.cos(2 * Math.PI * frac(beats / PHRASE_BEATS));
      glow = { x: 0.5 + jx, y: 0.55 - 0.06 * lift2 + jy, r: lerp(0.35, 0.6, sw) * size * grow, a: 0.09 * (0.2 + 0.8 * sw) * red, hold: 0.5 * (1 - feel.soft) };
    }
  }

  return { wash, glow, items: scene === "none" ? [] : sceneItems(colour, scene, feel, { b, beatPh, beatIdx, beats, kick, amp, lift2, sync, half, seed }) };
}

interface Clock { b: number; beatPh: number; beatIdx: number; beats: number; kick: number; amp: number; lift2: number; sync: "beat" | "phrase" | "free"; half: number; seed: number }

function sceneItems(colour: ResolvedColour, scene: "motes" | "ripples" | "rain", feel: NonNullable<ResolvedColour["feel"]>, c: Clock): Item[] {
  const density = clamp(colour.density ?? 0.4), speed = clamp(colour.speed ?? 0.4);
  const items: Item[] = [];
  if (scene === "motes") {
    const n = Math.round(lerp(4, 36, density)), travel = c.b * lerp(0.004, 0.02, speed), dir = c.lift2 >= 0 ? -1 : 1;
    const rs = lerp(0.008, 0.026, feel.near);
    for (let i = 0; i < n; i++) {
      const x0 = hash01(i, c.seed), y0 = hash01(i, c.seed + 1), sz = 0.7 + 0.6 * hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3);
      const y = frac(y0 + dir * travel), x = x0 + 0.03 * Math.sin(2 * Math.PI * (c.b / 32 + ph));
      const twinkle = c.sync === "free" ? 0 : (1 - frac(c.b + ph * feel.irreg)) ** 2;
      items.push({ kind: "dot", x, y, r: rs * sz, w: 0, a: 0.3 * Math.sin(Math.PI * y) * (1 + 0.6 * c.amp * twinkle) });
    }
  } else if (scene === "ripples") {
    const period = c.sync === "beat" ? 1 : 4, life = lerp(1.5, 3.2, density), idx = c.b / period, last = Math.floor(idx);
    for (let k = last; k > last - Math.ceil(life) - 1; k--) {
      const age = (idx - k) * (1 + speed); // in beats of life
      if (age < 0 || age > life) continue;
      const u = age / life, off = (feel.jitter + feel.irreg) * 0.12;
      items.push({
        kind: "ring", x: 0.5 + (hash01(k, c.seed) - 0.5) * off, y: 0.55 + (hash01(k, c.seed + 5) - 0.5) * off,
        r: 0.04 + 0.5 * u, w: lerp(0.002, 0.006, feel.near), a: 0.24 * (1 - u) * (0.4 + 0.6 * c.amp),
      });
    }
  } else {
    const n = Math.round(lerp(4, 30, density)), travel = c.b * lerp(0.02, 0.1, speed), len = lerp(0.03, 0.08, speed + 0.2 * feel.near);
    for (let i = 0; i < n; i++) {
      const y = frac(hash01(i, c.seed + 1) + travel * (0.7 + 0.6 * hash01(i, c.seed + 2)));
      items.push({ kind: "streak", x: hash01(i, c.seed), y, r: len, w: 0.002, a: 0.22 * Math.sin(Math.PI * y) });
    }
  }
  return items;
}

/** The frame to paint: the motion, then the flash budget. */
export function drawFrame(input: FrameInput, aspect = 0.6): Frame {
  return capFrame(visualFrame(input), aspect);
}
