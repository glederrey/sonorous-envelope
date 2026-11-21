// Rolling record of what the listener hears: one band spectrum + RMS per frame.

export interface SoundFrame {
  /** dB per band */
  bands: Float32Array;
  rmsDb: number;
  /** ms, performance.now() */
  t: number;
}

export interface Measured {
  seconds: number;
  loudness_db: number | null;
  peak_db: number | null;
  centroid_hz: number | null;
  brightness: "dark" | "mid" | "bright" | null;
  onsets_per_s: number | null;
  quiet_share: number;
}

const SILENCE_DB = -70;
const FLOOR_DB = -120;

const round = (x: number, step: number) => { const d = Math.max(0, -Math.floor(Math.log10(step))); return Number((Math.round(x / step) * step).toFixed(d)); }; // toFixed: 19 * 0.1 is 1.9000000000000001
const toPower = (db: number) => Math.pow(10, db / 10);
const toDb = (p: number) => (p > 0 ? Math.max(FLOOR_DB, 10 * Math.log10(p)) : FLOOR_DB);

/** Log-spaced FFT bin edges: length bands+1, non-decreasing, every band at least one bin. */
export function bandEdges(
  sampleRate: number,
  fftSize: number,
  bands = 48,
  fmin = 40,
  fmax = 12000,
): Int32Array {
  const bins = fftSize / 2;
  const binHz = sampleRate / fftSize;
  const edges = new Int32Array(bands + 1);
  const ratio = Math.log(fmax / fmin);
  for (let i = 0; i <= bands; i++) {
    const hz = fmin * Math.exp((ratio * i) / bands);
    edges[i] = Math.round(hz / binHz);
  }
  // First band starts at bin 1 or later (bin 0 is DC); each band spans at least one bin.
  edges[0] = Math.max(1, edges[0]);
  for (let i = 1; i <= bands; i++) {
    if (edges[i] < edges[i - 1] + 1) edges[i] = edges[i - 1] + 1;
  }
  // Keep inside the spectrum when the minimum width pushed us past the end.
  if (edges[bands] > bins) {
    edges[bands] = bins;
    for (let i = bands - 1; i >= 0; i--) {
      if (edges[i] > edges[i + 1]) edges[i] = edges[i + 1];
    }
  }
  return edges;
}

/** Band centre frequencies (Hz). */
export function bandCentres(sampleRate: number, fftSize: number, edges: Int32Array): number[] {
  const binHz = sampleRate / fftSize;
  const out: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    out.push(((edges[i] + edges[i + 1]) / 2) * binHz);
  }
  return out;
}

/** Mean power per band, in dB. */
export function toBands(freqDb: Float32Array, edges: Int32Array): Float32Array {
  const n = edges.length - 1;
  const out = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    const lo = edges[b];
    const hi = Math.max(edges[b + 1], lo + 1);
    let sum = 0;
    let count = 0;
    for (let k = lo; k < hi && k < freqDb.length; k++) {
      const db = freqDb[k];
      sum += Number.isFinite(db) ? toPower(db) : 0;
      count++;
    }
    out[b] = count ? toDb(sum / count) : FLOOR_DB;
  }
  return out;
}

/** RMS level of a time-domain block in dBFS, floor -120. */
export function rmsDb(time: Float32Array): number {
  if (!time.length) return FLOOR_DB;
  let s = 0;
  for (let i = 0; i < time.length; i++) s += time[i] * time[i];
  return toDb(s / time.length);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Onsets: flux per frame = mean over bands of the positive dB rise since the
// previous frame (the sum divided by the band count, so it does not depend on
// how many bands there are). A frame is an onset when it is a local maximum
// (strictly above the one before, not below the one after) and its flux is
// above median flux + 1.5 dB per band, i.e. about 6 dB of rise over a quarter
// of the bands. The median adapts to a noisy or busy floor; a steady tone has
// flux near 0 and never clears the threshold.
const ONSET_MARGIN_DB = 1.5;

function countOnsets(frames: SoundFrame[]): number {
  if (frames.length < 3) return 0;
  const flux: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].bands;
    const b = frames[i].bands;
    let sum = 0;
    for (let k = 0; k < b.length; k++) {
      const d = b[k] - a[k];
      if (d > 0) sum += d;
    }
    flux.push(b.length ? sum / b.length : 0);
  }
  const threshold = median(flux) + ONSET_MARGIN_DB;
  let n = 0;
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]) n++;
  }
  return n;
}

