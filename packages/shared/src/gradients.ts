import type { ResolvedColour } from "@sonorous/engine";
import { clamp, lerp, type Clock, type Feel, type Layer } from "./scene-kit";
import { hslToRgb, isSaturatedRed, matchedLayer } from "./colour-math";

// Colour play: the gradient that moves (docs/visuals.md). Two or three large lights of other hues drift over the field on slow orbits, and
// swell and shift hue on the beat. The brightness does not move: every light is painted at the lightness that changes the luminance of the
// field least (`matchedLayer`), and its swing is counted in the flash budget at its real value (`Layer.k`). So the colours can be strong and can
// pulse with the music without being a flash: a flash is a change of brightness, and this changes the colour only. A light that would be
// saturated red does not pulse at all.

/** The hues of the lights: close to the field's own for a gentle mood, wide apart (towards the complement) for a tense one, wider with joy. */
export function playHues(h: number, feel: Feel, lift2: number): number[] {
  const spread = lerp(32, 165, clamp(feel.jitter * 1.1)) + 30 * Math.max(0, lift2);
  return [h + spread, h - spread * 0.8, h + spread * 0.35 + (feel.jitter > 0.5 ? 180 - spread : 0)].map((x) => ((x % 360) + 360) % 360);
}

export function colourPlay(colour: ResolvedColour, feel: Feel, c: Clock): Layer[] {
  const hues = playHues(colour.h, feel, c.lift2);
  const sat = clamp(colour.s * 1.3 + 0.12, 0.25, 0.88);
  const period = lerp(150, 50, clamp(0.55 * feel.depth + 0.45 * feel.jitter)) / (c.sync === "free" ? 1 : 1); // beats for an orbit
  const out: Layer[] = [];
  for (let i = 0; i < hues.length; i++) {
    const P = period * (1 + 0.37 * i), phi = 2.1 * i + 0.7;
    const rest = matchedLayer(c.bases, hues[i], sat);
    const pulses = !isSaturatedRed(hslToRgb(rest.hue, rest.sat, rest.l)) && !isSaturatedRed(hslToRgb(rest.hue + 16, rest.sat, rest.l)) && c.red > 0;
    // on the beat the light swells and its hue leans by a few degrees; in phrase sync it swells slowly over four bars instead
    const beat = c.sync === "beat" ? c.hit : c.sync === "phrase" ? 0.5 - 0.5 * Math.cos(2 * Math.PI * ((c.beats / 16 + i / 3) % 1)) : 0;
    const swell = pulses ? beat : 0;
    const m = swell > 0.01 ? matchedLayer(c.bases, hues[i] + 16 * swell, sat) : rest; // the hue leans on the beat: snapped to a step whose swing is known
    out.push({
      kind: "tint", x: 0.5 + 0.4 * Math.sin((2 * Math.PI * c.b) / P + phi), y: 0.5 + 0.36 * Math.cos((2 * Math.PI * c.b) / (P * 1.31) + phi * 1.7),
      r: lerp(0.6, 0.95, feel.near) * (0.9 + 0.12 * i) * (1 + 0.1 * swell), a: clamp(lerp(0.34, 0.55, 0.5 + 0.5 * (feel.lift - 0.5)) * (0.8 + 0.4 * swell), 0, 0.6),
      dh: 0, hue: m.hue, sat: m.sat * 100, l: m.l * 100, k: m.k,
    });
  }
  return out;
}
