import { describe, expect, it } from "vitest";
import { clampOpt, isSafeColour, validateDrawHap, validateHap, validateLoc, validateViz } from "./protocol";
import { SPIRAL_MAX_EVENTS, fitFont, spiralSpan, spiralSteps, lanes, litKey, litSpans, runs, tokenize, VizStore, Cls } from "./viz";

describe("code spans", () => {
  it("keeps whole, in-range spans only", () => {
    expect(validateLoc([[0, 3], [5, 9]], 10)).toEqual([[0, 3], [5, 9]]);
    expect(validateLoc([[-1, 3], [4, 4], [6, 5], [0, 11], [1.5, 3], ["a", 2], [1]], 10)).toEqual([]);
    expect(validateLoc("x", 10)).toEqual([]);
    expect(validateLoc(Array(40).fill([0, 1]), 10)).toHaveLength(16);
  });
  it("travel with a hap, and are dropped when the code length is unknown", () => {
    const raw = { v: { s: "bd" }, t: 1, d: 0.5, cps: 0.5, cycle: 2, loc: [[0, 2]] };
    expect(validateHap(raw, 10)?.loc).toEqual([[0, 2]]);
    expect(validateHap(raw)?.loc).toBeUndefined();
  });
});

describe("colours", () => {
  it("accepts plain colours and refuses anything that can fetch or compute", () => {
    for (const c of ["#fff", "#ffcc00", "cyan", "rgb(10, 20, 30)", "hsla(200 50% 50% / 0.5)", "oklch(0.7 0.1 200)"]) expect(isSafeColour(c)).toBe(true);
    for (const c of ["url(https://x.test/a.png)", "var(--x)", "red; background:url(x)", "rgb(1,2,3) url(x)", "", "x".repeat(100), 5]) expect(isSafeColour(c)).toBe(false);
  });
});

describe("drawings the code asks for", () => {
  it("keeps known names with plain options", () => {
    const v = validateViz([{ id: 0, name: "pianoroll", inline: false, opts: { cycles: 8, labels: true, active: "#f00", fontFamily: "monospace" } }]);
    expect(v).toEqual([{ id: 0, name: "pianoroll", inline: false, opts: { cycles: 8, labels: true, active: "#f00", fontFamily: "monospace" } }]);
  });
  it("drops unknown names, bad ids, bad colours and odd strings", () => {
    expect(validateViz([{ id: 0, name: "hydra", opts: {} }, { id: 9, name: "scope", opts: {} }, { id: "a", name: "scope", opts: {} }])).toEqual([]);
    const [s] = validateViz([{ id: 1, name: "scope", opts: { color: "url(https://x.test)", background: "var(--a)", thickness: 4, label: "<b>x</b>" } }]);
    expect(s.opts).toEqual({ thickness: 4 });
  });
  it("caps the count", () => { expect(validateViz(Array.from({ length: 20 }, (_, i) => ({ id: i % 8, name: "scope", opts: {} })))).toHaveLength(8); });
});

describe("events for the drawings", () => {
  const ok = { c: 1, l: 0.25, v: { note: "c3", s: "sine", color: "red", gain: 0.5, room: 9 }, loc: [[0, 2]], viz: [0] };
  it("keeps only the keys a drawing reads", () => {
    expect(validateDrawHap(ok, 10)).toEqual({ c: 1, l: 0.25, v: { note: "c3", s: "sine", color: "red", gain: 0.5 }, loc: [[0, 2]], viz: [0] });
  });
  it("refuses a bad colour but keeps the event", () => {
    expect(validateDrawHap({ ...ok, v: { color: "url(x)" } }, 10)?.v).toEqual({});
  });
  it("refuses events without a drawing, or with odd times", () => {
    expect(validateDrawHap({ ...ok, viz: [] }, 10)).toBeNull();
    expect(validateDrawHap({ ...ok, viz: [99] }, 10)).toBeNull();
    expect(validateDrawHap({ ...ok, c: NaN }, 10)).toBeNull();
    expect(validateDrawHap({ ...ok, l: -1 }, 10)).toBeNull();
    expect(validateDrawHap(null, 10)).toBeNull();
  });
});

