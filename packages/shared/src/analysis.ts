import { buildCycle, renderOffline, type EngineState, type NoteEvent } from "@sonorous/engine";

// Analysis of what a state sounds like (docs/implementation/analysis.md). It renders the state offline with the shared
// engine and measures the audio and the note events. `reads_as` is computed from those measurements only, never from the
// mood Claude sent, so it is an independent second opinion. It is a set of heuristics: calibrate by ear and on the
// reference moods (`pnpm calibrate`), and treat it as a rough reading.

const SR = 22050;
const RENDER_SECONDS = 6; // at least; a slow sound is rendered longer so that it has enough note onsets to read its timing from
const ONSETS_WANTED = 10;
const IRREGULARITY_GAIN = 5; // an rms deviation of a fifth of a step reads as fully irregular
const SKIP_SECONDS = 1; // steady state: leave out the start
const FRAME = 1024, HOP = 512, BANDS = 32;

export interface Features {
  loudnessDb: number; centroidHz: number; highFreqRatio: number; flux: number; fluxVariance: number;
  density: number; roughness: number; modeBrightness: number; onsetIrregularity: number; patternEntropy: number;
  width: number; tailRatio: number; pitchLow: number; pitchHigh: number;
  /** How much of what sounds together clashes: the summed weight of the semitone, tritone and major-seventh pairs among the notes sounding together (not divided by their number, so every clashing note adds to it). */
  clash: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const norm = (x: number, [lo, hi]: readonly [number, number]) => clamp01((x - lo) / (hi - lo));
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Ranges used to scale each feature to [0,1]; measured on random moods with `pnpm calibrate`. */
export const RANGES = {
  centroid: [150, 1900], loudness: [-31, -24], loudnessWide: [-32, -17], density: [1, 8], flux: [0.06, 0.25], tempo: [56, 150], fluxVar: [0, 0.03], clash: [1.5, 6.5],
} as const satisfies Record<string, readonly [number, number]>;

// ---- FFT (radix-2, in place) ----
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const HANN = Float64Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));

// ---- roughness: Plomp-Levelt dissonance (Sethares) of notes sounding together, with 6 harmonics ----
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
function pairDissonance(f1: number, a1: number, f2: number, a2: number) {
  const [lo, hi] = f1 < f2 ? [f1, f2] : [f2, f1];
  const s = 0.24 / (0.0207 * lo + 18.96);
  const d = hi - lo;
  return Math.min(a1, a2) * (Math.exp(-3.5 * s * d) - Math.exp(-5.75 * s * d));
}
function chordDissonance(midis: number[]) {
  const parts: Array<[number, number]> = [];
  for (const m of midis) for (let h = 1; h <= 6; h++) parts.push([hz(m) * h, 1 / h]);
  let d = 0;
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) d += pairDissonance(parts[i][0], parts[i][1], parts[j][0], parts[j][1]);
  return d;
}
/** A minor second at mid register reads as 1. */
const MINOR_SECOND = chordDissonance([60, 61]);

// ---- key profiles (Krumhansl-Kessler) for the mode estimate ----
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a: number[], b: number[]) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
function modeBrightness(midis: number[]) {
  if (!midis.length) return 0.5;
  const hist = new Array(12).fill(0);
  for (const m of midis) hist[((m % 12) + 12) % 12]++;
  const best = (profile: number[]) => Math.max(...Array.from({ length: 12 }, (_, t) => corr(hist, profile.map((_, i) => profile[(i - t + 12) % 12]))));
  const key = 0.5 + 0.5 * (best(MAJOR) - best(MINOR));
  // a handful of notes fits a major key and its relative minor equally well, so also look at the third above the lowest
  // note (the likely tonic): a major third reads bright, a minor third dark, none is neutral
  const tonic = ((Math.min(...midis) % 12) + 12) % 12;
  const major = hist[(tonic + 4) % 12], minor = hist[(tonic + 3) % 12];
  const third = major + minor > 0 ? major / (major + minor) : 0.5;
  return clamp01(0.4 * key + 0.6 * third);
}

