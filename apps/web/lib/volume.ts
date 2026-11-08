// The player's volume slider shows 0 to 100 but works in decibels, because loudness is perceived logarithmically:
// with a linear gain, most of the slider's range sounds the same and only the bottom end changes anything.
// 0.8 on the slider is unity (the sound as mapped); the top of the slider boosts by 12 dB, which the engine's soft
// limiter keeps from clipping; the bottom is -48 dB, then silence.
const DB_AT_ZERO = -48;
const DB_PER_UNIT = 60; // slider 0..1 spans -48 dB .. +12 dB
const SILENT_BELOW = 0.02;

export function sliderToGain(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  if (p < SILENT_BELOW) return 0;
  return 10 ** ((DB_AT_ZERO + DB_PER_UNIT * p) / 20);
}

export function sliderToDb(position: number): number | null {
  const p = Math.min(1, Math.max(0, position));
  return p < SILENT_BELOW ? null : DB_AT_ZERO + DB_PER_UNIT * p;
}
