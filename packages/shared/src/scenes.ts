import { matchedLayer, relLuminance } from "./colour-math";
import { clamp, frac, hash01, lerp, noise1, type Clock, type Feel, type Item, type Layer, type SceneName, type SceneOut } from "./scene-kit";

// The scenes (docs/visuals.md): what moves over the colours. Each is a pure function of the clock, the mood's feel and the seed.
// The mood shapes the form, not only the hue (a sad rain is thin, straight and slow; an angry one is slanted, fast and ragged),
// so the emotions can be told apart with the colour taken away. Sizes are fractions of the smaller side. Speeds count in beats, so a
// slow piece gets a slow picture.

const EMPTY: SceneOut = { items: [], layers: [] };
/** Alpha of the scene when it fades in or out (visual.ts, `from`). */
const fade = (o: SceneOut, k: number): SceneOut => k >= 0.999 ? o : { items: o.items.map((i) => ({ ...i, a: i.a * k })), layers: o.layers.map((l) => ({ ...l, a: l.a * k })) };

/** Scenes made partly of large layers: the motion's own wash and glow step back for them (visual.ts). One rule for the old and the new scene of a crossfade. */
export const sceneHasLayers = (s: SceneName | "none") => s === "aurora" || s === "smoke" || s === "rain" || s === "embers";
/** How much of the motion's own wash and glow is left under a scene: 1 with none, a quarter under layers, almost nothing under an aurora (it needs the whole budget). */
export const sceneBack = (s: SceneName | "none") => s === "aurora" || s === "smoke" ? 0.08 : sceneHasLayers(s) ? 0.25 : 1;

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
    : scene === "smoke" ? smoke(d, v, feel, c)
    : scene === "circuit" ? circuit(d, v, feel, c)
    : scene === "digital" ? digital(d, v, feel, c)
    : scene === "bars" ? bars(d, v, feel, c)
    : scene === "vines" ? vines(d, v, feel, c)
    : scene === "fireworks" ? fireworks(d, v, feel, c)
    : scene === "moths" ? moths(d, v, feel, c)
    : scene === "flock" ? flock(d, v, feel, c)
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

/** Waves: parallel lines of water across the whole view, in perspective (close together far away at the top, wider apart near the bottom), all running the same way at the same pace.
 *  Each line's swing is held below its gap to the next, so they can never cross. The lines vanish at the top, at the bottom, at both or at neither, by the mood: the open sea (calm) fades at both ends,
 *  a bright mood fades into the sky at the top, a low one into the deep at the bottom, a tense one is cut hard. Not the tide (a foam line low in the view). */
function waves(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const items: Item[] = [], ys: number[] = [], want: number[] = [];
  const edge: "both" | "top" | "bottom" | "none" = feel.jitter > 0.6 ? "none" : feel.depth < 0.45 ? "both" : feel.lift >= 0.5 ? "top" : "bottom";
  // lines from the top to past the bottom edge (a cut line is fine), the gap between them growing gently with depth and never leaving a hole
  for (let y = 0.03, i = 0; y < 1.08 && i < 40; i++) {
    ys.push(y); y += lerp(0.04, 0.095, clamp(y)) * lerp(1.25, 0.9, density);
  }
  const n = ys.length;
  for (let j = 0; j < n; j++) {
    const q = clamp(ys[j]);
    want.push(lerp(0.004, 0.03, q) * lerp(0.45, 1.5, feel.depth) * (0.7 + 0.6 * clamp(feel.lift)) * (1 + 0.28 * c.hit));
  }
  const ph = 2 * Math.PI * c.b * lerp(0.03, 0.16, speed); // one phase for all: the lines travel together
  const ss = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
  for (let j = 0; j < n; j++) {
    const q = clamp(ys[j]);
    const gap = Math.min(j > 0 ? ys[j] - ys[j - 1] : 1, j < n - 1 ? ys[j + 1] - ys[j] : 1) * (c.aspect > 0 && c.aspect < 1 ? 1 / c.aspect : 1); // the gap to the nearest line, from fractions of the height to the smaller side
    const vanish = (edge === "top" || edge === "both" ? ss(ys[j] / 0.3) : 1) * (edge === "bottom" || edge === "both" ? ss((1 - ys[j]) / 0.3) : 1);
    items.push({
      kind: "wave", x: 0, y: ys[j], r: Math.min(want[j], gap * 0.42), // two neighbours swing 0.42 of the gap each at most: they cannot meet
      w: lerp(0.0012, 0.0035, q) * lerp(1, 1.3, feel.near), a: lerp(0.14, 0.4, q) * (0.8 + 0.2 * c.amp) * Math.max(0.04, vanish),
      k: lerp(0.3, 0.5, q) * lerp(1, 0.7, feel.jitter), ph: ph + j * 0.5, soft: clamp(feel.soft * 1.2 - feel.jitter * 0.6),
    });
  }
  return { items, layers: [] };
}

