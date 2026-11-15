import { describe, expect, it, vi } from "vitest";
vi.mock("@strudel/draw", () => ({ __pianoroll: () => {}, getTheme: () => ({}), pitchwheel: () => {}, setTheme: () => {} })); // the real one needs a browser
import type { DrawHap } from "./protocol";
import { MAX_ROWS, ghostHaps, rememberRows, rowValue } from "./draw";

const hap = (v: DrawHap["v"], c = 0): DrawHap => ({ c, l: 1, v, loc: [], viz: [1] });

describe("rows of a folded roll", () => {
  it("reads the row like Strudel: midi number, note name, freq, sound name", () => {
    expect(rowValue({ note: 60 })).toBe(60);
    expect(rowValue({ n: 3 })).toBe(3);
    expect(rowValue({ note: "c4" })).toBe(60);
    expect(rowValue({ note: "eb" })).toBe(51);
    expect(rowValue({ note: "a3" })).toBe(57);
    expect(rowValue({ freq: 440 })).toBeCloseTo(69);
    expect(rowValue({ s: "bd" })).toBe("_bd");
    expect(rowValue({ note: 40, s: "sawtooth" })).toBe(40);
    expect(rowValue({ note: "zz" })).toBe(0);
    expect(rowValue({ gain: 1 })).toBeNull();
  });
  it("remembers rows once, and ghosts only the ones out of the window", () => {
    const seen = new Map();
    rememberRows(seen, [hap({ note: 60 }), hap({ note: 60 }), hap({ s: "bd" }), hap({ note: "c3" }), hap({ gain: 1 })]);
    expect([...seen.keys()]).toEqual([60, "_bd", 48]);
    const g = ghostHaps(seen, [hap({ note: 60 })]);
    expect(g.map((h) => rowValue(h.v))).toEqual(["_bd", 48]);
    expect(g.every((h) => h.c > 1e6 && h.l === 0)).toBe(true);
    expect(ghostHaps(seen, [hap({ note: 60 }), hap({ s: "bd" }), hap({ note: "c3" })])).toEqual([]);
  });
  it("is bounded", () => {
    const seen = new Map();
    rememberRows(seen, Array.from({ length: 300 }, (_, i) => hap({ note: i })));
    expect(seen.size).toBe(MAX_ROWS);
  });
});
