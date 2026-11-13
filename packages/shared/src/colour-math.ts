export type Rgb = [number, number, number];

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

const mix = (b: Rgb, c: Rgb, a: number): Rgb => [b[0] + (c[0] - b[0]) * a, b[1] + (c[1] - b[1]) * a, b[2] + (c[2] - b[2]) * a];

/** The most the relative luminance of a base colour can change per unit of opacity when a layer of colour `c` is painted over it (the canvas blends in sRGB). */
export function luminanceSwingPerAlpha(base: Rgb, c: Rgb): number {
  const l0 = relLuminance(base);
  let k = 0;
  for (let a = 0.05; a <= 1.0001; a += 0.05) k = Math.max(k, Math.abs(relLuminance(mix(base, c, a)) - l0) / a);
  return k;
}

const memo = new Map<string, { hue: number; sat: number; l: number; k: number }>();
/** The lightness (0 to 1) at which a layer of this hue and saturation changes the luminance of the given base colours least, and that swing per unit of opacity
 *  (at the worst of the bases). A vivid layer of matched luminance can be strongly opaque and still change the brightness hardly at all: it is the colour that moves, not the light.
 *  The hue (steps of 5 degrees) and the saturation (steps of 0.1) are snapped, and returned: the swing is exact for the colour that is painted. */
export function matchedLayer(bases: Rgb[], hue: number, sat: number): { hue: number; sat: number; l: number; k: number } {
  const qh = ((Math.round(hue / 5) * 5) % 360 + 360) % 360, qs = Math.round(clamp01(sat) * 10) / 10;
  const key = `${bases.map((b) => b.map(Math.round).join(",")).join("|")}|${qh}|${qs}`;
  const hit = memo.get(key);
  if (hit) return hit;
  let best = { hue: qh, sat: qs, l: 0.5, k: 9 };
  for (let l = 0.06; l <= 0.93; l += 0.04) {
    const c = hslToRgb(qh, qs, l);
    const k = Math.max(...bases.map((b) => luminanceSwingPerAlpha(b, c)));
    if (k < best.k) best = { hue: qh, sat: qs, l, k };
  }
  best = { ...best, k: Math.max(0.01, best.k) };
  if (memo.size > 6000) memo.clear();
  memo.set(key, best);
  return best;
}
/** A layer that is lighter than the field (on a dark one) or darker (on a bright one), nearly colourless: for things that must be seen as a shape (smoke, cloud), which a layer matched to the field's brightness cannot be.
 *  With `vivid` (a saturation and lightness) the colour is that one instead of a grey (an aurora's glow). Returns its colour, the most opaque it may be, and `k`: the swing per unit of opacity that holds at every opacity up to that one, so that `a * k` is within `budget` (the real swing is smaller still:
 *  the blend is in sRGB, so a faint layer changes the luminance far less than a full one, and the plain "worst ratio up to full opacity" would throw most of the budget away). */
export function toneLayer(bases: Rgb[], hue: number, light: boolean, budget: number, vivid?: { sat: number; l: number }): { hue: number; sat: number; l: number; k: number; a: number } {
  const l = vivid ? vivid.l : light ? 0.93 : 0.07, s = vivid ? vivid.sat : 0.08, c = hslToRgb(hue, s, l);
  let a = 0, k = 0.01, worst = 0.01;
  for (let q = 0.01; q <= 0.9001; q += 0.01) {
    worst = Math.max(worst, ...bases.map((b) => Math.abs(relLuminance(mix(b, c, q)) - relLuminance(b)) / q));
    if (q * worst > budget) break;
    a = q; k = worst;
  }
  return { hue, sat: s * 100, l: l * 100, k, a: Math.max(0.01, a) };
}
/** The tone for a pale thing (smoke, cloud): light on every field but a really bright one, where nothing can be lighter and it turns dark. */
export function bestTone(bases: Rgb[], hue: number, budget: number): { hue: number; sat: number; l: number; k: number; a: number } {
  const lum = bases.reduce((s, b) => s + relLuminance(b), 0) / Math.max(1, bases.length);
  return toneLayer(bases, hue, lum < 0.4, budget);
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
