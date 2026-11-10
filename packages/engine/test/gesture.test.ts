import { describe, expect, it } from "vitest";
import { Engine, GestureVoice, gestureLength, neutralState, mulberry32, type EngineState, type GestureType } from "../src";

const SR = 44100;
const TYPES: GestureType[] = ["purr", "chirp", "laugh", "growl", "sigh", "pluck"];

function voiceOf(type: GestureType, intensity = 0.7, seed = 3, root = 50) {
  const v = new GestureVoice(SR, mulberry32(seed));
  v.trigger(type, intensity, root);
  const out: number[] = [];
  while (v.active && out.length < SR * 4) out.push(v.process());
  return Float32Array.from(out);
}
const peak = (a: Float32Array) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

// small radix-2 FFT magnitude, enough for the purr test
function spectrum(x: Float32Array, n: number) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n && i < x.length; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  return Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k], im[k]));
}

describe("gestures", () => {
  it.each(TYPES)("%s ends by itself in under 2.5 s, makes sound, and peaks below -3 dBFS", (type) => {
    for (const intensity of [0.1, 1]) {
      const y = voiceOf(type, intensity);
      expect(y.length / SR).toBeLessThanOrEqual(2.5);
      expect(y.length / SR).toBeLessThanOrEqual(gestureLength(type, intensity) + 0.02);
      expect(peak(y)).toBeGreaterThan(0.01);
      expect(peak(y)).toBeLessThan(0.7); // -3 dBFS is 0.708
      expect(y.every(Number.isFinite)).toBe(true);
    }
  });

  it("is deterministic for a seed", () => {
    expect(voiceOf("laugh", 0.6, 9)).toEqual(voiceOf("laugh", 0.6, 9));
  });

  it("the purr has no tonal component above 250 Hz, and its strongest line is below 120 Hz (no hidden cry)", () => {
    for (const root of [43, 50, 57]) {
      const mag = spectrum(voiceOf("purr", 1, 5, root), 65536);
      const hz = (k: number) => (k * SR) / 65536;
      const top = Math.max(...mag), topBin = mag.indexOf(top);
      expect(hz(topBin)).toBeLessThan(120);
      const limit = top * Math.pow(10, -30 / 20);
      for (let k = 0; k < mag.length; k++) if (hz(k) > 250) expect(mag[k]).toBeLessThan(limit);
    }
  });

  it("the purr pulses at 22 to 28 Hz", () => {
    const y = voiceOf("purr", 1, 5);
    // envelope of the signal: its spectrum peaks at the pulse rate
    const env = Float32Array.from(y, (v) => Math.abs(v));
    const mag = spectrum(env.subarray(Math.floor(SR * 0.3)), 65536);
    let best = 0, bestK = 0;
    for (let k = 0; k < mag.length; k++) { const f = (k * SR) / 65536; if (f > 15 && f < 40 && mag[k] > best) { best = mag[k]; bestK = k; } }
    const f = (bestK * SR) / 65536;
    expect(f).toBeGreaterThan(21); expect(f).toBeLessThan(29);
  });

  it("plays once with its state on every device, not again for the same id, and not for a device that arrives late", () => {
    const withGesture = (id: string): EngineState => ({ ...neutralState(), gesture: { type: "chirp", intensity: 0.8, id } });
    const run = (setup: (e: Engine) => void, frames = SR) => {
      const e = new Engine(SR, 4); setup(e);
      const l = new Float32Array(frames), r = new Float32Array(frames); e.process(l, r, frames);
      return l.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    };
    const quiet = { ...neutralState(), arp: { ...neutralState().arp, on: false }, drone: { ...neutralState().drone, on: false }, bass: { ...neutralState().bass, on: false } };
    const base = (g: EngineState["gesture"]): EngineState => ({ ...quiet, gesture: g });
    const g1 = { type: "chirp" as const, intensity: 0.8, id: "a1" };
    expect(run((e) => e.setState(base(g1), 1, 0, 0))).toBeGreaterThan(0.02);   // heard at once: plays
    expect(run((e) => e.setState(base(g1), 1, 0, 5))).toBeLessThan(0.001);     // heard 5 s late: does not
    // the same id again does not replay: render the gesture out, then set the same state again
    const e = new Engine(SR, 4); e.setState(base(g1), 1, 0, 0);
    const l = new Float32Array(SR * 2), r = new Float32Array(SR * 2); e.process(l, r, l.length);
    e.setState(base(g1), 1, 0, 2); const l2 = new Float32Array(SR), r2 = new Float32Array(SR); e.process(l2, r2, l2.length);
    expect(peak(l2)).toBeLessThan(0.001);
    // and the switch mutes it on this device
    expect(run((e2) => { e2.setGesturesEnabled(false); e2.setState(base(g1), 1, 0, 0); })).toBeLessThan(0.001);
    void withGesture;
  });
});