/** Fireflies: soft lights that wander slowly and glow on and off, each on its own slow rhythm. Tension makes them blink quicker. */
function fireflies(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(5, 30, density)), items: Item[] = [], wander = lerp(0.01, 0.05, speed);
  // the light is yellow-green, amber or cyan: whichever is furthest in hue from the field, so it reads on any colour
  const dist = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const hueF = [62, 18, 190].reduce((best, h) => (dist(h, c.h) > dist(best, c.h) ? h : best), 62);
  for (let i = 0; i < n; i++) {
    const ph = hash01(i, c.seed + 3), per = lerp(11, 5, feel.jitter) * (0.7 + 0.6 * hash01(i, c.seed + 4));
    const glow = Math.max(0, Math.sin(2 * Math.PI * (c.b / per + ph))) ** 3;
    const x = 0.1 + 0.8 * hash01(i, c.seed) + 0.07 * noise1(c.b * wander + i * 9, c.seed + 5), y = 0.1 + 0.8 * hash01(i, c.seed + 1) + 0.07 * noise1(c.b * wander + i * 9 + 50, c.seed + 6);
    const r = lerp(0.009, 0.02, feel.near) * (0.7 + 0.6 * hash01(i, c.seed + 2)) * (0.85 + 0.35 * glow);
    items.push({ kind: "dot", x, y, r: r * 2.2, w: 0, soft: 1, a: 0.1 + 0.45 * glow * (1 + 0.3 * c.hit), hue: hueF, sat: 95, l: 60 });  // the halo
    items.push({ kind: "dot", x, y, r: r * 0.7, w: 0, soft: 0.3, a: 0.2 + 0.7 * glow, hue: hueF, sat: 80, l: 90 });                     // the bright body
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

/** Spread: n well-separated places in the view (one per cell of a jittered grid, taken in a hashed order), so no two lights sit close together. */
function spread(n: number, aspect: number, seed: number): Array<{ x: number; y: number; cw: number; ch: number }> {
  const cols = Math.max(1, Math.round(Math.sqrt(n * (aspect > 0 ? aspect : 0.6)))), rows = Math.ceil(n / cols), cells: number[] = [];
  for (let i = 0; i < cols * rows; i++) cells.push(i);
  cells.sort((p, q) => hash01(p, seed) - hash01(q, seed));
  const cw = 0.84 / cols, ch = 0.8 / rows;
  return cells.slice(0, n).map((cell, i) => ({ x: 0.08 + ((cell % cols) + 0.5 + 0.5 * (hash01(i, seed + 1) - 0.5)) * cw, y: 0.08 + (Math.floor(cell / cols) + 0.5 + 0.5 * (hash01(i, seed + 2) - 0.5)) * ch, cw, ch }));
}

/** Lanterns: warm lights that stay in the view, bob a little, and each go on and off in their own slow rhythm (the glow, never the lantern). They are kept apart. Hope. */
function lanterns(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(3, 12, density)), items: Item[] = [], pos = spread(n, c.aspect, c.seed + 60);
  for (let i = 0; i < n; i++) {
    const p = pos[i], ph = hash01(i, c.seed + 3), z = hash01(i, c.seed + 2), per = lerp(26, 12, speed) * (0.8 + 0.5 * ph);
    const on = clamp(0.5 + 0.9 * Math.sin(2 * Math.PI * (c.b / per + ph))), glow = on * on * (3 - 2 * on); // mostly on or off, a smooth change between
    const x = p.x + p.cw * 0.2 * noise1(c.b * 0.02 + i * 7, c.seed + 4), y = p.y + p.ch * 0.2 * noise1(c.b * 0.02 + i * 7 + 40, c.seed + 5) + 0.012 * Math.sin(2 * Math.PI * (c.b / 18 + ph));
    const r = Math.min(lerp(0.018, 0.034, z), p.cw * 0.28) * (1 + 0.1 * c.hit * glow);
    items.push({ kind: "dot", x, y, r: r * 0.55, w: 0, soft: 0.2, a: 0.2 + 0.1 * glow, hue: 30, sat: 80, l: 52 });          // the lantern itself, always there
    items.push({ kind: "dot", x, y, r: r * 1.9, w: 0, soft: 1, a: 0.5 * glow, hue: 34, sat: 95, l: 62 });                     // the glow
    items.push({ kind: "dot", x, y, r: r * 0.5, w: 0, soft: 0.5, a: 0.8 * glow, hue: 44, sat: 95, l: 84 });                   // the bright core
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
  // The foam line goes up and back between the bottom and 80% of the height; a fixed number of lines hang from it to the bottom edge, spread out in perspective,
  // so whatever the tide does nothing is left empty under it, and they never cross (the order of their positions never changes).
  const items: Item[] = [], n = Math.round(lerp(7, 11, density));
  const per = lerp(42, 16, speed), u = 0.5 + 0.5 * Math.sin((2 * Math.PI * c.b) / per), lead = lerp(0.88, lerp(0.5, 0.2, clamp(0.3 + 0.7 * feel.depth)), u); // the high mark is up to 80% of the height (0.2 from the top), lower for a gentle mood
  const ys: number[] = [];
  for (let j = 0; j < n; j++) ys.push(lead + (1.04 - lead) * (j / (n - 1)) ** 1.25);
  for (let j = 0; j < n; j++) {
    const gap = (j < n - 1 ? ys[j + 1] - ys[j] : ys[j] - ys[j - 1]) * (c.aspect > 0 && c.aspect < 1 ? 1 / c.aspect : 1);
    items.push({ kind: "wave", x: 0, y: ys[j], r: Math.min(0.004 + 0.004 * feel.irreg + 0.004 * j / n, gap * 0.42), w: lerp(0.004, 0.0022, Math.min(1, j / 4)), a: (j === 0 ? 0.5 : 0.28 * Math.max(0.55, 1 - j * 0.05)) * (0.85 + 0.15 * c.amp), k: 0.45 - 0.01 * j, ph: 2 * Math.PI * c.b * 0.03 + j * 0.4, soft: 1 });
  }
  return { items, layers: [] };
}

const pathItem = (pts: number[], w: number, a: number, extra: Partial<Item> = {}): Item => ({ kind: "path", x: pts[0], y: pts[1], r: 0, w, a, pts, ...extra });

/** Smoke: billowing plumes. Each plume is a column of soft puffs that leave a source at the bottom, swell as they rise, swirl in the turbulence, merge with their neighbours and thin out
 *  to nothing. The puffs are large soft layers, so they share the brightness budget where they overlap. Brooding, uneasy. */
function smoke(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const gm = matchedLayer(c.bases, c.h, 0.04); // grey of the lightness that changes the field's brightness least: the smoke can be strongly opaque and is seen as a colourless haze
  const P = Math.round(lerp(1, 2.4, density)), M = 10, layers: Layer[] = [], rate = lerp(0.012, 0.034, speed), wind = 0.18 * noise1(c.b / 45, c.seed + 60);
  for (let p = 0; p < P; p++) {
    const x0 = (p + 0.5 + 0.5 * (hash01(p, c.seed + 61) - 0.5)) / P, ph = hash01(p, c.seed + 62);
    for (let m = 0; m < M; m++) {
      const u = ((c.b * rate + m / M + ph) % 1 + 1) % 1; // 0 at the source, 1 gone
      const sway = 0.1 * noise1(c.b * 0.02 + u * 2.2 + p * 7, c.seed + 63) + 0.06 * noise1(c.b * 0.05 + m * 3.1, c.seed + 64) * u;
      layers.push({ kind: "blob", x: x0 + (wind * u + sway) * (0.4 + u) * (1 + feel.jitter), y: 1.1 - u * 1.0,
        r: lerp(0.07, 0.26, u ** 0.8) * lerp(0.85, 1.2, feel.near) * (1 + 0.15 * noise1(c.b * 0.04 + m * 5, c.seed + 65)),
        a: Math.min(0.75, 0.09 / gm.k) * 0.8 * Math.sin(Math.PI * u) ** 0.8 * lerp(0.8, 1.2, density), dh: 0, hue: gm.hue, sat: gm.sat * 100, l: gm.l * 100, k: gm.k });
    }
  }
  return { items: [], layers };
}

/** Circuit: right-angled traces across the view, with pulses of light that travel along them one segment on each beat, in steps, never smoothly. Cold, exact, a machine at work. */
function circuitTrace(sd: number, asp: number): number[] {
  const pts: number[] = [], U = 0.045; // one cell, as a fraction of the height
  let x = 0.06 + 0.88 * hash01(sd, 1), y = 0.06 + 0.88 * hash01(sd, 2), dir = Math.floor(hash01(sd, 3) * 4);
  x = Math.round(x / (U / asp)) * (U / asp); y = Math.round(y / U) * U; pts.push(x, y);
  for (let k = 0; k < 12; k++) {
    const len = 1 + Math.floor(hash01(sd, 10 + k) * 5);
    x += [1, 0, -1, 0][dir] * len * (U / asp); y += [0, 1, 0, -1][dir] * len * U;
    if (x < 0.03 || x > 0.97 || y < 0.03 || y > 0.97) { x = Math.min(0.97, Math.max(0.03, x)); y = Math.min(0.97, Math.max(0.03, y)); pts.push(x, y); break; }
    pts.push(x, y); dir = (dir + (hash01(sd, 30 + k) < 0.5 ? 1 : 3)) % 4;
  }
  return pts;
}
function circuit(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(4, 12, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6, L = 40; // every traces' layout comes from the session seed and the cycle: no two sessions, and no two cycles, draw the same board
  for (let i = 0; i < n; i++) {
    const t = c.b / L + i / n, cyc = Math.floor(t), u = t - cyc, fade = Math.min(1, u * 8, (1 - u) * 8);
    const pts = circuitTrace(Math.floor(hash01(i + cyc * 977, c.seed + 7) * 100000), asp), segs = pts.length / 2 - 1;
    items.push(pathItem(pts, 0.0022, 0.2 * fade, { l: 84, sat: 35 }));
    for (let k = 0; k <= segs; k++) items.push({ kind: "dot", x: pts[2 * k], y: pts[2 * k + 1], r: 0.0042, w: 0, soft: 0, a: 0.3 * fade, l: 88, sat: 35 }); // the pads at the corners
    // the pulse: one segment per beat, in steps (the beat index, not its fraction), with a tail of two segments behind it
    const head = (Math.floor(c.b * (c.sync === "free" ? 1 : 1)) + i * 3) % (segs + 3);
    for (let tl = 0; tl < 3; tl++) {
      const sg = head - tl; if (sg < 0 || sg >= segs) continue;
      items.push(pathItem([pts[2 * sg], pts[2 * sg + 1], pts[2 * sg + 2], pts[2 * sg + 3]], 0.0045 - 0.001 * tl, (0.5 - 0.15 * tl) * fade, { l: 92, sat: 60 }));
    }
  }
  return { items, layers: [] };
}

/** Digital: columns of small blocks that fall one cell per tick, with a bright head and a fading tail: stepwise, like a machine drawing text. Alert, processing. */
function digital(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const cols = Math.round(lerp(16, 48, density)), items: Item[] = [], rows = 26, tail = 7, cell = 1 / rows, asp = c.aspect > 0 ? c.aspect : 0.6, m = Math.min(asp, 1);
  for (let i = 0; i < cols; i++) {
    const heads = 1 + (hash01(i, c.seed + 9) > 0.45 ? 1 : 0), rate = (1 + Math.floor(hash01(i, c.seed + 2) * 3)) * 0.5 * lerp(0.7, 2, speed), x = (i + 0.5) / cols;
    for (let h = 0; h < heads; h++) {
      const pos = Math.floor(c.b * rate + hash01(i + h * 57, c.seed + 3) * (rows + tail)) % (rows + tail + 6 + 4 * h);
      for (let k = 0; k < tail; k++) {
        const row = pos - k; if (row < 0 || row >= rows) continue;
        if (k > 0 && hash01(row + i * 31 + h * 7, Math.floor(c.b * 2) + c.seed) < 0.12) continue; // a cell dropped out now and then
        items.push({ kind: "streak", x, y: row * cell, r: (cell * 0.7) / m, w: Math.min(0.0058, ((0.5 / cols) * asp) / m), ang: 0, a: k === 0 ? 0.5 : 0.4 * (1 - k / tail) ** 1.4, l: k === 0 ? 96 : 80, sat: 75 });
      }
    }
  }
  return { items, layers: [] };
}

/** Bars: an equaliser. Columns of small blocks whose levels jump to new values on each beat (in whole steps, never smoothly), with a peak marker that hangs at the top for a beat and then drops
 *  a block at a time. Machine-like, driven by the music's pulse. */
function bars(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const nb = Math.round(lerp(12, 30, density)), rows = 16, items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6, m = Math.min(asp, 1);
  const bw = 0.84 / nb, cell = 0.6 / rows, step = Math.floor(c.b * lerp(1, 2, speed));
  const lvl = (i: number, st: number) => Math.round(1 + (rows - 3) * clamp(0.5 + 0.55 * noise1(st * 0.9 + i * 0.7, c.seed + 11) * (0.6 + 0.4 * feel.depth) + 0.18 * (hash01(st * 31 + i, c.seed + 12) - 0.5) + 0.12 * (feel.lift - 0.5)));
  for (let i = 0; i < nb; i++) {
    const L = lvl(i, step), x = 0.08 + (i + 0.5) * bw, bwPx = (Math.min(bw * asp, cell) * 0.7) / m;
    for (let k = 0; k < L; k++) items.push({ kind: "streak", x, y: 0.95 - (k + 1) * cell, r: (cell * 0.78) / m, w: bwPx, ang: 0, a: 0.18 + 0.3 * (k / rows), l: k > rows * 0.7 ? 94 : 84, sat: 70 });
    // the peak: the highest level of the last few steps, dropping one block per step after it hangs
    let peak = L, hold = 0; for (let h = 1; h <= 6; h++) { const past = lvl(i, step - h) - Math.max(0, h - 2); if (past > peak) { peak = past; hold = h; } }
    items.push({ kind: "streak", x, y: 0.95 - (Math.min(rows, peak) + 1.4) * cell, r: (cell * 0.5) / m, w: bwPx, ang: 0, a: 0.5 * (1 - 0.1 * hold), l: 97, sat: 50 });
  }
  return { items, layers: [] };
}

/** The first `g` (0 to 1) of a polyline. */
function partOf(p: number[], g: number): number[] {
  const n = p.length / 2 - 1, t = g * n, k = Math.floor(t), out = p.slice(0, 2 * (k + 1));
  if (k < n) { const f = t - k; out.push(p[2 * k] + (p[2 * k + 2] - p[2 * k]) * f, p[2 * k + 1] + (p[2 * k + 3] - p[2 * k + 1]) * f); }
  return out;
}

/** A plant, as a pure function of its seed: a stem that winds from a point of the view in a direction of its own, with side branches that curl at their tips, and the places where leaves sit.
 *  Branches are lists of points (fractions of the view); `at` is the share of the stem's growth at which each branch starts. */
function plant(sd: number, asp: number) {
  const step = 0.032, branches: Array<{ pts: number[]; at: number }> = [], leaves: Array<{ x: number; y: number; at: number; a: number }> = [];
  const grow = (x: number, y: number, ang: number, n: number, curl: number, sdd: number, at0: number, span: number) => {
    const pts = [x, y];
    for (let k = 1; k <= n; k++) {
      ang += curl * noise1(k * 0.35, sdd) + (k > n - 5 ? 0.35 * curl * 4 * ((sdd % 2) ? 1 : -1) : 0); // the tip curls in
      x += (Math.cos(ang) * step) / asp; y += Math.sin(ang) * step; pts.push(x, y);
      if (k % 3 === 0 && leaves.length < 14) leaves.push({ x, y, at: at0 + span * (k / n), a: ang });
    }
    return pts;
  };
  const ox = hash01(sd, 1), oy = hash01(sd, 2), edge = Math.floor(hash01(sd, 3) * 5); // from an edge or from the inside
  const x0 = edge === 0 ? 0.02 : edge === 1 ? 0.98 : edge === 2 ? ox : edge === 3 ? ox : 0.15 + 0.7 * ox, y0 = edge === 2 ? 1.02 : edge === 3 ? -0.02 : oy;
  const ang0 = Math.atan2(0.5 - y0, (0.5 - x0) * asp) + (hash01(sd, 4) - 0.5) * 1.3;
  const stem = grow(x0, y0, ang0, 24, 0.22, sd + 5, 0, 1);
  branches.push({ pts: stem, at: 0 });
  const nb = 3 + Math.floor(hash01(sd, 6) * 3);
  for (let b = 0; b < nb; b++) {
    const k = Math.floor(5 + (b / nb) * 17), side = (b + sd) % 2 ? 1 : -1, fx = stem[2 * k], fy = stem[2 * k + 1];
    const base = Math.atan2(stem[2 * k + 1] - stem[2 * k - 1], (stem[2 * k] - stem[2 * k - 2]) * asp) + side * (0.7 + 0.5 * hash01(sd, 20 + b));
    branches.push({ pts: grow(fx, fy, base, 7 + Math.floor(hash01(sd, 30 + b) * 6), 0.3, sd + 40 + b, k / 24, 0.2), at: k / 24 });
  }
  return { branches, leaves };
}

/** Vines: plants that sprout anywhere (an edge or the inside), grow in their own direction and branch, curl at the tips and put out leaves, hold for a while, then wither: the leaves fall and the
 *  stem draws back to where it began. Another one starts somewhere else. Determination, life going on. */
function vines(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(2, 5, density)), items: Item[] = [], L = lerp(44, 26, speed), asp = c.aspect > 0 ? c.aspect : 0.6;
  for (let i = 0; i < n; i++) {
    const t = c.b / L + i / n, cyc = Math.floor(t), u = t - cyc;
    const grown = u < 0.45 ? 1 - (1 - u / 0.45) ** 2 : 1, dying = u < 0.7 ? 0 : Math.min(1, (u - 0.7) / 0.28), vis = grown * (1 - dying ** 1.4);
    if (vis <= 0.01) continue;
    const pl = plant(Math.floor(hash01(i + cyc * 977, c.seed + 8) * 100000), asp);
    for (const br of pl.branches) {
      const g = br.at === 0 ? vis : clamp((vis - br.at) / 0.25) * (1 - dying * 0.3);
      if (g <= 0.02) continue;
      items.push(pathItem(partOf(br.pts, g), br.at === 0 ? 0.0045 : 0.003, (br.at === 0 ? 0.46 : 0.36) * (1 - 0.35 * dying), { l: 80, sat: 40 }));
    }
    for (const lf of pl.leaves) {
      const born = clamp((grown - lf.at * 0.9) / 0.08); if (born <= 0) continue;
      const fall = clamp((dying - 0.1 * hash01(lf.x * 100, 5)) / 0.7), sway = Math.sin(fall * 9 + lf.x * 20) * 0.02;
      items.push({ kind: "leaf", x: lf.x + sway, y: lf.y + fall * 0.35, r: 0.016 * born * (1 - 0.3 * dying), w: 0, ang: lf.a + fall * 4, sq: Math.max(0.25, Math.abs(Math.cos(fall * 6 + lf.x * 9))), a: 0.5 * born * (1 - fall), hue: 105 + 30 * hash01(lf.x * 77, 3) - 70 * dying, sat: 55, l: 52 });
    }
  }
  return { items, layers: [] };
}

/** Fireworks: on the first beat of a bar a shell rises and bursts into small lights that fly out, slow, droop and fade. Several shells run at once, staggered across the bar, and the more
 *  the mood is elated the more there are. Only small items: no wash, no glow. */
function fireworks(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const items: Item[] = [], streams = 1 + Math.round(density * 4), N = Math.round(lerp(12, 24, density)), life = lerp(3.4, 2.2, speed);
  const asp = c.aspect > 0 ? c.aspect : 0.6, m = Math.min(asp, 1);
  for (let s = 0; s < streams; s++) {
    const bar = (c.b - (4 * s) / streams) / 4, k = Math.floor(bar), age = (bar - k) * 4; // beats since the burst; the rocket climbs in the last beat before it
    for (const [kk, ag] of [[k, age], [k + 1, age - 4]] as const) {
      const id = kk * 17 + s * 101, cx = 0.15 + 0.7 * hash01(id, c.seed), cy = 0.15 + 0.35 * hash01(id, c.seed + 1), hue = (c.h + 360 * hash01(id, c.seed + 2)) % 360, size = 0.7 + 0.6 * hash01(id, c.seed + 3);
      if (ag >= -1 && ag < 0) { const u = ag + 1; items.push({ kind: "streak", x: cx, y: lerp(1.02, cy, u * u), r: 0.05, w: 0.0025, ang: Math.PI, tail: true, a: 0.5 * (1 - u * 0.3), l: 92 }); continue; }
      if (ag < 0 || ag > life) continue;
      const u = ag / life, rad = lerp(0.1, 0.22, feel.near) * (0.8 + 0.4 * feel.depth) * size;
      for (let p = 0; p < N; p++) {
        const a = 2 * Math.PI * (p / N + 0.08 * hash01(p, id)), sp = rad * (0.5 + 0.5 * hash01(p, id + 5)), e = 1 - Math.exp(-4 * u);
        items.push({ kind: "dot", x: cx + (Math.cos(a) * sp * e * m) / asp, y: cy + Math.sin(a) * sp * e * m + 0.12 * u * u, r: 0.0045 * (1 - 0.5 * u), w: 0, soft: 0.3, a: 0.7 * (1 - u) ** 1.4, hue: (hue + 30 * hash01(p, id + 9)) % 360, sat: 90, l: 72 });
      }
    }
  }
  return { items, layers: [] };
}

/** Moths: several lights that drift about on their own, and pale specks that circle one light on a tilted orbit, now and then leave it and fly across to another. Longing, drawn to something. */
function moths(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const nl = 2 + Math.round(density * 2), nm = Math.round(lerp(6, 14, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6, m = Math.min(asp, 1);
  const lights = Array.from({ length: nl }, (_, l) => ({ x: 0.5 + 0.3 * noise1(c.b * 0.004 + l * 17, c.seed + 90), y: 0.5 + 0.25 * noise1(c.b * 0.004 + l * 17 + 50, c.seed + 91), f: 0.8 + 0.2 * Math.sin(c.b * 1.3 + l * 2) + 0.1 * noise1(c.b * 0.4 + l * 9, c.seed + 92) }));
  lights.forEach((L, l) => {
    items.push({ kind: "dot", x: L.x, y: L.y, r: 0.05, w: 0, soft: 1, a: 0.38 * L.f, hue: 38 + 6 * l, sat: 95, l: 62 });
    items.push({ kind: "dot", x: L.x, y: L.y, r: 0.011, w: 0, soft: 0.5, a: 0.8 * L.f, hue: 44, sat: 90, l: 88 });
  });
  const ease = (x: number) => x * x * (3 - 2 * x);
  for (let i = 0; i < nm; i++) {
    const ph = hash01(i, c.seed + 3), T = lerp(18, 9, speed) * (0.8 + 0.5 * hash01(i, c.seed + 4)), t = c.b / T + ph, e = Math.floor(t), f = t - e;
    const pick = (ep: number) => Math.floor(hash01(i + ep * 131, c.seed + 6) * nl), A = lights[pick(e)], B = lights[pick(e - 1)];
    const tilt = Math.PI * hash01(i, c.seed + 4.5), rx = 0.06 + 0.07 * hash01(i, c.seed + 5), ry = rx * (0.35 + 0.4 * hash01(i, c.seed + 6.5));
    const ang = 2 * Math.PI * (c.b / lerp(8, 3.5, speed) * (0.7 + 0.6 * ph) + ph), flight = 0.22; // the first fifth of an epoch is the flight from the last light to this one
    const ex = Math.cos(ang) * rx, ey = Math.sin(ang) * ry, ox = ((ex * Math.cos(tilt) - ey * Math.sin(tilt)) * m) / asp, oy = (ex * Math.sin(tilt) + ey * Math.cos(tilt)) * m;
    const q = f < flight ? ease(f / flight) : 1, arc = f < flight ? Math.sin(Math.PI * q) * 0.06 : 0;
    const x = lerp(B.x, A.x, q) + ox * (f < flight ? q : 1) - arc * (A.y - B.y), y = lerp(B.y, A.y, q) + oy * (f < flight ? q : 1) + arc * (A.x - B.x);
    items.push({ kind: "dot", x, y, r: 0.0042, w: 0, soft: 0.2, a: 0.35 + 0.25 * Math.sin(c.b * 3 + i * 2) ** 2, l: 90, hue: 50, sat: 40 });
  }
  return { items, layers: [] };
}

/** Boids (Reynolds, as in the project Gael pointed to): each bird steers by three rules over staggered radii, separation (nearest, strongest), alignment (middle) and cohesion (outer), plus a pull
 *  to its speed of cruise, a little noise on its heading, a soft wall, a goal that wanders and an obstacle that wanders through and splits whatever it meets. Forces are added to the acceleration
 *  (limited), then the velocity, then the position, in fixed steps, so the simulation is the same for every listener: it restarts from the seed every EPOCH beats and is advanced by whole steps
 *  from there (a listener who joins late catches up at once). Flocks form, split, merge and change size by themselves; the cohesion breathes over time so the size goes from small to large. */
const EPOCH = 72, STEPS_PER_BEAT = 6;
interface Boids { n: number; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; grp: Uint8Array; step: number; key: string }
const SIMS = new Map<string, Boids>();
function goalOf(f: number, step: number, seed: number): [number, number] {
  const b = step / STEPS_PER_BEAT;
  return [0.5 + 0.32 * Math.sin((2 * Math.PI * b) / (38 + 11 * f) + 2.1 * f + hash01(seed, 5)), 0.45 + 0.24 * Math.sin((2 * Math.PI * b) / (29 + 9 * f) + 1.3 * f + hash01(seed, 6))];
}
function newBoids(seed: number, n: number, nf: number, key: string): Boids {
  const B: Boids = { n, x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), grp: new Uint8Array(n), step: 0, key };
  for (let i = 0; i < n; i++) {
    const g = i % nf, [gx, gy] = goalOf(g, 0, seed), a = 2 * Math.PI * hash01(i, seed + 1), r = 0.08 * Math.sqrt(hash01(i, seed + 2)), th = 2 * Math.PI * hash01(i, seed + 3);
    B.grp[i] = g; B.x[i] = gx + Math.cos(a) * r; B.y[i] = gy + Math.sin(a) * r; B.vx[i] = Math.cos(th) * 0.01; B.vy[i] = Math.sin(th) * 0.01;
  }
  return B;
}
function stepBoids(B: Boids, seed: number, nf: number) {
  const { n, x, y, vx, vy, grp } = B, t = B.step / STEPS_PER_BEAT;
  const ra = 0.03, rb = 0.075, rc = 0.16, cruise = 0.0125, maxAcc = 0.0035;
  const coh = 0.5 + 0.55 * Math.sin((2 * Math.PI * t) / 41 + hash01(seed, 7) * 6), sepW = 1.5 + 0.6 * Math.sin((2 * Math.PI * t) / 53 + 1), goalW = 0.22 + 0.18 * Math.sin((2 * Math.PI * t) / 67 + 2);
  const ox = 0.5 + 0.4 * Math.sin((2 * Math.PI * t) / 23 + 0.5), oy = 0.5 + 0.35 * Math.cos((2 * Math.PI * t) / 31); // an obstacle that wanders through
  const ax = new Float64Array(n), ay = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, alx = 0, aly = 0, na = 0, cx = 0, cy = 0, nc = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.hypot(dx, dy);
      if (d < ra) { sx -= dx / (d * d + 1e-4); sy -= dy / (d * d + 1e-4); }
      else if (d < rb) { alx += vx[j]; aly += vy[j]; na++; }
      else if (d < rc) { cx += dx; cy += dy; nc++; }
    }
    let fx = 0.00012 * sepW * sx, fy = 0.00012 * sepW * sy;
    if (na) { fx += 0.12 * (alx / na - vx[i]); fy += 0.12 * (aly / na - vy[i]); }
    if (nc) { fx += 0.012 * coh * (cx / nc); fy += 0.012 * coh * (cy / nc); }
    const [gx, gy] = goalOf(grp[i], B.step, seed); fx += 0.003 * goalW * (gx - x[i]) * 10; fy += 0.003 * goalW * (gy - y[i]) * 10;
    const odx = x[i] - ox, ody = y[i] - oy, od = Math.hypot(odx, ody); if (od < 0.15) { fx += (0.0016 * (0.15 - od)) / (od + 0.02) * (odx / (od + 1e-6)); fy += (0.0016 * (0.15 - od)) / (od + 0.02) * (ody / (od + 1e-6)); }
    const sp = Math.hypot(vx[i], vy[i]) || 1e-6; fx += 0.15 * (cruise - sp) * (vx[i] / sp); fy += 0.15 * (cruise - sp) * (vy[i] / sp); // cruise: steer the speed, do not clamp it
    const na2 = 2 * Math.PI * hash01(i + B.step * 131, seed + 11); fx += 0.0005 * Math.cos(na2); fy += 0.0005 * Math.sin(na2); // noise on the heading
    if (x[i] < 0.06) fx += 0.0012; if (x[i] > 0.94) fx -= 0.0012; if (y[i] < 0.06) fy += 0.0012; if (y[i] > 0.94) fy -= 0.0012; // a soft wall
    const am = Math.hypot(fx, fy); if (am > maxAcc) { fx *= maxAcc / am; fy *= maxAcc / am; }
    ax[i] = fx; ay[i] = fy;
  }
  for (let i = 0; i < n; i++) { vx[i] += ax[i]; vy[i] += ay[i]; x[i] += vx[i]; y[i] += vy[i]; }
  B.step++;
}
function flock(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const nf = 1 + Math.round(density * 2), n = Math.round(lerp(40, 80, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6;
  const ep = Math.floor(c.b / EPOCH), u = c.b - ep * EPOCH, target = Math.floor(u * STEPS_PER_BEAT), fade = Math.min(1, u / 3, (EPOCH - u) / 3);
  const key = `${c.seed}|${ep}|${n}|${nf}`;
  let B = SIMS.get(key);
  if (!B || B.step > target) { B = newBoids(c.seed + ep * 7919, n, nf, key); SIMS.set(key, B); if (SIMS.size > 24) SIMS.delete(SIMS.keys().next().value as string); }
  while (B.step < target) stepBoids(B, c.seed + ep * 7919, nf);
  const lum = c.bases.reduce((a, b) => a + relLuminance(b), 0) / Math.max(1, c.bases.length), light = lum < 0.3, m = Math.min(asp, 1);
  for (let i = 0; i < n; i++) {
    const sp = Math.hypot(B.vx[i], B.vy[i]) || 1e-6, len = 0.014;
    // a short tail along the heading (the direction in pixels, so a wide view and a tall one agree)
    const dxp = B.vx[i] * asp, dyp = B.vy[i], dn = Math.hypot(dxp, dyp) || 1e-6;
    items.push({ kind: "dot", x: B.x[i], y: B.y[i], r: 0.0066, w: 0, soft: 0, a: 0.5 * fade, l: light ? 97 : 7, sat: light ? 10 : 20, dh: (B.grp[i] - (nf - 1) / 2) * 22 });
    items.push({ kind: "streak", x: B.x[i] - ((dxp / dn) * len * m) / asp, y: B.y[i] - (dyp / dn) * len * m, r: len, w: 0.0016, ang: Math.atan2(dxp / dn, dyp / dn), tail: true, a: 0.3 * fade, l: light ? 97 : 7, sat: light ? 10 : 20, dh: (B.grp[i] - (nf - 1) / 2) * 22 });
    void sp;
  }
  return { items, layers: [] };
}
