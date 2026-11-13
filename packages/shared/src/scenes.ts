import { clamp, frac, hash01, lerp, noise1, type Clock, type Feel, type Item, type Layer, type SceneName, type SceneOut } from "./scene-kit";

// The scenes (docs/visuals.md): what moves over the colours. Each is a pure function of the clock, the mood's feel and the seed.
// The mood shapes the form, not only the hue (a sad rain is thin, straight and slow; an angry one is slanted, fast and ragged),
// so the emotions can be told apart with the colour taken away. Sizes are fractions of the smaller side. Speeds count in beats, so a
// slow piece gets a slow picture.

const EMPTY: SceneOut = { items: [], layers: [] };
/** Alpha of the scene when it fades in or out (visual.ts, `from`). */
const fade = (o: SceneOut, k: number): SceneOut => k >= 0.999 ? o : { items: o.items.map((i) => ({ ...i, a: i.a * k })), layers: o.layers.map((l) => ({ ...l, a: l.a * k })) };

export const sceneHasLayers = (s: SceneName | "none") => s === "fog" || s === "aurora" || s === "rain" || s === "embers";

export function sceneParts(scene: SceneName | "none", density: number, speed: number, feel: Feel, c: Clock, k = 1): SceneOut {
  if (scene === "none" || k <= 0.001) return EMPTY;
  const d = clamp(density), v = clamp(speed);
  const out = scene === "motes" ? motes(d, v, feel, c)
    : scene === "ripples" ? ripples(d, v, feel, c)
    : scene === "rain" ? rain(d, v, feel, c)
    : scene === "snow" ? snow(d, v, feel, c)
    : scene === "embers" ? embers(d, v, feel, c)
    : scene === "fog" ? fog(d, v, feel, c)
    : scene === "aurora" ? aurora(d, v, feel, c)
    : waves(d, v, feel, c);
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
  const layers: Layer[] = density > 0.2 ? [
    { kind: "blob", x: 0.5 + 0.2 * noise1(c.b / 40, c.seed + 5), y: 1.02, r: lerp(0.6, 0.95, density), a: 0.035 * (0.6 + density), dh: 0 },
  ] : [];
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
  const life0 = lerp(11, 4.5, speed) * lerp(1.15, 0.85, feel.jitter);
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
  const layers: Layer[] = [{ kind: "blob", x: 0.5 + 0.1 * noise1(c.b / 16, c.seed + 12), y: 1.12, r: lerp(0.55, 0.85, feel.near), a: 0.03 + 0.018 * c.hit * (0.5 + feel.jitter), dh: -8 }];
  return { items, layers };
}

/** Fog: one or two huge soft banks drifting past, low when the mood sinks, breathing slowly, with a little dust sinking through it. */
function fog(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = 1 + Math.round(density * 1.5), layers: Layer[] = [], items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const u = frac(hash01(i, c.seed) + c.b * lerp(0.0008, 0.0035, speed) * (i % 2 ? -1 : 1));
    const edge = Math.sin(Math.PI * u) ** 0.7;
    const y = clamp(lerp(0.45, 0.95, hash01(i, c.seed + 1)) + 0.12 * -c.lift2 * 0.5 + 0.03 * noise1(c.b / 50 + i * 5, c.seed + 4), 0.3, 1.05);
    layers.push({ kind: "blob", x: lerp(-0.2, 1.2, u), y, r: lerp(0.4, 0.75, hash01(i, c.seed + 2)) * lerp(0.85, 1.2, feel.near) * (1 + 0.05 * Math.sin(2 * Math.PI * (c.b / 32 + hash01(i, c.seed + 3)))),
      a: 0.09 * edge, dh: 20 * (hash01(i, c.seed + 5) - 0.5) });
  }
  const dust = Math.round(lerp(4, 16, density)), dir = c.lift2 >= 0.3 ? -1 : 1; // sinks, unless the mood is bright
  for (let i = 0; i < dust; i++) {
    const z = hash01(i, c.seed + 2), y = frac(hash01(i, c.seed + 1) + dir * c.b * lerp(0.004, 0.012, speed) * (0.5 + z));
    items.push({ kind: "dot", x: hash01(i, c.seed) + 0.02 * Math.sin(2 * Math.PI * (c.b / 40 + z)), y, r: lerp(0.003, 0.007, z), w: 0, soft: 0.7, a: 0.3 * Math.min(1, Math.sin(Math.PI * y) * 3), l: 92 });
  }
  return { items, layers };
}

/** Aurora: curtains of light hanging from a wavering lower edge. Smooth for a calm mood; rippling fast for a tense one. */
function aurora(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const nr = density > 0.55 ? 2 : 1, N = 36, layers: Layer[] = [], DH = [55, -65, 130, -25];
  const drift = lerp(0.012, 0.06, speed), swell = c.sync === "free" ? 0.7 : 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(2 * Math.PI * frac(c.beats / 16)));
  for (let j = 0; j < nr; j++) {
    const ys: number[] = [], cols: number[] = [];
    for (let i = 0; i < N; i++) {
      ys.push(0.5 - 0.07 * j + 0.075 * noise1(i * 0.17 + c.b * drift + j * 10, c.seed + j) + 0.03 * Math.sin(i * 0.31 + c.b * drift * 2 + j));
      cols.push(clamp(0.5 + 0.6 * noise1(i * 0.4 - c.b * drift * 0.8 + j * 7, c.seed + 20 + j) + feel.jitter * 0.35 * noise1(i * 0.9 + c.b * 0.7, c.seed + 30 + j)));
    }
    layers.push({ kind: "ribbon", x: 0, y: 0, r: 0, ys, cols, h: lerp(0.2, 0.42, 1 - feel.jitter * 0.6) * (1 - 0.1 * j), a: 0.09 * swell * (1 - 0.3 * j), dh: DH[j], sat: 90, l: 62 });
  }
  return { items: [], layers };
}

/** Waves: lines of water in perspective. Calm: long, low and slow. Joy lifts them; tension makes them short and jagged; the beat swells them. */
function waves(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(3, 8, density)), items: Item[] = [];
  for (let j = 0; j < n; j++) {
    const q = n === 1 ? 0.5 : j / (n - 1); // 0 far, 1 near
    const dirn = j % 2 ? -1 : 1;
    items.push({
      kind: "wave", x: 0, y: 0.5 + 0.43 * q ** 1.15 + 0.01 * noise1(c.b / 20 + j * 4, c.seed + j),
      r: lerp(0.005, 0.03, q) * lerp(0.45, 1.5, feel.depth) * (0.7 + 0.6 * clamp(feel.lift)) * (1 + 0.28 * c.hit),
      w: lerp(0.0014, 0.0042, q) * lerp(1, 1.4, feel.near), a: lerp(0.12, 0.38, q) * (0.8 + 0.2 * c.amp),
      k: lerp(0.24, 0.55, q) * lerp(1, 0.65, feel.jitter), ph: 2 * Math.PI * c.b * lerp(0.03, 0.16, speed) * dirn + j * 1.7, soft: clamp(feel.soft * 1.2 - feel.jitter * 0.6),
    });
  }
  return { items, layers: [] };
}
