import { describe, expect, it } from "vitest";
import { unwrapHue } from "./hue";

describe("unwrapHue", () => {
  it("takes the short way round the wheel", () => {
    expect(unwrapHue(350, 10)).toBe(370);
    expect(unwrapHue(10, 350)).toBe(-10);
    expect(unwrapHue(100, 140)).toBe(140);
    expect(unwrapHue(370, 20)).toBe(380);
  });
  it("keeps the same colour: the result is the target modulo 360", () => {
    for (let prev = -400; prev < 800; prev += 37) for (let next = 0; next < 360; next += 29) {
      const u = unwrapHue(prev, next);
      expect((((u - next) % 360) + 360) % 360).toBeCloseTo(0, 6);
      expect(Math.abs(u - prev)).toBeLessThanOrEqual(180 + 1e-9);
    }
  });
});
