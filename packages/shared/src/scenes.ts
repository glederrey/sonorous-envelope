import { bestTone, relLuminance, toneLayer } from "./colour-math";
import { clamp, fbm2, frac, hash01, lerp, noise1, type Clock, type Feel, type Item, type Layer, type SceneName, type SceneOut } from "./scene-kit";

// The scenes (docs/visuals.md): what moves over the colours. Each is a pure function of the clock, the mood's feel and the seed.
// The mood shapes the form, not only the hue (a sad rain is thin, straight and slow; an angry one is slanted, fast and ragged),
// so the emotions can be told apart with the colour taken away. Sizes are fractions of the smaller side. Speeds count in beats, so a
// slow piece gets a slow picture.

const EMPTY: SceneOut = { items: [], layers: [] };
/** Alpha of the scene when it fades in or out (visual.ts, `from`). */
const fade = (o: SceneOut, k: number): SceneOut => k >= 0.999 ? o : { items: o.items.map((i) => ({ ...i, a: i.a * k })), layers: o.layers.map((l) => ({ ...l, a: l.a * k })) };

/** Scenes made partly of large layers: the motion's own wash and glow step back for them (visual.ts). One rule for the old and the new scene of a crossfade. */
export const sceneHasLayers = (s: SceneName | "none") => s === "aurora" || s === "smoke" || s === "clouds" || s === "rain" || s === "embers";
/** How much of the motion's own wash and glow is left under a scene: 1 with none, a quarter under layers, almost nothing under an aurora (it needs the whole budget). */
export const sceneBack = (s: SceneName | "none") => s === "aurora" || s === "smoke" || s === "clouds" ? 0.08 : sceneHasLayers(s) ? 0.25 : 1;

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
    : scene === "seeds" ? seeds(d, v, feel, c)
    : scene === "tide" ? tide(d, v, feel, c)
    : scene === "smoke" ? smoke(d, v, feel, c)
    : scene === "clouds" ? clouds(d, v, feel, c)
    : scene === "circuit" ? circuit(d, v, feel, c)
    : scene === "digital" ? digital(d, v, feel, c)
    : scene === "scope" ? scope(d, v, feel, c)
    : scene === "vines" ? vines(d, v, feel, c)
    : scene === "fireworks" ? fireworks(d, v, feel, c)
    : scene === "reeds" ? reeds(d, v, feel, c)
    : scene === "network" ? network(d, v, feel, c)
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

const sstep = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
/** A veil layer from a function of the position (x across, y down, both 0 to 1) sampled on a low-resolution grid; the painter smooths it up over the view. The fields move slowly, so each is computed for a step of time
 *  (`key` names everything it depends on, the step included) and reused by every frame in that step and every canvas on the same state. */
const VEILS = new Map<string, number[]>();
function veil(key: string, gw: number, gh: number, f: (x: number, y: number) => number, a: number, tone: { hue: number; sat: number; l: number; k: number }): Layer {
  let grid = VEILS.get(key);
  if (!grid) {
    grid = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) grid.push(clamp(f((i + 0.5) / gw, (j + 0.5) / gh)));
    VEILS.set(key, grid); if (VEILS.size > 160) VEILS.delete(VEILS.keys().next().value as string);
  }
  return { kind: "veil", x: 0.5, y: 0.5, r: 1, a, dh: 0, hue: tone.hue, sat: tone.sat, l: tone.l, k: tone.k, gw, gh, grid };
}

/** Aurora: a curtain of soft light hanging from a rippling lower edge, as in the photographs: a sharp bright base that fades upward, dense vertical striations of different lengths that slide along it, and a second,
 *  fainter colour (pink or violet) high above the green base. Two veils (low-resolution fields smoothed up over the view) share the brightness budget; a few thin rays carry the shape where the colour alone cannot. */
