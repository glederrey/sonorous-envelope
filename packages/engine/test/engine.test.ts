import { describe, expect, it } from "vitest";
import { Engine, neutralState, renderOffline, noteToMidi, buildCycle, mulberry32, type EngineState } from "../src";

const SR = 22050;
const render = (s: EngineState, seconds = 4, seed = 7) => renderOffline(s, { seconds, sampleRate: SR, seed });
const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const same = (a: Float32Array, b: Float32Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const rms = (a: Float32Array) => Math.sqrt(a.reduce((m, v) => m + v * v, 0) / a.length);

describe("music helpers", () => {
  it("parses note names", () => {
    expect(noteToMidi("D3")).toBe(50);
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("F#2")).toBe(42);
    expect(noteToMidi("Bb4")).toBe(70);
    expect(noteToMidi("H9")).toBeUndefined();
  });
  it("orders patterns without repeating the ends in up_down", () => {
    const up = buildCycle(60, "major", [1, 3, 5], 1, "up");
    expect(up).toEqual([60, 64, 67]);
    expect(buildCycle(60, "major", [1, 3, 5], 1, "down")).toEqual([67, 64, 60]);
    expect(buildCycle(60, "major", [1, 3, 5], 1, "up_down")).toEqual([60, 64, 67, 64]);
    expect(buildCycle(60, "major", [1, 3, 5], 2, "up")).toEqual([60, 64, 67, 72, 76, 79]);
  });
  it("continues degrees past the top of the scale into the next octave", () => {
    expect(buildCycle(60, "major", [1, 3, 5, 7, 8, 10], 1, "up")).toEqual([60, 64, 67, 71, 72, 76]);
  });
});

