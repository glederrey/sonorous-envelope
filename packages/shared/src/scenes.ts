import { matchedLayer } from "./colour-math";
import { clamp, frac, hash01, lerp, noise1, type Clock, type Feel, type Item, type Layer, type SceneName, type SceneOut } from "./scene-kit";

// The scenes (docs/visuals.md): what moves over the colours. Each is a pure function of the clock, the mood's feel and the seed.
// The mood shapes the form, not only the hue (a sad rain is thin, straight and slow; an angry one is slanted, fast and ragged),
// so the emotions can be told apart with the colour taken away. Sizes are fractions of the smaller side. Speeds count in beats, so a
// slow piece gets a slow picture.

const EMPTY: SceneOut = { items: [], layers: [] };
/** Alpha of the scene when it fades in or out (visual.ts, `from`). */
const fade = (o: SceneOut, k: number): SceneOut => k >= 0.999 ? o : { items: o.items.map((i) => ({ ...i, a: i.a * k })), layers: o.layers.map((l) => ({ ...l, a: l.a * k })) };

/** Scenes made partly of large layers: the motion's own wash and glow step back for them (visual.ts). One rule for the old and the new scene of a crossfade. */
export const sceneHasLayers = (s: SceneName | "none") => s === "aurora" || s === "rain" || s === "embers";
/** How much of the motion's own wash and glow is left under a scene: 1 with none, a quarter under layers, almost nothing under an aurora (it needs the whole budget). */
export const sceneBack = (s: SceneName | "none") => s === "aurora" ? 0.08 : sceneHasLayers(s) ? 0.25 : 1;

export function sceneParts(scene: SceneName | "none", density: number, speed: number, feel: Feel, c: Clock, k = 1): SceneOut {
  if (scene === "none" || k <= 0.001) return EMPTY;
  const d = clamp(density), v = clamp(speed);
  const out = scene === "motes" ? motes(d, v, feel, c)
    : scene === "ripples" ? ripples(d, v, feel, c)
    : scene === "rain" ? rain(d, v, feel, c)
    : scene === "snow" ? snow(d, v, feel, c)
    : scene === "embers" ? embers(d, v, feel, c)
    : scene === "aurora" ? aurora(d, v, feel, c)
    : scene === "waves" ? waves(d, v, feel, c)
    : scene === "fireflies" ? fireflies(d, v, feel, c)
    : scene === "lanterns" ? lanterns(d, v, feel, c)
    : scene === "seeds" ? seeds(d, v, feel, c)
    : scene === "tide" ? tide(d, v, feel, c)
    : scene === "stars" ? stars(d, v, feel, c)
    : scene === "bubbles" ? bubbles(d, v, feel, c)
    : leaves(d, v, feel, c);
  return fade(out, k);
}

function motes(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(4, 36, density)), travel = c.b * lerp(0.004, 0.02, speed), dir = c.lift2 >= 0 ? -1 : 1;
  const rs = lerp(0.008, 0.026, feel.near), sharpShare = 0.25 + 0.3 * feel.jitter;
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = hash01(i, c.seed), y0 = hash01(i, c.seed + 1), ph = hash01(i, c.seed + 3), cls = hash01(i, c.seed + 4);
    // three kinds, so the field is not a sheet of identical discs: a few large soft lights, small sharp points (more with tension), the rest in between
    const big = cls > 0.85, tiny = cls < sharpShare * 0.6;
    const sz = big ? 2.2 + 0.8 * hash01(i, c.seed + 2) : tiny ? 0.45 : 0.7 + 0.6 * hash01(i, c.seed + 2);
    const soft = big ? 1 : tiny ? 0 : clamp(feel.soft * (0.4 + 0.8 * hash01(i, c.seed + 6)));
    const y = frac(y0 + dir * travel * (big ? 0.6 : 1)), x = x0 + 0.03 * Math.sin(2 * Math.PI * (c.b / 32 + ph));
    const twinkle = c.sync === "free" ? 0 : (1 - frac(c.b + ph * feel.irreg)) ** 2;
    items.push({ kind: "dot", x, y: y - 0.01 * dir * c.hit, r: rs * sz * (1 + 0.4 * c.hit), w: 0, soft,
      a: (big ? 0.2 : tiny ? 0.5 : 0.4) * Math.sin(Math.PI * y) * (1 + 0.6 * c.amp * twinkle) });
  }
  return { items, layers: [] };
}

