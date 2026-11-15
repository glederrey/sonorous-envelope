// Least-squares fit of the warmth reading (packages/shared/src/analysis.ts, readFeatures) on random moods, moods with an adopted voice
// (wave and scale bands, voice-band.ts) and a warmth sweep at neutral axes. Prints the coefficients and r. Usage: pnpm fit-warmth
import { alignToVoice, applyOverride, voiceToSynth, BAND_SCALE, nextBand, nextWaveBand, measure, moodToEngineState, stretchMood, voiceSeedOf, type Mood } from "@sonorous/shared";
type F = ReturnType<typeof measure>;
const SETS: Record<string, (f: F) => number[]> = {
  "ln c, rough, wrough": (f) => [Math.log(Math.max(60, f.centroidHz)), f.roughness, f.waveRoughness],
  "ln c, ln(c/pitch), rough, wrough": (f) => [Math.log(Math.max(60, f.centroidHz)), Math.log(Math.max(1, f.centroidHz) / Math.max(30, f.pitchHz)), f.roughness, f.waveRoughness],
  "ln(c/pitch), rough, wrough": (f) => [Math.log(Math.max(1, f.centroidHz) / Math.max(30, f.pitchHz)), f.roughness, f.waveRoughness],
  "ln(c/pitch), wrough": (f) => [Math.log(Math.max(1, f.centroidHz) / Math.max(30, f.pitchHz)), f.waveRoughness],
  "ln(c/pitch), rough": (f) => [Math.log(Math.max(1, f.centroidHz) / Math.max(30, f.pitchHz)), f.roughness],
  "ln c, ln(c/pitch), rough": (f) => [Math.log(Math.max(60, f.centroidHz)), Math.log(Math.max(1, f.centroidHz) / Math.max(30, f.pitchHz)), f.roughness],
};
let s = 777; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const rows: Array<{ f: F; y: number; tag: string }> = [];
const add = (sent: Mood, seed: string, adopt: boolean, tag: string) => {
  const m = stretchMood(sent);
  let st = moodToEngineState(m, m, voiceSeedOf(seed));
  if (adopt) { const v = { scale: BAND_SCALE[nextBand(undefined, m.joy)], wave: nextWaveBand(undefined, m.warmth) } as never; st = applyOverride(alignToVoice(st, v), voiceToSynth(v)).state; }
  rows.push({ f: measure(st, 1), y: sent.warmth, tag });
};
for (let i = 0; i < 300; i++) add({ warmth: rnd(), closeness: rnd(), joy: rnd(), calm: rnd(), spontaneity: rnd() }, `cal-${i}`, false, "random");
for (let i = 0; i < 150; i++) add({ warmth: rnd(), closeness: 0.3 + 0.4 * rnd(), joy: 0.3 + 0.5 * rnd(), calm: 0.4 + 0.5 * rnd(), spontaneity: 0.2 + 0.4 * rnd() }, `ad-${i}`, true, "adopted");
for (const w of [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95]) for (const sd of ["a", "b", "c", "d"]) add({ warmth: w, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5 }, `sw-${sd}`, false, "sweep");
for (let i = 0; i < 40; i++) add({ warmth: 0.8, closeness: 0.5, joy: 0.7, calm: 0.72, spontaneity: 0.4 }, `warm-${i}`, true, "warm08");
const solve = (X: number[][], Y: number[]) => {
  const k = X[0].length, A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let r = 0; r < X.length; r++) for (let i = 0; i < k; i++) { for (let j = 0; j < k; j++) A[i][j] += X[r][i] * X[r][j]; A[i][k] += X[r][i] * Y[r]; }
  for (let i = 0; i < k; i++) { const p = A[i][i]; for (let j = i; j <= k; j++) A[i][j] /= p; for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i]; for (let j = i; j <= k; j++) A[r][j] -= f * A[i][j]; } }
  return A.map((row) => row[k]);
};
const corr = (a: number[], b: number[]) => { const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length; let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db); };
for (const [name, fx] of Object.entries(SETS)) {
  const fit = rows.filter((r) => r.tag !== "warm08"), X = fit.map((r) => [1, ...fx(r.f)]), b = solve(X, fit.map((r) => r.y));
  const pred = (r: (typeof rows)[number]) => Math.min(1, Math.max(0, [1, ...fx(r.f)].reduce((a, v, i) => a + v * b[i], 0)));
  const rnd = rows.filter((r) => r.tag === "random"), warm = rows.filter((r) => r.tag === "warm08").map(pred).sort((x, y) => x - y);
  console.log(`${name.padEnd(34)} coef ${b.map((x) => x.toFixed(3)).join(" ")}  r(all) ${corr(fit.map((r) => r.y), fit.map(pred)).toFixed(3)} r(random) ${corr(rnd.map((r) => r.y), rnd.map(pred)).toFixed(3)}  warm 0.8 adopted: min ${warm[0].toFixed(2)} p10 ${warm[4].toFixed(2)} med ${warm[20].toFixed(2)}`);
}
