import { describe, expect, it } from "vitest";
import { analyze, hardCaps, measure } from "@sonorous/shared";
import { renderOffline } from "@sonorous/engine";
import { SAMPLES, fadeOut, stateOfStep } from "./samples";

describe("landing samples", () => {
  it("are five, each under 25 s, and each step respects the safety rules", () => {
    expect(SAMPLES).toHaveLength(5);
    for (const s of SAMPLES) {
      expect(s.seconds).toBeLessThanOrEqual(25);
      for (const step of s.steps) {
        const st = stateOfStep(step, s.id);
        const again = JSON.parse(JSON.stringify(st)); hardCaps(again);
        expect(again).toEqual(st);                     // the limits were already applied
        expect(st.volume).toBeLessThanOrEqual(0.9);
        expect(st.colour.pulseHz).toBeLessThanOrEqual(3);
        expect(step.at).toBeLessThan(s.seconds - 3);   // room for the fade
      }
    }
  });
  it("render to finite audio that does not clip, and the fade ends in silence", () => {
    for (const s of SAMPLES) {
      const st = stateOfStep(s.steps[0], s.id);
      const { left } = renderOffline(st, { seconds: 4, sampleRate: 22050, seed: s.seed });
      expect(left.every(Number.isFinite)).toBe(true);
      expect(left.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThan(0.98);
      expect(fadeOut(st, 3).volume).toBe(0);
    }
  });
  it("sound different from each other, and the relief resolves to calmer and less tense", () => {
    const reads = SAMPLES.map((s) => analyze(stateOfStep(s.steps[0], s.id), s.seed).reads_as);
    expect(new Set(reads.map((r) => `${r.joy}-${r.calm}-${r.warmth}`)).size).toBe(5);
    const relief = SAMPLES.find((s) => s.id === "relief")!;
    const a = analyze(stateOfStep(relief.steps[0], relief.id), relief.seed).reads_as, b = analyze(stateOfStep(relief.steps[1], relief.id), relief.seed).reads_as;
    expect(b.calm).toBeGreaterThan(a.calm + 0.2); expect(b.tension).toBeLessThan(a.tension);
    const awe = SAMPLES.find((s) => s.id === "awe")!, nerv = SAMPLES.find((s) => s.id === "nervous")!;
    expect(analyze(stateOfStep(awe.steps[0], awe.id), 1).reads_as.calm).toBeGreaterThan(analyze(stateOfStep(nerv.steps[0], nerv.id), 1).reads_as.calm + 0.3);
  });

  it("are levelled: no step is more than 4 dB from the quietest", () => {
    const db = SAMPLES.flatMap((s) => s.steps.map((step) => measure(stateOfStep(step, s.id), s.seed).loudnessDb));
    expect(Math.max(...db) - Math.min(...db)).toBeLessThan(4);
  });
});