function ripples(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const period = c.sync === "beat" ? 1 : 4, life = lerp(2.5, 4.5, density), idx = c.b / period, last = Math.floor(idx);
  const items: Item[] = [];
  for (let k = last; k > last - Math.ceil(life) - 1; k--) {
    const age = (idx - k) * (1 + speed); // in beats of life
    if (age < 0 || age > life) continue;
    const u = age / life, off = 0.04 + (feel.jitter + feel.irreg) * 0.25; // a calm, measured mood keeps the rings near the middle; a spontaneous or tense one scatters them
    items.push({
      kind: "ring", x: 0.5 + (hash01(k, c.seed) - 0.5) * off, y: 0.55 + (hash01(k, c.seed + 5) - 0.5) * off,
      r: 0.04 + 0.5 * u, w: lerp(0.003, 0.008, feel.near) * (c.sync === "beat" && k % 4 === 0 ? 1.5 : 1), a: 0.45 * (1 - u) ** 0.7 * (0.4 + 0.6 * c.amp) * (c.sync === "beat" ? (k % 4 === 0 ? 1.25 : 0.8) : 1),
    });
  }
  return { items, layers: [] };
}

/** Fine rain: many thin drops with depth (near ones are longer, brighter, faster and thicker), a splash where the near ones land, a mist at the foot.
 *  The mood sets the slant (tension and wind), the weight (joy lightens it) and the speed of the fall. */
function rain(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(22, 110, density)), items: Item[] = [], FALL = 0.86;
  const wind = (0.04 + 0.5 * feel.jitter + 0.1 * feel.irreg) * (1 + 0.3 * noise1(c.b / 9, c.seed + 11)); // radians from the vertical
  const light = 1 - 0.25 * Math.max(0, c.lift2);
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2); // 0 far, 1 near
    const cycle = lerp(3.6, 1.1, speed) / (0.55 + 0.9 * z); // beats a drop takes from the top to the ground
    const t = c.b / cycle + hash01(i, c.seed + 3), cyc = Math.floor(t), u = t - cyc;
    const x0 = hash01(i + cyc * 977, c.seed), landY = 0.6 + 0.35 * z;
    if (u < FALL) {
      const s = u / FALL, len = lerp(0.028, 0.085, z) * lerp(0.8, 1.45, speed) * light * (1 + 0.35 * c.hit);
      const headY = lerp(-0.04, landY, s), headX = x0 + Math.tan(wind) * (headY + 0.04) * 0.6;
      items.push({ kind: "streak", x: headX - Math.sin(wind) * len * 0.6, y: headY - Math.cos(wind) * len, r: len, w: lerp(0.0009, 0.0022, z), ang: wind, tail: true,
        a: lerp(0.14, 0.42, z) * (0.85 + 0.35 * c.hit) * Math.min(1, headY * 12 + 0.5), l: 90 });
    } else if (z > 0.4 && density > 0.1) {
      const s = (u - FALL) / (1 - FALL), landX = x0 + Math.tan(wind) * (landY + 0.04) * 0.6;
      items.push({ kind: "ring", x: landX, y: landY, r: (0.006 + 0.022 * z) * (0.35 + s), w: 0.0012 + 0.0008 * z, sq: 0.32, a: 0.36 * z * (1 - s) ** 1.6 });
    }
  }
  // the mist at the foot is always in the list (it grows in with the density), so the budget's step-back never switches on at once
  const layers: Layer[] = [{ kind: "blob", x: 0.5 + 0.2 * noise1(c.b / 40, c.seed + 5), y: 1.02, r: lerp(0.6, 0.95, density), a: 0.035 * (0.6 + density) * clamp((density - 0.1) / 0.2), dh: 0 }];
  return { items, layers };
}

