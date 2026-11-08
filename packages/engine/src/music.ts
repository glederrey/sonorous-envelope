import type { Pattern, ScaleName } from "./types";

export const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 2, 4, 7, 9],
  whole_tone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "D3" → 50, "F#2" → 42, "Bb4" → 70 (C4 = 60). Returns undefined for anything else. */
export function noteToMidi(name: string): number | undefined {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) return undefined;
  const semis = NAMES[m[1].toUpperCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 12 * (Number(m[3]) + 1) + semis;
}

export const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Scale degree (1-based) to MIDI. Degrees past the top of the scale continue into the next octave (8 = 1 up an octave in a 7-note scale). */
export function degreeToMidi(root: number, scale: ScaleName, degree: number): number {
  const s = SCALES[scale];
  const i = Math.max(1, Math.round(degree)) - 1;
  return root + s[i % s.length] + 12 * Math.floor(i / s.length);
}

/** Notes of one arpeggio cycle: the chord, repeated upward over `octaves`, ordered by `pattern`. */
export function buildCycle(
  root: number, scale: ScaleName, chord: number[], octaves: number, pattern: Pattern,
): number[] {
  const base = (chord.length ? chord : [1]).map((d) => degreeToMidi(root, scale, d));
  const up: number[] = [];
  for (let o = 0; o < Math.max(1, octaves); o++) for (const n of base) up.push(n + 12 * o);
  switch (pattern) {
    case "down": return [...up].reverse();
    case "up_down": return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    default: return up; // "up", "as_played" (chord order), "random" (picked per step)
  }
}
