import { describe, expect, it } from "vitest";
import { neutralState, type ResolvedColour } from "@sonorous/engine";
import {
  capFrame, drawFrame, glowArea, hash01, hslToRgb, isSaturatedRed, largeSwing, redFactor, relLuminance, visualFrame, applyLimits,
  moodToColour, moodToFeel, HALF_TIME_BPM, MAX_ITEMS, MAX_LARGE_SWING, MAX_SMALL_AREA, EMPTY_FRAME, type Frame,
} from "../src";

const base = (o: Partial<ResolvedColour> = {}): ResolvedColour => ({ h: 220, s: 0.4, l: 0.3, motion: "pulse", texture: "flat", pulseHz: 0, ...o });
const mood = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5 };

describe("visual frame", () => {
  it("is a pure function: the same input gives the same frame", () => {
    const c = base({ scene: "motes", density: 0.7, feel: moodToFeel(mood) });
    expect(visualFrame({ colour: c, bpm: 100, beats: 12.3, t: 4, seed: 3 })).toEqual(visualFrame({ colour: c, bpm: 100, beats: 12.3, t: 4, seed: 3 }));
    expect(hash01(5, 9)).toBe(hash01(5, 9));
  });
  it("draws nothing for a still field without a scene", () => {
    expect(visualFrame({ colour: base({ motion: "still" }), bpm: 100, beats: 3, t: 1 })).toBe(EMPTY_FRAME);
  });
  it("pulses on the beat: brightest at the beat, not at the middle, and repeats every beat", () => {
    const c = base({ sync: "beat", feel: { ...moodToFeel(mood), depth: 1, jitter: 0, soft: 1 } });
    const at = (beats: number) => drawFrame({ colour: c, bpm: 120, beats, t: 0 }).wash;
    expect(at(8)).toBeGreaterThan(at(8.5));
    expect(at(8)).toBeCloseTo(at(9), 9);
  });
  it("follows the phrase slowly in phrase sync: one swell over 16 beats", () => {
    const c = base({ sync: "phrase" });
    const w = (beats: number) => drawFrame({ colour: c, bpm: 120, beats, t: 0 }).wash;
    expect(w(8)).toBeGreaterThan(w(0.5));
    expect(w(0)).toBeCloseTo(w(16), 9);
  });
  it("runs at half-time above 180 BPM", () => {
    const c = base({ sync: "beat", feel: { ...moodToFeel(mood), depth: 1, jitter: 0, soft: 1 } });
    const fast = (beats: number) => drawFrame({ colour: c, bpm: HALF_TIME_BPM + 20, beats, t: 0 }).wash;
    expect(fast(8)).toBeCloseTo(fast(10), 9); // a cycle takes two beats
    expect(fast(8)).toBeGreaterThan(fast(9));
  });
  it("carries the mood in the form, not only the hue: joy expands, low joy contracts, calm couples less", () => {
    const glow = (joy: number) => drawFrame({ colour: base({ motion: "breathe", sync: "beat", feel: moodToFeel({ ...mood, joy, calm: 0.1 }) }), bpm: 100, beats: 8.05, t: 0 }).glow!;
    expect(glow(1).r).toBeGreaterThan(glow(0).r);
    const swing = (calm: number) => { const c = base({ sync: "beat", feel: moodToFeel({ ...mood, calm }) }); const v = [0, 0.25, 0.5, 0.75].map((p) => drawFrame({ colour: c, bpm: 100, beats: 4 + p, t: 0 }).wash); return Math.max(...v) - Math.min(...v); };
    expect(swing(0.1)).toBeGreaterThan(swing(0.9));
    const rough = (tension: number) => { const f = moodToFeel({ ...mood, tension }); return f.jitter; };
    expect(rough(0.9)).toBeGreaterThan(rough(0));
  });
  it("moods differ in motion with the hue taken away", () => {
    const sig = (m: typeof mood & { tension?: number }) => {
      const c = { ...moodToColour(m as never, 1500, 0.3), s: 0, secondary: undefined, scene: "motes" as const, sync: "beat" as const };
      return JSON.stringify([0, 0.3, 0.6, 1.1, 2.4].map((p) => drawFrame({ colour: c, bpm: 100, beats: 8 + p, t: p }, 0.6)));
    };
    const moods = [
      { warmth: 0.8, closeness: 0.9, joy: 0.6, calm: 0.7, spontaneity: 0.3 },   // tender
      { warmth: 0.3, closeness: 0.4, joy: 0.3, calm: 0.1, spontaneity: 0.8, tension: 0.5 }, // nervous
      { warmth: 0.5, closeness: 0.2, joy: 0.8, calm: 0.4, spontaneity: 0.4 },   // awe
      { warmth: 0.2, closeness: 0.6, joy: 0.2, calm: 0.2, spontaneity: 0.6, tension: 0.8 }, // irritated
      { warmth: 0.7, closeness: 0.6, joy: 0.7, calm: 0.8, spontaneity: 0.2 },   // relief
    ];
    expect(new Set(moods.map(sig)).size).toBe(moods.length);
  });
});

