import { describe, expect, it } from "vitest";
import { sliderToDb, sliderToGain } from "./volume";

describe("volume slider", () => {
  it("is silent at the bottom and unity at 80", () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(0.01)).toBe(0);
    expect(sliderToGain(0.8)).toBeCloseTo(1, 6);
  });
  it("boosts by 12 dB at the top, inside the engine cap of 4", () => {
    expect(sliderToDb(1)).toBeCloseTo(12, 6);
    expect(sliderToGain(1)).toBeCloseTo(3.98, 2);
    expect(sliderToGain(1)).toBeLessThanOrEqual(4);
  });
  it("moves in equal decibel steps", () => {
    const step = (a: number, b: number) => 20 * Math.log10(sliderToGain(b) / sliderToGain(a));
    expect(step(0.2, 0.3)).toBeCloseTo(6, 5);
    expect(step(0.6, 0.7)).toBeCloseTo(6, 5);
  });
  it("clamps out-of-range input", () => {
    expect(sliderToGain(-1)).toBe(0);
    expect(sliderToGain(5)).toBeCloseTo(sliderToGain(1), 9);
  });
});