function aurora(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const GW = 96, GH = 44, items: Item[] = [];
  const bq = Math.floor(c.b * 6) / 6, drift = lerp(0.012, 0.06, speed), swell = c.sync === "free" ? 0.85 : 0.75 + 0.25 * (0.5 - 0.5 * Math.cos(2 * Math.PI * frac(c.beats / 16)));
  const h = lerp(0.3, 0.52, 1 - feel.jitter * 0.6), fold = lerp(0.6, 1.6, speed);
  // the lower edge: slow noise plus folds that travel along it (the curtain ripples like cloth in the wind)
  const edge = (u: number) => 0.52 + 0.07 * noise1(u * 5.5 + bq * drift, c.seed) + 0.05 * Math.sin(u * 9 - bq * drift * 5 * fold) + 0.035 * Math.sin(u * 17 + bq * drift * 7 * fold + 1.7) + 0.03 * Math.sin(u * 4 + bq * drift * 3);
  // the brightness along it: broad bands that slide sideways and pulse slowly, as they do in the sky
  const glow = (u: number) => clamp(0.55 + 0.9 * noise1(u * 14 - bq * drift * 4 * fold, c.seed + 20) + feel.jitter * 0.4 * noise1(u * 40 + bq * 0.7, c.seed + 30)) * (0.78 + 0.22 * Math.sin(2 * Math.PI * (bq / 11 + u * 2.3)));
  // the striations: many thin vertical rays of different lengths, drifting along the curtain
  const stri = (u: number) => clamp(0.5 + 0.55 * noise1(u * 58 - bq * drift * 2.4 * fold, c.seed + 5) + 0.3 * noise1(u * 21 + bq * drift * 1.4, c.seed + 6));
  const e: number[] = [], g: number[] = [], s: number[] = [];
  for (let i = 0; i < GW; i++) { const u = (i + 0.5) / GW; e.push(edge(u)); g.push(glow(u)); s.push(stri(u)); }
  // two colours that read against the field and against each other: the field's hue turned by a third and by two thirds of the wheel
  const hueA = (c.h + 120) % 360, hueB = (c.h + 240) % 360;
  // on a dark sky the glow is a vivid colour lighter than it (that is what an aurora is); on a bright one nothing can be lighter, so the curtain is a deep vivid colour darker than it
  const dark = c.bases.reduce((q, b) => q + relLuminance(b), 0) / Math.max(1, c.bases.length) < 0.3;
  const vA = dark ? { sat: 0.9, l: 0.6 } : { sat: 0.85, l: 0.3 }, vB = dark ? { sat: 0.8, l: 0.62 } : { sat: 0.8, l: 0.34 };
  const mA = toneLayer(c.bases, hueA, dark, 0.4, vA), mB = toneLayer(c.bases, hueB, dark, 0.25, vB);
  const col = (x: number) => Math.min(GW - 1, Math.floor(x * GW));
  const vk = `${c.seed}|${bq}|${Math.round(speed * 20)}|${Math.round(feel.jitter * 20)}`, base = veil(`aua|${vk}`, GW, GH, (x, y) => {
    const i = col(x), up = e[i] - y, len = h * (0.25 + 0.75 * s[i]) * (0.4 + 0.6 * g[i]);
    return (up < 0 ? Math.exp(up / 0.03) : Math.exp(-up / (len * 0.6))) * (0.3 + 0.7 * s[i]) * g[i] * 1.25;
  }, mA.a * swell, mA);
  const top = veil(`aub|${vk}`, GW, GH, (x, y) => {
    const i = col(x), up = e[i] - y; if (up <= 0) return 0;
    return sstep(0.04, 0.45 * h, up) * Math.exp(-up / (h * 1.15)) * (0.45 + 0.55 * s[i]) * g[i] * 0.95;
  }, mB.a * swell, mB);
  const rays = Math.round(lerp(14, 28, density));
  for (let r = 0; r < rays; r++) {
    // the rays sit on an even grid along the curtain and all slide together at one slow pace, so they never cross
    const u = frac((r + 0.5 + 0.5 * (hash01(r, c.seed + 40) - 0.5)) / rays + c.b * 0.004 * lerp(0.5, 1.5, speed) + 8), k = glow(u);
    if (k < 0.25) continue;
    const len = h * (0.55 + 0.6 * hash01(r, c.seed + 41)) * k * (0.75 + 0.25 * Math.sin(2 * Math.PI * (c.b / (9 + 7 * hash01(r, c.seed + 46)) + hash01(r, c.seed + 47))));
    const flick = 0.65 + 0.35 * Math.sin(2 * Math.PI * (c.b / (5 + 6 * hash01(r, c.seed + 42)) + hash01(r, c.seed + 43))), edgeFade = Math.min(1, u * 8, (1 - u) * 8);
    items.push({ kind: "streak", x: u, y: edge(u) - len, r: len, w: 0.004 + 0.004 * hash01(r, c.seed + 44), tail: true, ang: 0, a: 0.5 * k * flick * swell * edgeFade, hue: r % 3 ? hueA : hueB, sat: 95, l: 74 });
  }
  return { items, layers: [top, base] };
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

/** Smoke: a thin thread leaves the source at the bottom, then folds into soft translucent sheets that curl and billow as the air turns it over, spreading and thinning as it rises (as in a photograph of incense smoke).
 *  One veil in a tone lighter than a dark field or darker than a bright one: a density field made of a plume mask times the creases of a domain-warped noise, which is what makes the wisps. Brooding, uneasy. */
function smoke(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const tone = bestTone(c.bases, c.h, 0.16);
  const bq = Math.floor(c.b * 2.5) / 2.5, P = 1 + Math.round(4 * clamp(density)), rise = bq * lerp(0.015, 0.04, speed), wind = 0.2 * noise1(bq / 45, c.seed + 60), GW = 44, GH = 60;
  const x0 = (p: number) => (p + 0.5 + 0.4 * (hash01(p, c.seed + 61) - 0.5)) / P;
  const f = (x: number, y: number) => {
    const hh = 1 - y, hs = hh * 3 - rise * 3; // the noise is carried upward with time
    let m = 0, thin = 0;
    for (let p = 0; p < P; p++) {
      const cx = x0(p) + (wind * hh + 0.08 * noise1(bq * 0.02 + hh * 2.4 + p * 7, c.seed + 63)) * (0.4 + hh) * (1 + feel.jitter), wd = (0.02 + 0.22 * hh ** 0.9) * (P > 2 ? 0.8 : 1), dx = (x - cx) / wd;
      m += Math.exp(-dx * dx); thin += Math.exp(-dx * dx * 4);
    }
    const tw = 0.25 + 1.4 * hh, wx = fbm2(x * 2.4, hs * 0.9 + 3, c.seed + 1, 2) * tw * 0.5, wy = fbm2(x * 2.4 + 9, hs * 0.9, c.seed + 2, 2) * tw * 0.5;
    const r = fbm2(x * 4 + wx * 2.2, hs * 2.6 + wy * 2.2, c.seed + 3, 3), sheet = sstep(0.45, 0.97, 1 - Math.abs(r) * 3);
    const body = Math.min(1, m) * (0.1 + 1.1 * sheet) * Math.max(0, 1 - hh ** 2.4);
    return lerp(Math.min(1, thin) * 0.9, body, sstep(0.05, 0.25, hh));
  };
  return { items: [], layers: [veil(`smoke|${c.seed}|${bq}|${P}|${Math.round(speed * 20)}|${Math.round(feel.jitter * 20)}`, GW, GH, f, tone.a, tone)] };
}

/** Clouds: banks and puffs that drift slowly across, in two scales of noise so they have bulk and a ragged edge; thinner towards the top and the bottom of the view. A veil like the smoke, light on a dark sky and dark on a bright one. */
function clouds(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const tone = bestTone(c.bases, c.h, 0.22);
  const bq = Math.floor(c.b * 6) / 6, drift = bq * lerp(0.004, 0.014, speed), cover = lerp(-0.12, 0.2, density) + 0.1 * (feel.near - 0.5), GW = 56, GH = 40;
  const f = (x: number, y: number) => {
    const n = fbm2(x * 2.1 - drift * 2.2, y * 3.6 + 1.7 + 0.15 * noise1(bq * 0.01, c.seed + 8), c.seed + 4, 4), m = fbm2(x * 4.6 - drift * 3.6, y * 7.2, c.seed + 5, 3);
    const v = n * 0.85 + m * 0.35 + cover, body = sstep(0.04, 0.38, v);
    return body * (0.6 + 0.4 * sstep(0.15, 0.8, v)) * sstep(0, 0.14, y) * (1 - sstep(0.82, 1, y));
  };
  return { items: [], layers: [veil(`clouds|${c.seed}|${bq}|${Math.round(density * 20)}|${Math.round(speed * 20)}|${Math.round(feel.near * 20)}`, GW, GH, f, tone.a, tone)] };
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


/** Boids (Reynolds, as in the project Gael pointed to): each bird steers by three rules over staggered radii, separation (nearest, strongest), alignment (middle) and cohesion (outer), plus a pull
 *  to its speed of cruise, a little noise on its heading, a soft wall, a goal that wanders and an obstacle that wanders through and splits whatever it meets. Forces are added to the acceleration
 *  (limited), then the velocity, then the position, in fixed steps, so the simulation is the same for every listener: it restarts from the seed every EPOCH beats and is advanced by whole steps
 *  from there (a listener who joins late catches up at once). Flocks form, split, merge and change size by themselves; the cohesion breathes over time so the size goes from small to large. */
const EPOCH = 72, STEPS_PER_BEAT = 6;
interface Boids { n: number; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array; grp: Uint8Array; step: number; key: string; px: Float64Array; py: Float64Array }
const SIMS = new Map<string, Boids>();
function goalOf(f: number, step: number, seed: number): [number, number] {
  const b = step / STEPS_PER_BEAT;
  return [0.5 + 0.32 * Math.sin((2 * Math.PI * b) / (38 + 11 * f) + 2.1 * f + hash01(seed, 5)), 0.45 + 0.24 * Math.sin((2 * Math.PI * b) / (29 + 9 * f) + 1.3 * f + hash01(seed, 6))];
}
function newBoids(seed: number, n: number, nf: number, key: string): Boids {
  const B: Boids = { n, x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), grp: new Uint8Array(n), step: 0, key, px: new Float64Array(n), py: new Float64Array(n) };
  for (let i = 0; i < n; i++) {
    const g = i % nf, [gx, gy] = goalOf(g, 0, seed), a = 2 * Math.PI * hash01(i, seed + 1), r = 0.08 * Math.sqrt(hash01(i, seed + 2)), th = 2 * Math.PI * hash01(i, seed + 3);
    B.grp[i] = g; B.x[i] = gx + Math.cos(a) * r; B.y[i] = gy + Math.sin(a) * r; B.vx[i] = Math.cos(th) * 0.01; B.vy[i] = Math.sin(th) * 0.01; B.px[i] = B.x[i]; B.py[i] = B.y[i];
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
  for (let i = 0; i < n; i++) { B.px[i] = x[i]; B.py[i] = y[i]; vx[i] += ax[i]; vy[i] += ay[i]; x[i] += vx[i]; y[i] += vy[i]; }
  B.step++;
}
function flock(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const nf = 1 + Math.round(density * 2), n = Math.round(lerp(40, 80, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6;
  const ep = Math.floor(c.b / EPOCH), u = c.b - ep * EPOCH, target = Math.floor(u * STEPS_PER_BEAT), fade = Math.min(1, u / 3, (EPOCH - u) / 3);
  const key = `${c.seed}|${ep}|${n}|${nf}`;
  let B = SIMS.get(key);
  if (!B || B.step > target) { B = newBoids(c.seed + ep * 7919, n, nf, key); SIMS.set(key, B); if (SIMS.size > 96) SIMS.delete(SIMS.keys().next().value as string); }
  while (B.step < target) stepBoids(B, c.seed + ep * 7919, nf);
  const fs = clamp(u * STEPS_PER_BEAT - target); // the simulation moves in steps; the picture glides between the last two (else it moves at the step rate, a stutter)
  const lum = c.bases.reduce((a, b) => a + relLuminance(b), 0) / Math.max(1, c.bases.length), light = lum < 0.3, m = Math.min(asp, 1);
  for (let i = 0; i < n; i++) {
    const sp = Math.hypot(B.vx[i], B.vy[i]) || 1e-6, len = 0.014;
    // a short tail along the heading (the direction in pixels, so a wide view and a tall one agree)
    const dxp = B.vx[i] * asp, dyp = B.vy[i], dn = Math.hypot(dxp, dyp) || 1e-6;
    const bx = lerp(B.px[i], B.x[i], fs), by = lerp(B.py[i], B.y[i], fs);
    items.push({ kind: "dot", x: bx, y: by, r: 0.0066, w: 0, soft: 0, a: 0.5 * fade, l: light ? 97 : 7, sat: light ? 10 : 20, dh: (B.grp[i] - (nf - 1) / 2) * 22 });
    items.push({ kind: "streak", x: bx - ((dxp / dn) * len * m) / asp, y: by - (dyp / dn) * len * m, r: len, w: 0.0016, ang: Math.atan2(dxp / dn, dyp / dn), tail: true, a: 0.3 * fade, l: light ? 97 : 7, sat: light ? 10 : 20, dh: (B.grp[i] - (nf - 1) / 2) * 22 });
    void sp;
  }
  return { items, layers: [] };
}

/** Scope: an oscilloscope. A bright beam draws the figure and leaves a trail that fades behind it (phosphor); the whole figure glows faintly underneath. Three figures by how dense the picture is: a waveform
 *  swept across the screen again and again (sparse), a Lissajous figure that turns as its phase drifts (middle), a rose with petals that breathe (dense). The ratio of the Lissajous comes from a fixed
 *  list by the (quantized) speed, so a new state goes through the crossfade; ratios stay at 5 or below. The beat kicks the size and flares the beam. */
function scope(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const asp = c.aspect > 0 ? c.aspect : 0.6, m = Math.min(asp, 1), kick = 1 + 0.1 * c.hit, items: Item[] = [], mode = density < 0.3 ? 0 : density < 0.7 ? 1 : 2, N = 220;
  const A = lerp(0.22, 0.36, feel.near) * kick, lap = lerp(10, 4, speed), head = frac(c.b / lap), closed = mode > 0, trail = closed ? 0.42 : 0.5;
  const pts: number[] = [];
  if (mode === 0) { // a waveform: two or three sines whose mix beats slowly, swept left to right by the beam
    const harm = hash01(c.seed, 74) < 0.5, f1 = 2 + Math.round(3 * hash01(c.seed, 71)), f2 = f1 + 1 + Math.round(2 * hash01(c.seed, 72)), mix = 0.5 + 0.5 * Math.sin(c.b * 0.05);
    if (harm) for (let i = 0; i <= N; i++) { const u = i / N, w = 2 * Math.PI * (1.5 + f1 * 0.5) * u + c.b * 0.09; let s = 0; for (let k = 1; k <= 5; k++) s += Math.sin(k * w) / k; pts.push(0.06 + 0.88 * u, 0.5 - A * 0.7 * s * (0.5 + 0.5 * Math.sin(Math.PI * u) ** 0.5)); } // a sawtooth built from its harmonics
    else for (let i = 0; i <= N; i++) { const u = i / N; pts.push(0.06 + 0.88 * u, 0.5 - A * 0.9 * (0.6 * Math.sin(2 * Math.PI * f1 * u + c.b * 0.11) + 0.4 * mix * Math.sin(2 * Math.PI * f2 * u - c.b * 0.07)) * (0.5 + 0.5 * Math.sin(Math.PI * u) ** 0.5)); }
  } else if (mode === 1 && hash01(c.seed, 75) < 0.5) { // a spirograph (hypotrochoid), the circle rolling inside another, its pen drifting
    const Rr = 5, rr = 3, d = 3.2 + 0.8 * Math.sin(c.b * 0.03), mx = Rr - rr + d;
    for (let i = 0; i <= N; i++) { const th = (2 * Math.PI * rr * i) / N + c.b * 0.01; pts.push(0.5 + (A * m * ((Rr - rr) * Math.cos(th) + d * Math.cos(((Rr - rr) / rr) * th)) / mx) / asp, 0.5 + A * m * ((Rr - rr) * Math.sin(th) - d * Math.sin(((Rr - rr) / rr) * th)) / mx); }
  } else if (mode === 1) { // Lissajous
    const R: Array<[number, number]> = [[1, 1], [1, 2], [2, 3], [3, 4], [3, 5]], [a, b] = R[Math.round(clamp(speed) * 4)], phi = c.b * lerp(0.012, 0.04, speed);
    for (let i = 0; i <= N; i++) { const th = (2 * Math.PI * i) / N; pts.push(0.5 + (A * m * Math.sin(a * th + phi + Math.PI / 2)) / asp, 0.5 + A * m * Math.sin(b * th)); }
  } else if (hash01(c.seed, 76) < 0.5) { // a star: a small circle rolling inside a large one (7 to 2)
    const Rr = 7, rr = 2, d = 2.6 + 0.6 * Math.sin(c.b * 0.04), mx = Rr - rr + d;
    for (let i = 0; i <= N; i++) { const th = (2 * Math.PI * rr * i) / N - c.b * 0.012; pts.push(0.5 + (A * m * 1.1 * ((Rr - rr) * Math.cos(th) + d * Math.cos(((Rr - rr) / rr) * th)) / mx) / asp, 0.5 + A * m * 1.1 * ((Rr - rr) * Math.sin(th) - d * Math.sin(((Rr - rr) / rr) * th)) / mx); }
  } else { // a rose, r = cos(k theta), k from the seed (3, 4, 5 petals' worth) breathing a little
    const kk = [2, 3, 4, 5][Math.floor(hash01(c.seed, 73) * 4)] + 0.15 * Math.sin(c.b * 0.04);
    for (let i = 0; i <= N; i++) { const th = (Math.PI * 2 * i) / N, rr = Math.cos(kk * th) * 0.95; pts.push(0.5 + (A * m * 1.15 * rr * Math.cos(th)) / asp, 0.5 + A * m * 1.15 * rr * Math.sin(th)); }
  }
  items.push(pathItem(pts, 0.002, 0.1, { l: 86, sat: 60 })); // the screen's own afterglow: the whole figure, faint
  const seg = 14, per = Math.floor(N * trail / seg);
  for (let s = 0; s < seg; s++) { // the trail: the newest part brightest, the oldest gone
    const k = (s + 1) / seg, i0 = Math.floor(head * N - (seg - s) * per), i1 = i0 + per + 1, sub: number[] = [];
    for (let i = i0; i <= i1; i++) { if (!closed && (i < 0 || i > N)) continue; const j = ((i % N) + N) % N; sub.push(pts[2 * j], pts[2 * j + 1]); }
    if (sub.length >= 4) items.push(pathItem(sub, lerp(0.0018, 0.0042, k), 0.62 * k * k, { l: lerp(80, 96, k), sat: lerp(75, 45, k) }));
  }
  const hj = Math.min(N, Math.floor(head * N)), hi = ((hj % N) + N) % N;
  items.push({ kind: "dot", x: pts[2 * hi], y: pts[2 * hi + 1], r: 0.012 * (1 + 0.5 * c.hit), w: 0, soft: 1, a: 0.5, l: 95, sat: 50 }); // the beam itself
  items.push({ kind: "dot", x: pts[2 * hi], y: pts[2 * hi + 1], r: 0.0045, w: 0, soft: 0.3, a: 0.7, l: 99, sat: 20 });
  return { items, layers: [] };
}

/** Reeds: stems anchored along the bottom with a seed head each, swaying gently on their own; a gust crosses the field every few bars and bends each stem as it passes, more at the tip. Straw colours whatever the field. */
function reeds(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(14, 36, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6, per = lerp(16, 8, speed), gust = (c.b / per) % 1, gx = gust * 1.6 - 0.3;
  for (let i = 0; i < n; i++) {
    const x0 = 0.03 + (0.94 * (i + 0.5 + 0.6 * (hash01(i, c.seed + 2) - 0.5))) / n, H = lerp(0.22, 0.58, hash01(i, c.seed + 3)) * lerp(0.85, 1.1, feel.near), ph = hash01(i, c.seed + 4);
    const g = Math.exp(-(((x0 - gx) / 0.16) ** 2)) * (0.1 + 0.08 * feel.depth) * Math.sin(Math.PI * clamp(gust)), sw = 0.03 * (0.6 + feel.irreg) * Math.sin(2 * Math.PI * (c.b / (9 + 6 * ph) + ph)), D = (g + sw) * (0.6 + 0.6 * hash01(i, c.seed + 5));
    const pts: number[] = [];
    for (let k = 0; k <= 8; k++) { const s = k / 8; pts.push(x0 + (D * s ** 1.8) / 1, 1.03 - H * s * (1 - 0.25 * Math.abs(D) * 4 * s)); }
    const tx = pts[pts.length - 2], ty = pts[pts.length - 1];
    items.push(pathItem(pts, 0.0032, 0.42, { hue: 44, sat: 50, l: 60 }));
    items.push({ kind: "dot", x: tx, y: ty, r: 0.0075, w: 0, soft: 0.25, a: 0.5, hue: 38, sat: 60, l: 52 });
    void asp;
  }
  return { items, layers: [] };
}

/** Network: nodes drifting about on slow noise paths, linked whenever two are close, the link fading in and out with their distance; on each beat a few links carry a bright point from one node to the other. Thinking. */
function network(density: number, speed: number, feel: Feel, c: Clock): SceneOut {
  const n = Math.round(lerp(26, 42, density)), items: Item[] = [], asp = c.aspect > 0 ? c.aspect : 0.6, d0 = 0.3, drift = lerp(0.006, 0.02, speed);
  const P: Array<[number, number, number]> = []; // x, y and how present the node is
  for (let i = 0; i < n; i++) {
    // each node lives for a while, fading in somewhere, wandering, then fading out; it comes back somewhere else, so the links never settle into the same roads
    const per = 26 + 40 * hash01(i, c.seed + 8), t = c.b / per + hash01(i, c.seed + 9), life = Math.floor(t), u = t - life, sd = c.seed + life * 101 + 1;
    P.push([clamp(hash01(i, sd) + 0.2 * noise1(c.b * drift + i * 11, c.seed + 1), 0.03, 0.97), clamp(hash01(i, sd + 2) + 0.2 * noise1(c.b * drift + i * 11 + 70, c.seed + 3), 0.03, 0.97), Math.min(1, u * 6, (1 - u) * 6)]);
  }
  const near: number[] = new Array(n).fill(-1), nearD: number[] = new Array(n).fill(9);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.hypot((P[i][0] - P[j][0]) * asp, P[i][1] - P[j][1]) / Math.min(asp, 1), pr = P[i][2] * P[j][2];
    if (pr < 0.05) continue;
    if (d < nearD[i]) { nearD[i] = d; near[i] = j; } if (d < nearD[j]) { nearD[j] = d; near[j] = i; }
    if (d < d0) items.push(pathItem([P[i][0], P[i][1], P[j][0], P[j][1]], 0.0018, 0.42 * (1 - d / d0) ** 1.5 * pr, { l: 86, sat: 50 }));
  }
  const ease = (x: number) => x * x * (3 - 2 * x);
  for (let i = 0; i < n; i++) {
    if (P[i][2] < 0.05) continue;
    items.push({ kind: "dot", x: P[i][0], y: P[i][1], r: 0.0052, w: 0, soft: 0, a: 0.5 * P[i][2], l: 92, sat: 40 });
    const j = near[i];
    if (j >= 0 && nearD[i] < d0 && hash01(i + c.beatIdx * 37, c.seed + 6) < 0.13) { const q = ease(c.beatPh); items.push({ kind: "dot", x: lerp(P[i][0], P[j][0], q), y: lerp(P[i][1], P[j][1], q), r: 0.0075, w: 0, soft: 0.6, a: 0.55 * P[i][2], l: 96, sat: 60 }); }
  }
  return { items, layers: [] };
}
