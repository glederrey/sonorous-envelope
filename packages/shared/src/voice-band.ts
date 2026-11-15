import type { Wave } from "@sonorous/engine";

/**
 * A voice the model did not choose (the first sound became it) keeps its root, chord, note order and octaves for good,
 * but its scale mode follows joy in three bands, and its wave follows warmth in four (below), so joy can still lift or lower the colour of the sound without moving the
 * key. One mode per band, and the edges have hysteresis so a joy hovering at an edge cannot flip the mode back and forth.
 * Thresholds are on the stretched joy (what the mapping uses; a sent 0.4 to 0.7 is about 0.34 to 0.82). A voice or a scale
 * the model sends itself is never touched.
 */
export type Band = "low" | "mid" | "high";

export const BAND_SCALE = { low: "phrygian", mid: "dorian", high: "lydian" } as const;

const HIGH_ENTER = 0.7, HIGH_EXIT = 0.55, LOW_ENTER = 0.3, LOW_EXIT = 0.45;

/** The band after this call: from where it was, and the joy now. */
export function nextBand(prev: Band | undefined, joy: number): Band {
  if (prev === "high") return joy >= HIGH_EXIT ? "high" : joy < LOW_ENTER ? "low" : "mid";
  if (prev === "low") return joy <= LOW_EXIT ? "low" : joy > HIGH_ENTER ? "high" : "mid";
  return joy > HIGH_ENTER ? "high" : joy < LOW_ENTER ? "low" : "mid";
}

/** The oscillator wave of an auto-drawn voice follows warmth, the same bands as the mapping (warmth is carried by the timbre, so a wave
 *  fixed at the first sound leaves the warmth reading nearly flat), with hysteresis like the scale. Four even bands of the SENT warmth
 *  (square below 0.25, sawtooth to 0.5, triangle to 0.75, sine above): the thresholds are on the stretched value, stretch(0.25) = 0.1 and
 *  stretch(0.75) = 0.9. Before v0.19.3 they were 0.2, 0.4, 0.66 stretched, so sawtooth only covered a sent 0.31 to 0.44 (v0.19.2 tests). */
export const WAVE_ORDER = ["square", "sawtooth", "triangle", "sine"] as const satisfies readonly Wave[];
export const WAVE_EDGES = [0.1, 0.5, 0.9];
const WAVE_MARGIN = 0.05;

/** The wave after this call: from where it was, and the warmth now. It stays while warmth is within the margin of its own band. */
export function nextWaveBand(prev: Wave | undefined, warmth: number): Wave {
  const raw = waveIndex(warmth);
  const p = prev === undefined ? -1 : WAVE_ORDER.indexOf(prev as (typeof WAVE_ORDER)[number]);
  if (p < 0) return WAVE_ORDER[raw];
  const lo = p > 0 ? WAVE_EDGES[p - 1] - WAVE_MARGIN : -Infinity, hi = p < WAVE_EDGES.length ? WAVE_EDGES[p] + WAVE_MARGIN : Infinity;
  return warmth >= lo && warmth < hi ? WAVE_ORDER[p] : WAVE_ORDER[raw];
}

/** The band of a (stretched) warmth, lower edge included: a neutral 0.5 is triangle, not sawtooth. */
export const waveIndex = (warmth: number) => WAVE_EDGES.filter((e) => warmth >= e).length;