export function measure(frames: SoundFrame[], edgesHz: number[]): Measured {
  const seconds = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / 1000 : 0;
  const loud = frames.filter((f) => f.rmsDb >= SILENCE_DB);
  const quiet_share = frames.length ? round((frames.length - loud.length) / frames.length, 0.01) : 1;
  const base = { seconds: round(seconds, 0.1), quiet_share };
  if (!loud.length) {
    return {
      ...base,
      loudness_db: null,
      peak_db: null,
      centroid_hz: null,
      brightness: null,
      onsets_per_s: null,
    };
  }
  const loudness = toDb(loud.reduce((s, f) => s + toPower(f.rmsDb), 0) / loud.length);
  const peak = Math.max(...loud.map((f) => f.rmsDb));

  let wSum = 0;
  let fwSum = 0;
  for (const f of loud) {
    for (let b = 0; b < f.bands.length && b < edgesHz.length; b++) {
      const p = toPower(f.bands[b]);
      wSum += p;
      fwSum += p * edgesHz[b];
    }
  }
  const centroid = wSum > 0 ? fwSum / wSum : null;
  const brightness =
    centroid === null ? null : centroid < 900 ? "dark" : centroid < 2200 ? "mid" : "bright";
  const onsets = seconds > 0 ? countOnsets(frames) / seconds : null;

  return {
    ...base,
    loudness_db: round(loudness, 0.1),
    peak_db: round(peak, 0.1),
    centroid_hz: centroid === null ? null : round(centroid, 10),
    brightness,
    onsets_per_s: onsets === null ? null : round(onsets, 0.1),
  };
}

export interface SoundRecorderOptions {
  seconds?: number;
  everyMs?: number;
  bands?: number;
}

export class SoundRecorder {
  private readonly analyser: AnalyserNode;
  private readonly seconds: number;
  private readonly everyMs: number;
  private readonly edges: Int32Array;
  private readonly centres: number[];
  private readonly freq: Float32Array<ArrayBuffer>;
  private readonly time: Float32Array<ArrayBuffer>;
  private buf: SoundFrame[] = [];

  constructor(analyser: AnalyserNode, opts: SoundRecorderOptions = {}) {
    this.analyser = analyser;
    this.seconds = opts.seconds ?? 8;
    this.everyMs = opts.everyMs ?? 100;
    const sr = analyser.context.sampleRate;
    this.edges = bandEdges(sr, analyser.fftSize, opts.bands ?? 48);
    this.centres = bandCentres(sr, analyser.fftSize, this.edges);
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.time = new Float32Array(analyser.fftSize);
  }

  sample(now: number = performance.now()): void {
    const last = this.buf[this.buf.length - 1];
    // A hole in the record would lie about what was heard: start over.
    if (last && now - last.t > 3 * this.everyMs) this.buf = [];
    this.analyser.getFloatFrequencyData(this.freq);
    this.analyser.getFloatTimeDomainData(this.time);
    this.buf.push({ bands: toBands(this.freq, this.edges), rmsDb: rmsDb(this.time), t: now });
    const cutoff = now - this.seconds * 1000;
    let drop = 0;
    while (drop < this.buf.length && this.buf[drop].t < cutoff) drop++;
    if (drop) this.buf.splice(0, drop);
  }

  get frames(): SoundFrame[] {
    return this.buf;
  }

  get coveredSeconds(): number {
    return this.buf.length > 1 ? (this.buf[this.buf.length - 1].t - this.buf[0].t) / 1000 : 0;
  }

  /** The numbers for the sound since `since` (performance.now() ms), when at least 2 s of it is recorded: the window may still hold the
   *  sound before a change, which is not what the model just sent. Otherwise the whole window. */
  measured(since?: number): Measured {
    const after = since === undefined ? this.buf : this.buf.filter((f) => f.t >= since);
    const enough = after.length > 1 && after[after.length - 1].t - after[0].t >= 2000;
    return measure(enough ? after : this.buf, this.centres);
  }

  clear(): void {
    this.buf = [];
  }
}