/** Render a state in steady state and measure it. */
export function measure(state: EngineState, seed = 1): Features {
  const steady: EngineState = JSON.parse(JSON.stringify(state));
  steady.transition = { time: 0.03, curve: "smooth" };
  const stepSeconds = (60 / steady.arp.tempo) * ({ "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 } as Record<string, number>)[steady.arp.rate];
  const seconds = Math.min(14, Math.max(RENDER_SECONDS, SKIP_SECONDS + ONSETS_WANTED * stepSeconds));
  const { left, right, events } = renderOffline(steady, { seconds, sampleRate: SR, seed });
  const start = SKIP_SECONDS * SR;
  const n = left.length - start;
  const mono = new Float64Array(n);
  let ms = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const l = left[start + i], r = right[start + i];
    mono[i] = (l + r) / 2; ms += mono[i] * mono[i]; ss += ((l - r) / 2) ** 2;
  }
  const rms = Math.sqrt(ms / n);
  const loudnessDb = 20 * Math.log10(Math.max(rms, 1e-6));

  // frames: spectrum, centroid, high-frequency share, band energies for the flux
  const centroids: number[] = [], bandFrames: number[][] = [], frameRms: number[] = [];
  let hiE = 0, totE = 0;
  const re = new Float64Array(FRAME), im = new Float64Array(FRAME);
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => Math.round(Math.pow(FRAME / 2, i / BANDS)));
  for (let f = 0; f + FRAME <= n; f += HOP) {
    let fe = 0;
    for (let i = 0; i < FRAME; i++) { re[i] = mono[f + i] * HANN[i]; im[i] = 0; fe += mono[f + i] ** 2; }
    frameRms.push(Math.sqrt(fe / FRAME));
    fft(re, im);
    let num = 0, den = 0;
    const bands = new Array(BANDS).fill(0);
    for (let k = 1; k < FRAME / 2; k++) {
      const mag = Math.hypot(re[k], im[k]), freq = (k * SR) / FRAME;
      num += mag * freq; den += mag; totE += mag * mag; if (freq > 3000) hiE += mag * mag;
      let b = 0; while (b < BANDS - 1 && k >= edges[b + 1]) b++;
      bands[b] += mag;
    }
    centroids.push(den > 1e-9 ? num / den : 0);
    const bt = bands.reduce((s, v) => s + v, 0) || 1;
    bandFrames.push(bands.map((v) => v / bt));
  }
  const sortedC = [...centroids].sort((a, b) => a - b);
  const centroidHz = sortedC.length ? sortedC[Math.floor(sortedC.length / 2)] : 0;
  const fluxes: number[] = [];
  for (let i = 1; i < bandFrames.length; i++) {
    let fl = 0; for (let b = 0; b < BANDS; b++) fl += Math.max(0, bandFrames[i][b] - bandFrames[i - 1][b]);
    fluxes.push(fl);
  }
  const flux = fluxes.length ? fluxes.reduce((s, v) => s + v, 0) / fluxes.length : 0;
  const fluxVariance = fluxes.length ? fluxes.reduce((s, v) => s + (v - flux) ** 2, 0) / fluxes.length : 0;
  const meanFrame = frameRms.reduce((s, v) => s + v, 0) / Math.max(1, frameRms.length);
  const tailRatio = meanFrame > 1e-9 ? clamp01(Math.min(...frameRms) / meanFrame) : 0; // tails and drones fill the gaps between notes

  // note events after the skipped start
  const ev: NoteEvent[] = events.filter((e) => e.time >= SKIP_SECONDS);
  const density = ev.length / (seconds - SKIP_SECONDS);
  const held = [...(state.drone.on ? state.drone.notes : []), ...(state.pad?.on ? state.pad.notes : [])];
  // pitch content for the mode estimate: the notes the layers cycle through (a few seconds of events is too little for a
  // key profile), plus what is held
  const pitches = [
    ...(state.arp.on ? buildCycle(state.arp.root, state.arp.scale, state.arp.chord, state.arp.octaves, state.arp.pattern) : []),
    ...(state.bass.on ? buildCycle(state.bass.root, state.bass.scale, state.bass.chord, 1, "up") : []),
    ...held,
  ];

  // roughness: notes within 0.4 s of each other plus the held ones
  let rough = 0, cnt = 0;
  for (let i = 0; i < ev.length; i += 2) {
    const set = new Set<number>(held);
    for (const e of ev) if (e.time <= ev[i].time && e.time > ev[i].time - 0.4) set.add(e.midi);
    if (set.size >= 2) { rough += chordDissonance([...set].slice(0, 6)) / Math.max(1, (set.size * (set.size - 1)) / 2) / (MINOR_SECOND || 1); cnt++; }
  }
  const roughness = clamp01(cnt ? rough / cnt : 0);

  // clash: how many of the note pairs sounding together are a semitone, a tritone or a major seventh. Unlike roughness it is
  // not diluted by the consonant pairs a bigger chord adds.
  const CLASH_W = [0, 1, 0.25, 0, 0, 0, 0.8, 0, 0, 0, 0.25, 1];
  let clashSum = 0, clashN = 0;
  for (let i = 0; i < ev.length; i += 2) {
    const set = new Set<number>(held);
    for (const e of ev) if (e.time <= ev[i].time && e.time > ev[i].time - 0.4) set.add(e.midi);
    const notes = [...set].slice(0, 8);
    if (notes.length < 2) continue;
    // the summed weight, divided neither by the pairs nor by the notes: a mean over either would let a fresh clashing note lower
    // the reading by adding consonant partners (round 5: 0.6 read 0.90 and 0.9 read 0.71 with the same chord)
    let w = 0;
    for (let a = 0; a < notes.length; a++) for (let b = a + 1; b < notes.length; b++) w += CLASH_W[Math.abs(notes[a] - notes[b]) % 12];
    clashSum += w; clashN++;
  }
  const clash = clashN ? clashSum / clashN : 0;

  // onsets: distinct times (a stack starts several voices at once)
  const times = [...new Set(ev.filter((e) => e.layer === "arp").map((e) => Math.round(e.time * 1000)))].sort((a, b) => a - b);
  const iois = times.slice(1).map((t, i) => (t - times[i]) / 1000);
  // timing looseness: how far the gaps between onsets are from a whole number of steps. A skipped step (density below 1)
  // makes a gap of two steps, which is not looseness; swing and jitter are.
  const devs = stepSeconds > 0 ? iois.map((v) => (v - Math.max(1, Math.round(v / stepSeconds)) * stepSeconds) / stepSeconds) : [];
  const onsetIrregularity = devs.length > 1 ? clamp01(Math.sqrt(devs.reduce((a, v) => a + v * v, 0) / devs.length) * IRREGULARITY_GAIN) : 0;
  const bins = new Map<number, number>();
  for (const v of iois) bins.set(Math.round(v * 100), (bins.get(Math.round(v * 100)) ?? 0) + 1);
  let ent = 0; for (const c of bins.values()) { const p = c / iois.length; ent -= p * Math.log(p); }
  const patternEntropy = iois.length > 2 ? clamp01(ent / Math.log(Math.max(2, Math.min(iois.length, 12)))) : 0;

  return {
    loudnessDb, centroidHz, highFreqRatio: totE > 0 ? hiE / totE : 0, flux, fluxVariance, density, roughness,
    modeBrightness: modeBrightness(pitches), onsetIrregularity, patternEntropy, width: ms > 0 ? clamp01(Math.sqrt(ss / ms)) : 0, tailRatio,
    pitchLow: pitches.length ? Math.min(...pitches) : 0, pitchHigh: pitches.length ? Math.max(...pitches) : 0, clash,
  };
}

