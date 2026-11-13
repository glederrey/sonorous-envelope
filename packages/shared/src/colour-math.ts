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
  if (memo.size > 600) memo.clear();
  memo.set(key, best);
  return best;
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
