import { describe, expect, it } from "vitest";
import { bandCentres, bandEdges, measure, rmsDb, toBands, type SoundFrame } from "./sound-recorder";

const N = 48;
const centres = Array.from({ length: N }, (_, i) => 40 * Math.pow(300, i / N));
const frame = (t: number, db: number, rms = db): SoundFrame => ({
  bands: new Float32Array(N).fill(db),
  rmsDb: rms,
  t,
});

describe("bandEdges", () => {
  it("is log-spaced, non-decreasing, one bin minimum", () => {
    for (const [sr, fft] of [[48000, 2048], [44100, 1024], [48000, 256]]) {
      const e = bandEdges(sr, fft);
      expect(e.length).toBe(49);
      for (let i = 1; i < e.length; i++) expect(e[i]).toBeGreaterThan(e[i - 1]);
      expect(e[48]).toBeLessThanOrEqual(fft / 2);
    }
  });
  it("spans 40 Hz to 12 kHz at a fine resolution", () => {
    const e = bandEdges(48000, 4096);
    const binHz = 48000 / 4096;
    expect(e[0] * binHz).toBeGreaterThan(30);
    expect(e[0] * binHz).toBeLessThan(55);
    expect(e[48] * binHz).toBeGreaterThan(11000);
    expect(e[48] * binHz).toBeLessThan(13000);
  });
  it("gives centres in order", () => {
    const e = bandEdges(48000, 2048);
    const c = bandCentres(48000, 2048, e);
    expect(c.length).toBe(48);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
  });
});

describe("toBands / rmsDb", () => {
  it("averages power, not dB", () => {
    const edges = Int32Array.from([0, 2]);
    const out = toBands(Float32Array.from([-10, -30]), edges);
    expect(out[0]).toBeCloseTo(10 * Math.log10((0.1 + 0.001) / 2), 4);
  });
  it("clamps -Infinity to -120", () => {
    const out = toBands(Float32Array.from([-Infinity, -Infinity]), Int32Array.from([0, 2]));
    expect(out[0]).toBe(-120);
  });
  it("rms of full-scale square is 0 dB, silence -120", () => {
    expect(rmsDb(new Float32Array(64).fill(1))).toBeCloseTo(0, 6);
    expect(rmsDb(new Float32Array(64))).toBe(-120);
    expect(rmsDb(new Float32Array(64).fill(0.1))).toBeCloseTo(-20, 5);
  });
});

describe("measure", () => {
  it("returns nulls for silence", () => {
    const frames = Array.from({ length: 20 }, (_, i) => frame(i * 100, -120, -120));
    const m = measure(frames, centres);
    expect(m.loudness_db).toBeNull();
    expect(m.peak_db).toBeNull();
    expect(m.centroid_hz).toBeNull();
    expect(m.brightness).toBeNull();
    expect(m.onsets_per_s).toBeNull();
    expect(m.quiet_share).toBe(1);
  });
  it("measures a steady tone: loudness, no onsets", () => {
    const frames = Array.from({ length: 80 }, (_, i) => {
      const f = frame(i * 100, -120, -20);
      f.bands[10] = -30;
      return f;
    });
    const m = measure(frames, centres);
    expect(m.seconds).toBe(7.9);
    expect(m.loudness_db).toBe(-20);
    expect(m.peak_db).toBe(-20);
    expect(m.centroid_hz).toBe(Math.round(centres[10] / 10) * 10);
    expect(m.onsets_per_s).toBe(0);
    expect(m.quiet_share).toBe(0);
  });
  it("classifies brightness", () => {
    const at = (b: number) => {
      const f = frame(0, -120, -20);
      f.bands[b] = -20;
      return measure([f, { ...f, t: 100 }], centres).brightness;
    };
    expect(at(0)).toBe("dark");
    expect(at(32)).toBe("mid"); // ~1800 Hz
    expect(at(47)).toBe("bright");
  });
  it("counts quiet frames", () => {
    const frames = [frame(0, -30, -20), frame(100, -120, -90), frame(200, -30, -20), frame(300, -120, -90)];
    expect(measure(frames, centres).quiet_share).toBe(0.5);
  });
  it("finds about 4 onsets per second in a click train", () => {
    // 20 frames/s, a click every 5 frames, 10 s
    const frames = Array.from({ length: 200 }, (_, i) =>
      i % 5 === 0 ? frame(i * 50, -30, -20) : frame(i * 50, -90, -80),
    );
    const m = measure(frames, centres);
    expect(m.onsets_per_s).toBeGreaterThanOrEqual(3.6);
    expect(m.onsets_per_s).toBeLessThanOrEqual(4.4);
  });
});
