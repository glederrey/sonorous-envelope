import { describe, expect, it } from "vitest";
import { checkPatternCode } from "./strudel-code";

describe("Strudel code check", () => {
  it("accepts what strudel.cc accepts: chains, labels, top-level await, comments", () => {
    expect(checkPatternCode('note("c3 e3 g3").s("sawtooth").gain(0.5).room(.3)')).toEqual({ ok: true });
    expect(checkPatternCode('$: s("bd*2, hh*8").bank("RolandTR909")\n$: note("<c2 g2>").s("sawtooth").lpf(400)')).toEqual({ ok: true });
    expect(checkPatternCode('await samples("github:tidalcycles/dirt-samples")\ns("bd sd")')).toEqual({ ok: true });
    expect(checkPatternCode('// a comment\nstack(s("bd"), s("hh*4")).slow(2)')).toEqual({ ok: true });
  });
  it("says where a syntax error is", () => {
    const r = checkPatternCode('note("c3".s(');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/syntax error.*line 1, column \d+/);
  });
  it("rejects empty code", () => {
    expect(checkPatternCode("  \n ").ok).toBe(false);
  });
  it("does not run the code: an infinite loop only parses", () => {
    expect(checkPatternCode("while (true) {}")).toEqual({ ok: true });
  });
});
