import { describe, expect, it } from "vitest";
import { clampOpt, isSafeColour, validateDrawHap, validateHap, validateLoc, validateViz } from "./protocol";
import { SPIRAL_MAX_EVENTS, fitFont, hideTinyLabels, spiralSpan, spiralSteps, sweepOffset, lanes, litKey, litSpans, runs, tokenize, VizStore, Cls } from "./viz";

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
  it("sets the biggest font that fits, down to a floor that is lower on a phone", () => {
    expect(fitFont("s('bd')", 1200, 800)).toBe(24);
    expect(fitFont("x".repeat(5000), 400, 600)).toBe(8); // phone portrait: the floor, then the view scrolls
    expect(fitFont("x".repeat(5000), 900, 300)).toBe(10); // wide and short: the other floor
    const mid = fitFont("x".repeat(400), 600, 300);
    expect(mid).toBeGreaterThan(10); expect(mid).toBeLessThan(24);
    // a long line wraps, so it counts as several rows: 40 short lines plus one very wide one is smaller than 40 short lines
    const shortLines = Array(40).fill("note('c3')").join("\n");
    expect(fitFont(shortLines + "\n" + "x".repeat(900), 390, 700)).toBeLessThanOrEqual(fitFont(shortLines, 390, 700));
  });
  it("sweeps over code taller than the view: waits at the top, drifts to the bottom, waits, drifts back", () => {
    expect(sweepOffset(5, 0)).toBe(0);
    expect(sweepOffset(0, 280)).toBe(0);
    expect(sweepOffset(1.9, 280)).toBe(0);
    expect(sweepOffset(2 + 5, 280)).toBeCloseTo(140, 5); // half way down after 5 of the 10 s
    expect(sweepOffset(2 + 10 + 1, 280)).toBe(280);
    expect(sweepOffset(2 + 10 + 2 + 5, 280)).toBeCloseTo(140, 5); // half way back
    expect(sweepOffset(24, 280)).toBe(0); // one period is 24 s
    // it reaches the bottom: the last lines are shown too
    const seen = Array.from({ length: 280 }, (_, i) => sweepOffset(i / 10, 280));
    expect(Math.max(...seen)).toBe(280);
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

describe("hostile options stay bounded", () => {
  it("pulls numeric options into range", () => {
    const [a, b] = validateViz([
      { id: 0, name: "spiral", opts: { stretch: 1e9, playheadLength: 1e9, size: 1e12, speed: 1e6, unknownKey: 1e30 } },
      { id: 1, name: "pitchwheel", opts: { edo: 1e9, root: -5, hapRadius: 1e9, margin: 1e9, cycles: -5 } },
    ]);
    expect(a.opts.stretch).toBe(2.5); expect(a.opts.playheadLength).toBe(1); expect(a.opts.size).toBe(400); expect(a.opts.speed).toBe(16); expect(a.opts.unknownKey).toBe(1e4);
    expect(b.opts.edo).toBe(96); expect(b.opts.root).toBe(16); expect(b.opts.hapRadius).toBe(60); expect(b.opts.margin).toBe(200); expect(b.opts.cycles).toBe(0.25);
    expect(clampOpt("minMidi", -50)).toBe(0);
  });
  it("knows every drawing but custom CSS and hydra", () => {
    const names = ["pianoroll", "punchcard", "wordfall", "spiral", "pitchwheel", "scope", "tscope", "fscope", "spectrum"];
    expect(validateViz(names.map((name, id) => ({ id: id % 8, name, opts: {} }))).map((x) => x.name)).toEqual(names.slice(0, 8));
    expect(validateViz([{ id: 0, name: "markcss", opts: {} }, { id: 1, name: "hydra", opts: {} }])).toEqual([]);
  });
  it("cuts a spiral event to what shows and caps its pieces", () => {
    expect(spiralSpan(0, 600, 10)).toEqual([-2.5, 2.5]);
    expect(spiralSpan(100, 1, 10)).toBeNull();
    expect(spiralSteps(600, 8)).toBe(240);
    expect(spiralSteps(0, 1)).toBe(2);
    expect(SPIRAL_MAX_EVENTS * spiralSteps(5, 8)).toBeLessThanOrEqual(400 * 240);
  });
});

describe("labels on a roll", () => {
  const hap = (c: number, l: number, v: Record<string, string | number>) => ({ c, l, v, loc: [], viz: [0] });
  const roll = { vertical: false, fold: true, minMidi: 10, maxMidi: 90, timeExtent: 4 };
  it("keeps a label that Strudel can squeeze into its bar", () => {
    // 4 rows on a 800x200 lane: font 37; "bb4" is 67 px wide in a 40 px bar: squeezed less than twice, so it stays
    const haps = [hap(0, 0.2, { note: "bb4" }), hap(1, 1, { note: "c3" }), hap(2, 1, { note: "d3" }), hap(3, 1, { note: "e3" })];
    expect(hideTinyLabels(haps, roll, 800, 200, 11)[0].v.label).toBeUndefined();
  });
  it("keeps a label that is readable and fits its bar", () => {
    const h = [hap(0, 1, { note: "c3" }), hap(1, 1, { note: "e3" })];
    expect(hideTinyLabels(h, roll, 800, 200, 11).map((x) => x.v.label)).toEqual([undefined, undefined]);
  });
  it("blanks every label when the bars are too thin to read", () => {
    const h = Array.from({ length: 30 }, (_, i) => hap(0, 1, { note: `n${i}` }));
    expect(hideTinyLabels(h, roll, 800, 200, 11).every((x) => x.v.label === "")).toBe(true);
  });
  it("blanks the label of a short event that cannot hold its text", () => {
    const [a, b] = hideTinyLabels([hap(0, 2, { note: "c3" }), hap(2, 0.05, { note: "e3" })], roll, 800, 200, 11);
    expect(a.v.label).toBeUndefined(); expect(b.v.label).toBe("");
  });
  it("on a vertical roll, blanks the label of an event shorter than a readable line", () => {
    const o = { ...roll, vertical: true };
    const [long, short] = hideTinyLabels([hap(0, 0.2, { note: "c3" }), hap(1, 0.02, { note: "d3" })], o, 400, 800, 11);
    expect(long.v.label).toBeUndefined(); expect(short.v.label).toBe("");
  });
});