describe("engine", () => {
  it("is deterministic for the same state and seed", () => {
    const s = neutralState();
    s.arp.density = 0.7; s.arp.jitterMs = 15; s.arp.pattern = "random";
    const a = render(s), b = render(s);
    expect(same(a.left, b.left)).toBe(true);
    expect(same(a.right, b.right)).toBe(true);
    expect(a.events).toEqual(b.events);
  });

  it("different seeds give different random patterns", () => {
    const s = neutralState(); s.arp.pattern = "random"; s.arp.chord = [1, 3, 5, 7]; s.arp.octaves = 2;
    const a = render(s, 4, 1).events.map((e) => e.midi), b = render(s, 4, 2).events.map((e) => e.midi);
    expect(a).not.toEqual(b);
  });

  it("stays finite and within ±1 for random valid states", () => {
    const r = mulberry32(99);
    const waves = ["sine", "triangle", "sawtooth", "square"] as const;
    for (let i = 0; i < 25; i++) {
      const s = neutralState();
      s.osc.wave = waves[Math.floor(r() * 4)]; s.osc.voices = 1 + Math.floor(r() * 3); s.osc.drive = r();
      s.filter.cutoff = 100 + r() * 8000; s.filter.resonance = 0.7 + r() * 15;
      s.arp.tempo = 50 + r() * 150; s.arp.octaves = 1 + Math.floor(r() * 3);
      s.arp.swing = r() * 0.4; s.arp.jitterMs = r() * 30; s.volume = r() * 0.9;
      s.fx.delay.feedback = r() * 0.6; s.fx.delay.mix = r() * 0.5; s.fx.reverb.mix = r() * 0.6;
      s.drone.on = r() > 0.5; s.bass.on = r() > 0.5;
      s.lfo = [{ target: "cutoff", rate: r() * 5, depth: r(), shape: "random" }, { target: "amp", rate: r() * 8, depth: r() * 0.6, shape: "square" }];
      const { left, right } = render(s, 2, i);
      for (const ch of [left, right]) {
        for (const v of ch) if (!Number.isFinite(v)) throw new Error(`non-finite sample in state ${i}`);
        expect(peak(ch)).toBeLessThanOrEqual(0.98);
      }
    }
  });

  it("makes sound, and silence when volume is 0", () => {
    const s = neutralState();
    expect(rms(render(s).left)).toBeGreaterThan(0.002);
    s.volume = 0;
    expect(peak(render(s).left)).toBeLessThan(1e-6);
  });

  it("produces arp events that follow pattern, rate and tempo", () => {
    const s = neutralState();
    s.arp.tempo = 120; s.arp.rate = "1/8"; s.arp.chord = [1, 3, 5]; s.arp.root = 60; s.arp.scale = "major"; s.arp.pattern = "up";
    const ev = render(s, 4).events.filter((e) => e.layer === "arp");
    expect(ev.slice(0, 6).map((e) => e.midi)).toEqual([60, 64, 67, 60, 64, 67]);
    expect(ev[1].time - ev[0].time).toBeCloseTo(0.25, 2); // 1/8 at 120 BPM
    expect(ev.length).toBeGreaterThanOrEqual(15);
  });

  it("density 0 plays nothing, arp off plays nothing", () => {
    const s = neutralState(); s.arp.density = 0;
    expect(render(s).events.length).toBe(0);
    const t = neutralState(); t.arp.on = false;
    expect(render(t).events.length).toBe(0);
  });

  it("plays the bass layer at its own step", () => {
    const s = neutralState(); s.arp.on = false; s.bass.on = true; s.bass.stepSeconds = 1; s.bass.root = 38; s.bass.chord = [1, 3, 5];
    const ev = render(s, 6).events.filter((e) => e.layer === "bass");
    expect(ev.length).toBeGreaterThanOrEqual(5);
    expect(ev[1].time - ev[0].time).toBeCloseTo(1, 1);
    expect(neutralState().bass.on).toBe(false);
    expect(render(neutralState()).events.some((e) => e.layer === "bass")).toBe(false);
  });

  it("glides the cutoff monotonically over the transition", () => {
    const e = new Engine(SR, 3);
    const a = neutralState(); a.filter.cutoff = 400;
    const b = neutralState(); b.filter.cutoff = 4000; b.transition = { time: 2, curve: "smooth" };
    e.setState(a, 3); e.setState(b, 3);
    const l = new Float32Array(SR / 10), r = new Float32Array(SR / 10);
    let prev = 0;
    for (let i = 0; i < 25; i++) {
      e.process(l, r, l.length);
      const c = e.params().cutoff;
      expect(c).toBeGreaterThanOrEqual(prev - 1e-9); prev = c;
    }
    expect(prev).toBeCloseTo(4000, 0);
  });

  it("a sudden curve reaches the target in about 30 ms", () => {
    const e = new Engine(SR, 3);
    e.setState(neutralState(), 3);
    const b = neutralState(); b.filter.cutoff = 5000; b.transition = { time: 8, curve: "sudden" };
    e.setState(b, 3);
    const l = new Float32Array(SR / 10), r = new Float32Array(SR / 10);
    e.process(l, r, l.length);
    expect(e.params().cutoff).toBeCloseTo(5000, 0);
  });

  it("works with any block size", () => {
    const s = neutralState();
    const whole = render(s, 1);
    const e = new Engine(SR, 7);
    e.setState(s, 7);
    const n = SR, l = new Float32Array(n), r = new Float32Array(n);
    for (let i = 0; i < n; ) {
      const f = Math.min(n - i, 100 + (i % 7));
      e.process(l.subarray(i, i + f), r.subarray(i, i + f), f); i += f;
    }
    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(l[i] - whole.left[i]));
    expect(maxDiff).toBeLessThan(1e-3);
  });

  it("drive 0 leaves the signal clean, drive adds saturation", () => {
    const clean = neutralState(); clean.osc.wave = "sine"; clean.filter.cutoff = 8000;
    const dirty = neutralState(); dirty.osc.wave = "sine"; dirty.filter.cutoff = 8000; dirty.osc.drive = 1;
    const a = render(clean).left, b = render(dirty).left;
    expect(same(a, b)).toBe(false);
  });

  it("the echo is Claude's: mix 0 is dry, and the maximum feedback and mix stay finite and under the clip", () => {
    const echo = neutralState(); echo.fx.delay = { time: 1.5, feedback: 0.85, mix: 1 }; echo.fx.reverb.mix = 0;
    const none = neutralState(); none.fx.delay = { time: 0.3, feedback: 0.85, mix: 0 }; none.fx.reverb.mix = 0;
    const run = (s: EngineState) => {
      const e = new Engine(SR, 5); e.setState(s, 5);
      const l = new Float32Array(SR * 6), r = new Float32Array(SR * 6); e.process(l, r, l.length); return l;
    };
    const dry = run(none), wet = run(echo);
    expect(same(dry, wet)).toBe(false);
    expect(peak(wet)).toBeLessThanOrEqual(0.98);
    expect(Number.isFinite(rms(wet))).toBe(true);
  });

  it("drone fades in and out over about 3 s", () => {
    const off = neutralState(); off.arp.on = false;
    const on = neutralState(); on.arp.on = false; on.drone.on = true; on.drone.level = 0.3;
    const e = new Engine(SR, 1); e.setState(off, 1); e.setState(on, 1);
    const l = new Float32Array(SR / 2), r = new Float32Array(SR / 2);
    e.process(l, r, l.length); const early = rms(l);
    for (let i = 0; i < 8; i++) e.process(l, r, l.length);
    expect(rms(l)).toBeGreaterThan(early * 2);
  });
});
