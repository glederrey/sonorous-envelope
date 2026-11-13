import type { ResolvedColour } from "@sonorous/engine";
import { clamp, hash01, lerp, noise1, type Clock, type Feel, type Layer } from "./scene-kit";
import { hslToRgb, isSaturatedRed, matchedLayer } from "./colour-math";

// Colour play: the gradient that moves (docs/visuals.md). Two or three large lights of other hues drift over the field on slow orbits, and
// swell and shift hue on the beat. The brightness does not move: every light is painted at the lightness that changes the luminance of the
// field least (`matchedLayer`), and its swing is counted in the flash budget at its real value (`Layer.k`). So the colours can be strong and can
// pulse with the music without being a flash: a flash is a change of brightness, and this changes the colour only. A light that would be
// saturated red does not pulse at all.

/** The hues of the lights: close to the field's own for a gentle mood, wide apart (towards the complement) for a tense one, wider with joy. */
export function playHues(h: number, feel: Feel, lift2: number): number[] {
  const spread = lerp(55, 170, clamp(feel.jitter * 1.1)) + 35 * Math.max(0, lift2);
  return [h + spread, h - spread * 0.8, h + spread * 0.35 + (feel.jitter > 0.5 ? 180 - spread : 0), h - spread * 0.4, h + spread * 1.3].map((x) => ((x % 360) + 360) % 360);
}

/** Four lights, five for a tense mood. Each has its own centre, amplitude, direction and size: they circle on orbits of 10 to 40 beats that never close (a slow noise wanders them),
 *  the smaller ones show their edges sliding across the field, each breathes in size over the phrase, and on the beat they jump a little and swell. Hues stay fixed within a state:
 *  the matched lightness is chosen per hue step, so a drifting hue would flicker. */
export function colourPlay(colour: ResolvedColour, feel: Feel, c: Clock): Layer[] {
  const hues = playHues(colour.h, feel, c.lift2), n = feel.jitter > 0.5 ? 5 : 4;
  const sat = clamp(colour.s * 1.3 + 0.25, 0.45, 0.9);
  const period = lerp(40, 11, clamp(0.5 * feel.depth + 0.5 * feel.jitter)); // beats for the first orbit
  const out: Layer[] = [];
  for (let i = 0; i < n; i++) {
    const hs = (j: number) => hash01(i, c.seed + 70 + j), dir = i % 2 ? -1 : 1;
    const P = period * (0.75 + 0.3 * i + 0.2 * hs(1)), phi = 2 * Math.PI * hs(2), A = 0.16 + 0.26 * hs(3);
    const m = matchedLayer(c.bases, hues[i], sat);
    const pulses = !isSaturatedRed(hslToRgb(m.hue, m.sat, m.l)) && c.red > 0;
    // on the beat the light swells and jumps; in phrase sync it swells slowly over four bars instead
    const beat = c.sync === "beat" ? c.hit : c.sync === "phrase" ? 0.5 - 0.5 * Math.cos(2 * Math.PI * ((c.beats / 16 + i / n) % 1)) : 0;
    const swell = pulses ? beat : 0;
    const kick = pulses && c.sync === "beat" ? c.hit * 0.05 : 0;
    const cx = 0.5 + (hs(4) - 0.5) * 0.3 + A * Math.sin((2 * Math.PI * c.b * dir) / P + phi) + 0.12 * noise1(c.b / 21 + i * 5, c.seed + 80) + kick * (hash01(c.beatIdx, i + c.seed) - 0.5) * 2;
    const cy = 0.5 + (hs(5) - 0.5) * 0.3 + A * 0.9 * Math.cos((2 * Math.PI * c.b * dir) / (P * 1.27) + phi * 1.7) + 0.12 * noise1(c.b / 25 + i * 7, c.seed + 90) + kick * (hash01(c.beatIdx, i + c.seed + 9) - 0.5) * 2;
    const breathe = 1 + 0.3 * Math.sin((2 * Math.PI * c.beats) / 16 + phi);
    out.push({
      kind: "tint", x: cx, y: cy, r: lerp(0.35, 0.58, hs(6)) * lerp(0.9, 1.25, feel.near) * breathe * (1 + 0.1 * swell),
      a: clamp(lerp(0.5, 0.72, 0.5 + 0.5 * (feel.lift - 0.5)) * (0.85 + 0.35 * swell), 0, 0.8), dh: 0, hue: m.hue, sat: m.sat * 100, l: m.l * 100, k: m.k,
    });
  }
  return out;
}
