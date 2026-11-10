/**
 * A voice the model did not choose (the first sound became it) keeps its root, wave, chord, note order and octaves for good,
 * but its scale mode follows joy in three bands, so joy can still lift or lower the colour of the sound without moving the
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