/** Snow: round soft flakes with depth, falling slowly and swaying; the sway grows with joy and spontaneity (a flurry), and is nil when still and low. */
function snow(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(10, 80, density)), items: Item[] = [];
  const sway = 0.012 + 0.05 * clamp(0.5 * Math.max(0, c.lift2) + 0.5 * feel.irreg + 0.5 * feel.jitter);
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3);
    const y = frac(hash01(i, c.seed + 1) + c.b * lerp(0.03, 0.09, speed) * (0.45 + 0.75 * z));
    const x = hash01(i, c.seed) + sway * (Math.sin(2 * Math.PI * (c.b / (9 + 14 * ph) + ph)) + 0.5 * noise1(c.b / 6 + i * 3.1, c.seed + 8));
    items.push({ kind: "dot", x, y, r: lerp(0.0028, 0.0105, z) * lerp(0.8, 1.5, feel.near) * (1 + 0.25 * c.hit), w: 0, soft: clamp(0.35 + 0.5 * feel.soft),
      a: lerp(0.18, 0.55, z) * Math.min(1, Math.sin(Math.PI * y) * 3.5), l: 95 });
  }
  return { items, layers: [] };
}

/** Embers: sparks that rise from the floor and cool as they go. Tender: few, big, soft and slow. Angry: many, sharp, fast, flickering and jerking. */
function embers(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(8, 90, density)), items: Item[] = [];
  const life0 = lerp(11, 4.5, speed); // the rate depends on the speed only: a mood that drifts a little must not move every spark
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), life = life0 * (0.7 + 0.6 * z), t = c.b / life + hash01(i, c.seed + 3), cyc = Math.floor(t), u = t - cyc;
    const top = 0.1 + 0.5 * hash01(i + cyc * 977, c.seed + 4), x0 = hash01(i + cyc * 977, c.seed);
    const y = lerp(1.03, top, u ** 0.8);
    const wob = (0.012 + 0.05 * feel.jitter) * noise1(c.b * 0.3 + i * 3.7, c.seed + 6) + 0.006 * feel.jitter * (hash01(Math.floor(c.b * 3) + i * 7, c.seed + 9) - 0.5);
    const flick = lerp(0.85 + 0.15 * Math.sin(c.b * 2 + i), 1 - 0.55 * hash01(Math.floor(c.b * 4) + i * 13, c.seed + 10), feel.jitter);
    // fire is orange whatever the field's hue: hot ones are pale yellow, cooling ones deep orange
    items.push({ kind: "dot", x: x0 + wob, y, r: lerp(0.005, 0.0135, feel.near) * (0.55 + 0.7 * z) * (1 - 0.5 * u) * (1 + 0.45 * c.hit), w: 0, soft: clamp(feel.soft * 1.1),
      a: 0.8 * (1 - u) ** lerp(1.1, 0.6, feel.jitter) * flick * Math.min(1, (1.03 - y) * 14), hue: 18 + 28 * (1 - u) * (0.6 + 0.4 * z), sat: 95, l: 58 + 22 * (1 - u) });
  }
  const layers: Layer[] = [{ kind: "blob", x: 0.5 + 0.1 * noise1(c.b / 16, c.seed + 12), y: 1.12, r: lerp(0.55, 0.85, feel.near), a: 0.03 + 0.018 * c.hit * c.red * (0.5 + feel.jitter), dh: -8 }]; // a large element: it pulses on the beat unless the field is saturated red
  return { items, layers };
}

/** Aurora: one curtain of vivid colour hanging from a wavering lower edge, with bright rays inside it. The curtain is painted at the lightness that changes the field's
 *  brightness least, so it can be strongly opaque (it is the colour that reads, not the light); the rays are small items, which have a budget of their own. */