describe("what is lit", () => {
  it("lights spans of events that are on, fades them after, and not before", () => {
    const marks = [{ c: 1, l: 0.25, loc: [[0, 2]] as [number, number][] }, { c: 2, l: 0.25, loc: [[3, 5]] as [number, number][] }];
    expect(litSpans(marks, 1.1, 0.1).map((x) => [x.start, x.level])).toEqual([[0, 1]]);
    const after = litSpans(marks, 1.3, 0.1);
    expect(after).toHaveLength(1);
    expect(after[0].level).toBeCloseTo(0.5, 5);
    expect(litSpans(marks, 1.4, 0.1)).toEqual([]);
    expect(litSpans(marks, 0.5, 0.1)).toEqual([]);
  });
  it("gives the key a change only when a quarter-level moves", () => {
    const a = litKey([{ start: 0, end: 2, level: 0.9 }]), b = litKey([{ start: 0, end: 2, level: 0.8 }]), c = litKey([{ start: 0, end: 2, level: 0.5 }]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("the code view", () => {
  it("tokenizes comments, strings, numbers, methods and functions", () => {
    const code = `// hi\nnote("c3 ~").s('sine').gain(0.5)`;
    const t = tokenize(code);
    expect(t[0]).toBe(Cls.Comment);
    expect(t[code.indexOf("note")]).toBe(Cls.Func);
    expect(t[code.indexOf('"c3') + 1]).toBe(Cls.String);
    expect(t[code.indexOf("~")]).toBe(Cls.Mini);
    expect(t[code.indexOf(".s(") + 1]).toBe(Cls.Method);
    expect(t[code.indexOf("0.5")]).toBe(Cls.Number);
  });
  it("cuts runs on class and light changes, and the text is whole again", () => {
    const code = `s("bd sd")`;
    const out = runs(code, tokenize(code), [{ start: 3, end: 5, level: 1 }]);
    expect(out.map((r) => r.text).join("")).toBe(code);
    expect(out.find((r) => r.lit >= 0)?.text).toBe("bd");
    expect(runs("", new Uint8Array(0), [])).toEqual([]);
  });
  it("ignores spans outside the code", () => {
    expect(runs("ab", tokenize("ab"), [{ start: 5, end: 9, level: 1 }]).every((r) => r.lit === -1)).toBe(true);
  });
  it("sets the font between 11 and 24 px", () => {
    expect(fitFont("s('bd')", 1200, 800)).toBe(24);
    expect(fitFont("x".repeat(300), 400, 800)).toBe(11);
    expect(fitFont(Array(60).fill("a").join("\n"), 1200, 400)).toBe(11);
    const mid = fitFont("x".repeat(60), 600, 800);
    expect(mid).toBeGreaterThan(11); expect(mid).toBeLessThan(24);
  });
});

describe("lanes", () => {
  const spec = (id: number, inline: boolean) => ({ id, name: "scope" as const, inline, opts: {} });
  it("fills the view for plain calls and shares a bottom band for the inline ones", () => {
    const l = lanes([spec(0, false), spec(1, true), spec(2, true)], 100, 100);
    expect(l[0]).toMatchObject({ x: 0, y: 0, w: 100, h: 100 });
    expect(l[1].y).toBeLessThan(l[2].y);
    expect(l[2].y + l[2].h).toBeCloseTo(100, 5);
  });
});

describe("the store", () => {
  it("resets with a new code and prunes the long past", () => {
    const s = new VizStore();
    s.reset("a", 120);
    s.addMark({ c: 0, l: 1, loc: [[0, 1]] });
    s.addMark({ c: 50, l: 1, loc: [[0, 1]] });
    s.prune(51.5);
    expect(s.marks).toHaveLength(1);
    s.addDraw({ c: 1, l: 1, v: { color: "red" }, loc: [], viz: [2] });
    expect(s.colours.get(2)).toBe("red");
    s.reset("b", 100);
    expect(s.marks).toEqual([]); expect(s.draws).toEqual([]); expect(s.colours.size).toBe(0);
  });
});

describe("hostile options stay bounded (they drive loops on the page's thread)", () => {
  it("pulls numeric options into range", () => {
    const [s] = validateViz([{ id: 0, name: "spiral", opts: { stretch: 1e9, playheadLength: 1e9, cycles: -5, size: 1e12, speed: 1e6, unknownKey: 1e30 } }]);
    expect(s.opts.stretch).toBe(8); expect(s.opts.playheadLength).toBe(1); expect(s.opts.cycles).toBe(0.25);
    expect(s.opts.size).toBe(400); expect(s.opts.speed).toBe(16); expect(s.opts.unknownKey).toBe(1e4);
    expect(clampOpt("minMidi", -50)).toBe(0);
  });
  it("cuts a spiral event to what shows and caps its pieces", () => {
    expect(spiralSpan(0, 600, 10)).toEqual([-2.5, 2.5]);
    expect(spiralSpan(100, 1, 10)).toBeNull();
    expect(spiralSteps(600, 8)).toBe(240);
    expect(spiralSteps(0, 1)).toBe(2);
    // the worst a frame can cost: capped events times capped pieces
    expect(SPIRAL_MAX_EVENTS * spiralSteps(5, 8)).toBeLessThanOrEqual(400 * 240);
  });
});
