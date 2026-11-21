import { describe, expect, it } from "vitest";
import { dataUrlBase64, heat } from "./compose";

const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("heat", () => {
  it("starts dark navy and ends pale yellow", () => {
    const [r, g, b] = heat(0);
    expect(b).toBeGreaterThan(r);
    expect(lum(heat(0))).toBeLessThan(20);
    const [r1, g1, b1] = heat(1);
    expect(r1).toBeGreaterThan(240);
    expect(g1).toBeGreaterThan(230);
    expect(b1).toBeGreaterThan(180);
    expect(g).toBeLessThan(20);
  });
  it("clamps and rises in luminance", () => {
    expect(heat(-3)).toEqual(heat(0));
    expect(heat(9)).toEqual(heat(1));
    expect(heat(NaN)).toEqual(heat(0));
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const l = lum(heat(i / 100));
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });
  it("returns integers 0..255", () => {
    for (let i = 0; i <= 50; i++)
      for (const c of heat(i / 50)) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
  });
});

describe("dataUrlBase64", () => {
  it("splits mime and payload", () => {
    expect(dataUrlBase64("data:image/jpeg;base64,QUJD")).toEqual({ mime: "image/jpeg", base64: "QUJD" });
  });
  it("rejects other strings", () => {
    expect(() => dataUrlBase64("http://x")).toThrow();
    expect(() => dataUrlBase64("data:text/plain,hi")).toThrow();
  });
});