function aurora(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const N = 48, ys: number[] = [], cols: number[] = [], items: Item[] = [];
  const drift = lerp(0.012, 0.06, speed), swell = c.sync === "free" ? 0.85 : 0.75 + 0.25 * (0.5 - 0.5 * Math.cos(2 * Math.PI * frac(c.beats / 16)));
  const h = lerp(0.3, 0.52, 1 - feel.jitter * 0.6);
  for (let i = 0; i < N; i++) {
    ys.push(0.52 + 0.08 * noise1(i * 0.12 + c.b * drift, c.seed) + 0.03 * Math.sin(i * 0.25 + c.b * drift * 2));
    cols.push(clamp(0.55 + 0.9 * noise1(i * 0.3 - c.b * drift * 0.8, c.seed + 20) + feel.jitter * 0.4 * noise1(i * 0.9 + c.b * 0.7, c.seed + 30)));
  }
  // two colours that read against the field and against each other: the field's hue turned by a third and by two thirds of the wheel
  const hueA = (c.h + 120) % 360, hueB = (c.h + 240) % 360, mA = matchedLayer(c.bases, hueA, 0.9);
  const rays = Math.round(lerp(10, 30, density));
  for (let r = 0; r < rays; r++) {
    const col = Math.floor(hash01(r, c.seed + 40) * N), k = cols[col], len = h * (0.55 + 0.6 * hash01(r, c.seed + 41)) * k;
    if (k < 0.25) continue;
    const flick = 0.65 + 0.35 * Math.sin(2 * Math.PI * (c.b / (5 + 6 * hash01(r, c.seed + 42)) + hash01(r, c.seed + 43)));
    items.push({ kind: "streak", x: (col + 0.5) / N, y: ys[col] - len, r: len, w: 0.006 + 0.006 * hash01(r, c.seed + 44), tail: true, ang: 0, a: 0.55 * k * flick * swell, hue: r % 3 ? hueA : hueB, sat: 95, l: 74 });
  }
  return { items, layers: [{ kind: "ribbon", x: 0, y: 0, r: 0, ys, cols, h, a: Math.min(0.75, 0.09 / mA.k) * swell, dh: 0, hue: mA.hue, sat: mA.sat * 100, l: mA.l * 100, k: mA.k }] };
}

/** Waves: parallel lines of water in perspective, all running the same way at the same pace. Each line's swing is held below its gap to the next, so they can never cross. */
function waves(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(3, 8, density)), items: Item[] = [];
  const ys: number[] = [], want: number[] = [];
  for (let j = 0; j < n; j++) {
    const q = n === 1 ? 0.5 : j / (n - 1); // 0 far, 1 near
    ys.push(0.5 + 0.43 * q ** 1.15);
    want.push(lerp(0.005, 0.03, q) * lerp(0.45, 1.5, feel.depth) * (0.7 + 0.6 * clamp(feel.lift)) * (1 + 0.28 * c.hit));
  }
  const ph = 2 * Math.PI * c.b * lerp(0.03, 0.16, speed); // one phase for all: the lines travel together
  for (let j = 0; j < n; j++) {
    const q = n === 1 ? 0.5 : j / (n - 1);
    const gap = Math.min(j > 0 ? ys[j] - ys[j - 1] : 1, j < n - 1 ? ys[j + 1] - ys[j] : 1) * (c.aspect > 0 && c.aspect < 1 ? 1 / c.aspect : 1); // the gap to the nearest line, from fractions of the height to the smaller side
    items.push({
      kind: "wave", x: 0, y: ys[j], r: Math.min(want[j], gap * 0.42), // two neighbours swing 0.42 of the gap each at most: they cannot meet
      w: lerp(0.0014, 0.0042, q) * lerp(1, 1.4, feel.near), a: lerp(0.12, 0.38, q) * (0.8 + 0.2 * c.amp),
      k: lerp(0.3, 0.5, q) * lerp(1, 0.7, feel.jitter), ph: ph + j * 0.5, soft: clamp(feel.soft * 1.2 - feel.jitter * 0.6),
    });
  }
  return { items, layers: [] };
}

