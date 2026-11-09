// Renders random moods through the mapping and the analysis, prints the feature ranges used by `norm()` in
// packages/shared/src/analysis.ts and how well `reads_as` tracks the mood that was sent. Usage: pnpm calibrate [count]
import { measure, readFeatures, moodToEngineState, stretchMood, voiceSeedOf, type Mood } from "@sonorous/shared";

const count = Number(process.argv[2] ?? 200);
let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const axes = ["warmth", "closeness", "joy", "calm", "spontaneity"] as const;
const rows: Array<{ mood: Mood; reads: Record<string, number>; f: ReturnType<typeof measure> }> = [];
for (let i = 0; i < count; i++) {
  const mood: Mood = { warmth: rnd(), closeness: rnd(), joy: rnd(), calm: rnd(), spontaneity: rnd() };
  const state = moodToEngineState(stretchMood(mood), stretchMood(mood), voiceSeedOf(`cal-${i}`));
  const f = measure(state, i + 1);
  rows.push({ mood, reads: readFeatures(f, state.arp.tempo).reads_as, f });
}
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
for (const k of ["centroidHz", "loudnessDb", "density", "flux", "fluxVariance", "roughness", "highFreqRatio", "tailRatio", "width"] as const) {
  const xs = rows.map((r) => r.f[k]);
  console.log(`${k.padEnd(14)} p5=${pct(xs, 0.05).toFixed(3)} p50=${pct(xs, 0.5).toFixed(3)} p95=${pct(xs, 0.95).toFixed(3)} min=${Math.min(...xs).toFixed(3)} max=${Math.max(...xs).toFixed(3)}`);
}
const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};
console.log("\ncorrelation of reads_as with the mood that was sent:");
for (const a of axes) console.log(`${a.padEnd(12)} ${corr(rows.map((r) => r.mood[a]), rows.map((r) => r.reads[a])).toFixed(2)}`);
