// Shared types and helpers of the picture's frame model (visual.ts, scenes.ts). Pure: no canvas, no clock.

export const SCENES = ["motes", "ripples", "rain", "snow", "embers", "aurora", "waves", "fireflies", "stars", "bubbles", "leaves", "seeds", "tide", "smoke", "clouds", "circuit", "digital", "scope", "vines", "fireworks", "reeds", "network", "flock"] as const;
export type SceneName = (typeof SCENES)[number];

/** A small thing, drawn on top. Together they may cover at most 10% of the view (visual.ts, `capFrame`). */
export interface Item {
  kind: "dot" | "ring" | "streak" | "wave" | "leaf" | "seed" | "path";
  /** centre, 0 to 1 of the width and height. A streak starts here (its tail); a wave's `y` is its resting line */
  x: number; y: number;
  /** radius (dot, ring), length (streak) or amplitude (wave), as a fraction of the smaller side */
  r: number;
  /** stroke width for a ring, a streak or a wave, same unit. The painter never draws thinner than a device pixel; `capFrame` counts that */
  w: number;
  a: number;
  /** dots only: 0 a hard disc, 1 a disc that fades out from the centre. A wave: 1 a sine, 0 a zigzag */
  soft?: number;
  /** hue shift against the field's colour, degrees, and the lightness of the item in percent (default 88) */
  dh?: number; l?: number;
  /** an absolute colour of its own (fire is orange whatever the field's hue is): hue in degrees and saturation in percent */
  hue?: number; sat?: number;
  /** a streak: angle from the vertical in radians (positive leans right), and a tail that fades out behind it */
  ang?: number; tail?: boolean;
  /** a ring: vertical squash; a leaf: how far it has turned away (1 face on, 0.2 nearly edge on) (1 a circle, 0.3 a puddle seen from the side) */
  sq?: number;
  /** a wave: wavelength as a fraction of the width, and phase in radians */
  k?: number; ph?: number;
  /** a path: the points as x0, y0, x1, y1, ... (fractions of the width and height); `w` is its stroke width */
  pts?: number[];
}

/** A large soft thing (an aurora). It counts in the luminance budget with the wash and the glow. */
export interface Layer {
  kind: "blob" | "ribbon" | "tint" | "veil";
  /** blob: centre and radius (fraction of the smaller side). Ribbon: `y` is unused, see `ys` */
  x: number; y: number; r: number;
  /** blob: stretch along x */
  sx?: number;
  /** the most opaque it ever is (a white layer of opacity `a` moves the luminance by at most `a`) */
  a: number;
  dh: number;
  /** saturation and lightness in percent (default 30 and 88: a pale mist). A vivid colour reads at the same opacity where white does not */
  sat?: number; l?: number;
  /** an absolute hue (tint layers, a vivid aurora) and the luminance swing per unit of opacity of this colour over the field (default 1, the white bound); see colour-math.ts */
  hue?: number; k?: number;
  /** ribbon: the lower edge of the curtain per column (0 to 1 of the height), its height, and a 0 to 1 strength per column */
  ys?: number[]; h?: number; cols?: number[];
  /** veil: a low-resolution field of 0 to 1 (rows from the top, `gw` columns by `gh` rows), painted smoothed up over the whole view in the layer's one colour at opacity `a` times the field. Counts at its full `a * k` everywhere. */
  gw?: number; gh?: number; grid?: number[];
}

export interface SceneOut { items: Item[]; layers: Layer[] }

/** What the scenes know about the beat and the mood. */
export interface Clock {
  /** beats, at half-time above 180 BPM, or seconds*1.5 for `free` sync */
  b: number; beatPh: number; beatIdx: number; beats: number;
  /** a short bump right after each beat, and the bump weighted by the bar and the depth */
  kick: number; hit: number; amp: number; lift2: number;
  sync: "beat" | "phrase" | "free"; seed: number;
  /** 0 when the colours are saturated red: no large element may pulse then (the beat shows in the small ones) */
  red: number;
  /** width over height of the view (the waves keep their swing under the gap between lines) */
  aspect: number;
  /** the field's hue and base colours (the primary and the secondary), for scenes that choose a colour that reads against it */
  h: number; s: number; bases: Array<[number, number, number]>;
}
export type Feel = { depth: number; lift: number; jitter: number; soft: number; near: number; irreg: number };

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const frac = (x: number) => x - Math.floor(x);
/** A deterministic number in [0, 1) from two integers. */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
/** Smooth value noise in [-1, 1]: a pure function of the position and a seed, so every listener gets the same curve. */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash01(i, seed), hash01(i + 1, seed), u) * 2 - 1;
}
/** Smooth 2-D value noise in [-1, 1], and a sum of octaves of it (also in [-1, 1]): pure functions of the position and a seed. */
export function noise2(x: number, y: number, seed: number): number {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), s = seed * 131;
  return lerp(lerp(hash01(i + s, j), hash01(i + 1 + s, j), u), lerp(hash01(i + s, j + 1), hash01(i + 1 + s, j + 1), u), v) * 2 - 1;
}
export function fbm2(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) { sum += amp * noise2(x * f, y * f, seed + o * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