describe("the flash budget", () => {
  it("scales large elements to the swing cap and is idempotent", () => {
    const f: Frame = { wash: 0.2, glow: { x: 0.5, y: 0.5, r: 0.9, a: 0.5, hold: 0 }, items: [] };
    const c = capFrame(f, 0.6);
    expect(largeSwing(c, 0.6)).toBeLessThanOrEqual(MAX_LARGE_SWING + 1e-9);
    expect(capFrame(c, 0.6)).toEqual(c);
  });
  it("drops small elements past the area and count caps, and caps their opacity", () => {
    const dots = Array.from({ length: 200 }, (_, i) => ({ kind: "dot" as const, x: 0.5, y: 0.5, r: 0.05, w: 0, a: 1 + i }));
    const c = capFrame({ wash: 0, glow: null, items: dots }, 0.6);
    expect(c.items.length).toBeLessThanOrEqual(MAX_ITEMS);
    expect(c.items.reduce((s, i) => s + Math.PI * i.r * i.r * 0.6, 0)).toBeLessThanOrEqual(MAX_SMALL_AREA + 1e-9);
    expect(Math.max(...c.items.map((i) => i.a))).toBeLessThanOrEqual(0.5);
  });
  it("gives saturated red no large pulse", () => {
    const red = base({ h: 0, s: 1, l: 0.45, secondary: undefined, motion: "pulse", sync: "beat" });
    expect(isSaturatedRed(hslToRgb(0, 1, 0.45))).toBe(true);
    expect(redFactor(red)).toBe(0);
    expect(drawFrame({ colour: red, bpm: 100, beats: 8, t: 0 }).wash).toBe(0);
    expect(redFactor(base({ h: 220 }))).toBe(1);
  });
  it("property: no random state ever swings large areas by 10% of luminance, at any tempo, glide or scene", () => {
    let seed = 12345;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const motions = ["still", "drift", "pulse", "breathe"] as const, scenes = ["none", "motes", "ripples", "rain"] as const, syncs = ["beat", "phrase", "free"] as const;
    for (let run = 0; run < 150; run++) {
      const c = base({
        h: rnd() * 360, s: rnd(), l: 0.05 + rnd() * 0.55, motion: motions[Math.floor(rnd() * 4)], scene: scenes[Math.floor(rnd() * 4)], sync: syncs[Math.floor(rnd() * 3)],
        density: rnd(), speed: rnd(), feel: { depth: rnd(), lift: rnd(), jitter: rnd(), soft: rnd(), near: rnd(), irreg: rnd() },
      });
      const aspect = 0.4 + rnd() * 1.4;
      const baseL = relLuminance(hslToRgb(c.h, c.s, c.l));
      let beats = rnd() * 100, bpm = 30 + rnd() * 170;
      const swings: number[] = [];
      for (let i = 0; i < 480; i++) { // 8 s at 60 fps, with a tempo change every second
        if (i % 60 === 0) bpm = 30 + rnd() * 170;
        beats += bpm / 60 / 60;
        const f = drawFrame({ colour: c, bpm, beats, t: i / 60, seed: run }, aspect);
        // the luminance of the field with the large layers on it, white over the base: base + a * (1 - base)
        swings.push(baseL + f.wash * (1 - baseL) + (f.glow ? f.glow.a * glowArea(f.glow.r, aspect) * (1 - baseL) : 0));
        expect(f.items.length).toBeLessThanOrEqual(MAX_ITEMS);
        expect(f.items.reduce((s, it) => s + (it.kind === "dot" ? Math.PI * it.r * it.r : it.kind === "ring" ? 2 * Math.PI * it.r * it.w : it.r * it.w) * Math.min(aspect, 1 / aspect, 1), 0)).toBeLessThanOrEqual(MAX_SMALL_AREA + 1e-9);
      }
      for (let i = 0; i + 60 <= swings.length; i += 10) {
        const win = swings.slice(i, i + 60);
        expect(Math.max(...win) - Math.min(...win)).toBeLessThan(0.1);
      }
    }
  });
  it("hardCaps keeps the new fields in range and the old pulse under 3 Hz", () => {
    const s = neutralState(); s.colour = base({ motion: "pulse", pulseHz: 9, density: 4, speed: -1, feel: { depth: 3, lift: -2, jitter: 0, soft: 0, near: 0, irreg: 0 } });
    const { effective, clamps } = applyLimits({ mapped: s });
    expect(effective.colour.pulseHz).toBe(3); expect(effective.colour.density).toBe(1); expect(effective.colour.speed).toBe(0);
    expect(effective.colour.feel!.depth).toBe(1); expect(effective.colour.feel!.lift).toBe(0);
    expect(clamps.length).toBe(1);
  });
});
