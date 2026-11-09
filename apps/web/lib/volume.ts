// The player's volume slider shows 0 to 100 but works in decibels, because loudness is perceived logarithmically:
// with a linear gain, most of the slider's range sounds the same and only the bottom end changes anything.
// 0.8 on the slider is unity (the sound as mapped); the top of the slider boosts by 18 dB, which the engine's soft
// limiter keeps from clipping (it also makes iPhone speakers, which are quiet, usable at the top); the bottom is
// -48 dB, then silence.
const UNITY_AT = 0.8;
const DB_AT_ZERO = -48;
const DB_PER_UNIT_BELOW = -DB_AT_ZERO / UNITY_AT; // 60: slider 0..0.8 spans -48 dB .. 0 dB
const DB_AT_TOP = 18;
const DB_PER_UNIT_ABOVE = DB_AT_TOP / (1 - UNITY_AT); // 90: slider 0.8..1 spans 0 dB .. +18 dB
const SILENT_BELOW = 0.02;

function dbAt(p: number): number {
  return p <= UNITY_AT ? DB_AT_ZERO + DB_PER_UNIT_BELOW * p : DB_PER_UNIT_ABOVE * (p - UNITY_AT);
}

export function sliderToGain(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  if (p < SILENT_BELOW) return 0;
  return 10 ** (dbAt(p) / 20);
}

export function sliderToDb(position: number): number | null {
  const p = Math.min(1, Math.max(0, position));
  return p < SILENT_BELOW ? null : dbAt(p);
}