const word = (x: number, cuts: number[], names: string[]) => names[cuts.findIndex((c) => x < c) === -1 ? names.length - 1 : cuts.findIndex((c) => x < c)];

export interface Analysis {
  sound: { brightness: string; density: string; movement: string; loudness_db: number; roughness: number };
  reads_as: { warmth: number; closeness: number; joy: number; calm: number; spontaneity: number; tension: number };
  /** Per axis: what holds the reading down ("low") and what lifts it ("high"), as the two biggest terms of its formula. */
  why: Record<string, { low: string; high: string }>;
}

type Term = [name: string, weight: number, towardHigh: number];
/** The two terms of an axis formula that cost it the most (`low`) and that give it the most (`high`). Names say what to change. */
function explain(terms: Term[]): { low: string; high: string } {
  const top = (key: (t: Term) => number) => [...terms].sort((a, b) => key(b) - key(a)).slice(0, 2).map((t) => t[0]).join(", ");
  return { low: top((t) => t[1] * (1 - t[2])), high: top((t) => t[1] * t[2]) };
}

/** The compact reading returned to Claude, from the measured features and the tempo of the state. */
export function readFeatures(f: Features, tempo: number): Analysis {
  const c = norm(f.centroidHz, RANGES.centroid), loud = norm(f.loudnessDb, RANGES.loudness), loudWide = norm(f.loudnessDb, RANGES.loudnessWide), den = norm(f.density, RANGES.density);
  const flux = norm(f.flux, RANGES.flux);
  // joy is valence: mode and consonance carry it. Brightness and tempo are arousal, so they only nudge it (third test, round 4:
  // a minor mood on a square wave with an open filter read 0.52 against 0.2 sent).
  // tension: how much of what sounds together clashes
  const tension = norm(f.clash, RANGES.clash);
  const smooth = 1 - clamp01(0.5 * f.roughness + 0.5 * tension);
  const joy = 0.5 * f.modeBrightness + 0.1 * c + 0.1 * norm(tempo, RANGES.tempo) + 0.3 * smooth;
  // urgent music is also fast and rough, not only dense and loud (third test, round 2: calm 0.12 sent, 0.48 read)
  const calm = 1 - (0.3 * den + 0.2 * loud + 0.15 * flux + 0.1 * c + 0.15 * norm(tempo, RANGES.tempo) + 0.1 * f.roughness);
  const warmth = 1 - (0.45 * c + 0.3 * clamp01(f.highFreqRatio * 8) + 0.25 * f.roughness);
  const closeness = 0.4 * loudWide + 0.35 * (1 - f.tailRatio) + 0.25 * (1 - f.width);
  const spontaneity = 0.5 * f.onsetIrregularity + 0.3 * f.patternEntropy + 0.2 * norm(f.fluxVariance, RANGES.fluxVar);
  const why = {
    joy: explain([["mode", 0.5, f.modeBrightness], ["brightness", 0.1, c], ["tempo", 0.1, norm(tempo, RANGES.tempo)], ["smoothness", 0.3, smooth]]),
    calm: explain([["density", 0.3, 1 - den], ["loudness", 0.2, 1 - loud], ["movement", 0.15, 1 - flux], ["brightness", 0.1, 1 - c], ["tempo", 0.15, 1 - norm(tempo, RANGES.tempo)], ["smoothness", 0.1, 1 - f.roughness]]),
    warmth: explain([["brightness", 0.45, 1 - c], ["high_frequencies", 0.3, 1 - clamp01(f.highFreqRatio * 8)], ["smoothness", 0.25, 1 - f.roughness]]),
    closeness: explain([["loudness", 0.4, loudWide], ["dryness", 0.35, 1 - f.tailRatio], ["narrow_width", 0.25, 1 - f.width]]),
    spontaneity: explain([["timing_irregularity", 0.5, f.onsetIrregularity], ["note_order", 0.3, f.patternEntropy], ["changing_texture", 0.2, norm(f.fluxVariance, RANGES.fluxVar)]]),
  };
  return {
    sound: {
      brightness: word(f.centroidHz, [250, 500, 900, 1500], ["very low", "low", "medium", "high", "very high"]),
      density: f.density === 0 ? "silent" : word(f.density, [2, 6], ["sparse", "medium", "dense"]),
      movement: word(flux, [0.15, 0.4, 0.7], ["still", "slow", "moving", "busy"]),
      loudness_db: Math.round(f.loudnessDb), roughness: r2(f.roughness),
    },
    reads_as: { warmth: r2(clamp01(warmth)), closeness: r2(clamp01(closeness)), joy: r2(clamp01(joy)), calm: r2(clamp01(calm)), spontaneity: r2(clamp01(spontaneity)), tension: r2(tension) },
    why,
  };
}

export function analyze(state: EngineState, seed = 1): Analysis & { features: Features } {
  const features = measure(state, seed);
  return { ...readFeatures(features, state.arp.tempo), features };
}