/** Fireflies: soft lights that wander slowly and glow on and off, each on its own slow rhythm. Tension makes them blink quicker. */
function fireflies(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(5, 30, density)), items: Item[] = [], wander = lerp(0.01, 0.05, speed);
  const near62 = Math.abs(((c.h - 62 + 540) % 360) - 180) < 75; // a yellow-green light is lost on a green or yellow field: use amber there
  for (let i = 0; i < n; i++) {
    const ph = hash01(i, c.seed + 3), per = lerp(11, 5, feel.jitter) * (0.7 + 0.6 * hash01(i, c.seed + 4));
    const glow = Math.max(0, Math.sin(2 * Math.PI * (c.b / per + ph))) ** 3;
    items.push({ kind: "dot", x: 0.1 + 0.8 * hash01(i, c.seed) + 0.07 * noise1(c.b * wander + i * 9, c.seed + 5), y: 0.1 + 0.8 * hash01(i, c.seed + 1) + 0.07 * noise1(c.b * wander + i * 9 + 50, c.seed + 6),
      r: lerp(0.007, 0.016, feel.near) * (0.7 + 0.6 * hash01(i, c.seed + 2)) * (0.8 + 0.4 * glow), w: 0, soft: 1, a: 0.14 + 0.6 * glow * (1 + 0.3 * c.hit), hue: near62 ? 18 : 62, sat: 90, l: near62 ? 62 : 78 });
  }
  return { items, layers: [] };
}

/** Stars: a fixed sky that twinkles slowly and turns a little; now and then a shooting star. Quiet, open, far away. */
function stars(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(14, 70, density)), items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3);
    const tw = 0.55 + 0.45 * Math.sin(2 * Math.PI * (c.b / (6 + 10 * hash01(i, c.seed + 4) - 4 * feel.jitter) + ph));
    items.push({ kind: "dot", x: frac(hash01(i, c.seed) + c.b * 0.0003 * (0.5 + speed)), y: hash01(i, c.seed + 1) * 0.85, r: lerp(0.0015, 0.0042, z) * lerp(0.9, 1.4, feel.near), w: 0, soft: z > 0.8 ? 0.8 : 0, a: lerp(0.3, 0.7, z) * tw, l: 96 });
  }
  const per = lerp(40, 18, speed), idx = Math.floor(c.b / per), u = (c.b / per - idx) / 0.05; // a shooting star lasts 5% of its period
  if (u >= 0 && u < 1 && hash01(idx, c.seed + 7) > 0.35) {
    const x0 = 0.2 + 0.6 * hash01(idx, c.seed + 8), y0 = 0.05 + 0.3 * hash01(idx, c.seed + 9);
    // the head moves by (0.3, 0.17) of the view in `u`; the tail trails behind it along the same direction (the streak runs from its tail to its head)
    const asp = c.aspect > 0 ? c.aspect : 0.6, ang = Math.atan2(0.3 * asp, 0.17), len = 0.11, m = Math.min(asp, 1);
    const hx = x0 + 0.3 * u, hy = y0 + 0.17 * u;
    items.push({ kind: "streak", x: hx - (Math.sin(ang) * len * m) / asp, y: hy - Math.cos(ang) * len * m, r: len, w: 0.0022, ang, tail: true, a: 0.7 * Math.sin(Math.PI * u), l: 97 });
  }
  return { items, layers: [] };
}

/** Bubbles: thin rings that rise and wobble, small and large. Playful: more of them, quicker, with spontaneity. */
function bubbles(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(4, 22, density)), items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3), t = c.b * lerp(0.02, 0.07, speed) * (0.6 + 0.8 * z) + ph, cyc = Math.floor(t), y = 1.06 - (t - cyc) * 1.14;
    items.push({ kind: "ring", x: hash01(i + cyc * 977, c.seed) + (0.015 + 0.03 * feel.irreg) * Math.sin(2 * Math.PI * (c.b / (8 + 8 * ph) + ph)), y, r: lerp(0.01, 0.042, z) * (1 + 0.2 * c.hit), w: lerp(0.0014, 0.003, z), a: lerp(0.3, 0.5, z) * Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, y))) * 3), l: 94 });
  }
  return { items, layers: [] };
}

