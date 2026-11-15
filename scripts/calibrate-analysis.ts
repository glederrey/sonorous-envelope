// Renders random moods through the mapping and the analysis, prints the feature ranges used by `norm()` in
// packages/shared/src/analysis.ts and how well `reads_as` tracks the mood that was sent. Usage: pnpm calibrate [count]
import { analyze, alignToVoice, applyOverride, voiceToSynth, nextBand, BAND_SCALE, measure, readFeatures, moodToEngineState, stretchMood, voiceSeedOf, type Mood } from "@sonorous/shared";

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

// per axis: mean error (read - sent) and the slope of read on sent (1 = tracks, below 1 = compresses the range)
const stats = (xs: number[], ys: number[]) => {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let n = 0, d = 0; for (let i = 0; i < xs.length; i++) { n += (xs[i] - mx) * (ys[i] - my); d += (xs[i] - mx) ** 2; }
  return { bias: my - mx, slope: n / d };
};
console.log("\nbias (mean read - sent) and slope of read on sent, over the random moods:");
for (const a of axes) {
  const { bias, slope } = stats(rows.map((r) => r.mood[a]), rows.map((r) => r.reads[a]));
  console.log(`${a.padEnd(12)} bias=${bias >= 0 ? "+" : ""}${bias.toFixed(3)} slope=${slope.toFixed(2)}`);
}

// round trip at neutral other axes, through the path the server uses: the sent mood is stretched, mapped, analysed.
// "no voice" is the mapping alone; "auto voice" adds the scale of the joy band that a drawn voice takes (voice-band.ts)
const neutralMood: Mood = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5 };
const roundTrip = (sent: Mood, scale?: string) => {
  const m = stretchMood(sent);
  let state = moodToEngineState(m, m, voiceSeedOf("round-trip"));
  const voice = scale ? { scale } as never : undefined;
  if (voice) state = applyOverride(alignToVoice(state, voice), voiceToSynth(voice)).state;
  return analyze(state, 1).reads_as;
};
const show = (title: string, axis: "warmth" | "joy", levels: number[], voice: boolean | string) => {
  console.log(`\n${title}`);
  for (const v of levels) {
    const sent = { ...neutralMood, [axis]: v };
    const scale = voice === true ? BAND_SCALE[nextBand(undefined, stretchMood(sent).joy)] : voice || undefined;
    const read = roundTrip(sent, scale)[axis];
    console.log(`  sent ${v.toFixed(2)} read ${read.toFixed(2)} (${read - v >= 0 ? "+" : ""}${(read - v).toFixed(2)})${scale ? ` scale=${scale}` : ""}`);
  }
};
show("round trip, warmth, no voice:", "warmth", [0.2, 0.4, 0.6, 0.8, 0.9], false);
show("round trip, joy, no voice:", "joy", [0.2, 0.4, 0.6, 0.8], false);
show("round trip, joy, auto voice (scale follows the joy band):", "joy", [0.2, 0.4, 0.6, 0.8], true);
show("round trip, joy, dorian voice:", "joy", [0.6], "dorian");
for (const sc of ["lydian", "major", "mixolydian", "dorian", "minor", "phrygian"]) show(`joy 0.6 on a ${sc} voice:`, "joy", [0.6], sc);
