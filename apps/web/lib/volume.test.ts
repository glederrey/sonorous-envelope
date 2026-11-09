import { describe, expect, it } from "vitest";
import { sliderToDb, sliderToGain } from "./volume";

describe("volume slider", () => {
  it("is silent at the bottom and unity at 80", () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(0.01)).toBe(0);
    expect(sliderToGain(0.8)).toBeCloseTo(1, 6);
  });
  it("boosts by 18 dB at the top, inside the engine cap of 8", () => {
    expect(sliderToDb(1)).toBeCloseTo(18, 6);
    expect(sliderToGain(1)).toBeCloseTo(7.94, 2);
    expect(sliderToGain(1)).toBeLessThanOrEqual(8);
  });
  it("moves in equal decibel steps", () => {
    const step = (a: number, b: number) => 20 * Math.log10(sliderToGain(b) / sliderToGain(a));
    expect(step(0.2, 0.3)).toBeCloseTo(6, 5);
    expect(step(0.6, 0.7)).toBeCloseTo(6, 5);
    expect(step(0.8, 0.9)).toBeCloseTo(9, 5); // steeper above unity: 18 dB in the last fifth
  });
  it("clamps out-of-range input", () => {
    expect(sliderToGain(-1)).toBe(0);
    expect(sliderToGain(5)).toBeCloseTo(sliderToGain(1), 9);
  });
});