/** Leaves: leaf shapes (pointed, with a midrib) that fall, sway and turn over as they go, in the colours of autumn whatever the field's hue. Wistful: slow, warm, a little untidy. */
function leaves(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(4, 24, density)), items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3), y = frac(hash01(i, c.seed + 1) + c.b * lerp(0.02, 0.06, speed) * (0.6 + 0.8 * z));
    items.push({ kind: "leaf", x: hash01(i, c.seed) + (0.03 + 0.05 * feel.irreg) * Math.sin(2 * Math.PI * (c.b / (10 + 10 * ph) + ph)), y,
      r: lerp(0.022, 0.05, z), w: 0, ang: 0.9 * Math.sin(2 * Math.PI * (c.b / (7 + 6 * ph) + ph)) + 6.283 * ph, sq: Math.max(0.2, Math.abs(Math.cos(2 * Math.PI * (c.b / (6 + 6 * ph) + ph)))),
      a: 0.55 * Math.min(1, Math.sin(Math.PI * y) * 3), hue: 8 + 42 * hash01(i, c.seed + 5), sat: 78, l: 46 + 14 * z });
  }
  return { items, layers: [] };
}

/** Lanterns: warm lights that rise very slowly and sway, each with a bright core. Hope. */
function lanterns(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(3, 14, density)), items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3), t = c.b * lerp(0.012, 0.032, speed) * (0.6 + 0.8 * z) + ph, cyc = Math.floor(t), y = 1.1 - (t - cyc) * 1.25;
    const x = hash01(i + cyc * 977, c.seed) + (0.015 + 0.03 * feel.irreg) * Math.sin(2 * Math.PI * (c.b / (14 + 10 * ph) + ph));
    const flick = 0.85 + 0.15 * Math.sin(2 * Math.PI * (c.b / (3 + 2 * ph) + ph)), fade = Math.min(1, Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (y + 0.1) / 1.2))) * 2.5));
    const r = lerp(0.02, 0.045, z) * (1 + 0.12 * c.hit);
    items.push({ kind: "dot", x, y, r: r * 1.5, w: 0, soft: 1, a: 0.5 * flick * fade, hue: 34, sat: 95, l: 62 });
    items.push({ kind: "dot", x, y, r: r * 0.45, w: 0, soft: 0.5, a: 0.8 * flick * fade, hue: 44, sat: 95, l: 82 });
  }
  return { items, layers: [] };
}

/** Dandelion seeds: tufts that drift across the view, turning slowly and bobbing on the air. Light, free. */
function seeds(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(4, 22, density)), items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const z = hash01(i, c.seed + 2), ph = hash01(i, c.seed + 3), t = c.b * lerp(0.008, 0.03, speed) * (0.6 + 0.8 * z) + ph, u = t - Math.floor(t), cyc = Math.floor(t);
    const y = 0.15 + 0.7 * hash01(i + cyc * 977, c.seed + 1) - 0.18 * u + (0.025 + 0.03 * feel.irreg) * Math.sin(2 * Math.PI * (c.b / (6 + 6 * ph) + ph));
    items.push({ kind: "seed", x: -0.05 + 1.1 * u, y, r: lerp(0.014, 0.03, z), w: 0.0012, ang: 6.283 * ph + c.b * 0.05, a: 0.55 * Math.min(1, Math.sin(Math.PI * u) * 4), l: 96 });
  }
  return { items, layers: [] };
}

/** Tide: a line of foam that comes up the view and slides back, with fainter lines of foam left behind it. The lines move together and never meet. Peaceful. */
function tide(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = 2 + Math.round(density * 2), items: Item[] = [];
  const per = lerp(42, 16, speed), sw = Math.sin((2 * Math.PI * c.b) / per), lead = 0.74 + 0.11 * sw; // the lead line: up and back
  for (let j = 0; j < n; j++) {
    items.push({ kind: "wave", x: 0, y: lead + 0.055 * j, r: 0.004 + 0.003 * feel.irreg, w: lerp(0.004, 0.002, j / n), a: lerp(0.5, 0.18, j / n) * (0.85 + 0.15 * c.amp), k: 0.45 - 0.03 * j, ph: 2 * Math.PI * c.b * 0.03 + j * 0.4, soft: 1 });
  }
  return { items, layers: [] };
}
