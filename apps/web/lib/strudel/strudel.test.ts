import { describe, expect, it } from "vitest";
import { beatsAt, neutralState, tempoAt } from "@sonorous/engine";
import { validateHap, validateReport } from "./protocol";
import { pinBase, resolveBankRequest, safeSampleMap } from "./banks";
import { copyableCode, strudelUrl } from "../../components/player/strudel-panel";

const hap = (v: unknown, extra: object = {}) => ({ v, t: 1.5, d: 0.25, cps: 0.5, cycle: 3, ...extra });

describe("hap check (structure only, no sound limits)", () => {
  it("accepts what Strudel sends: numbers, strings, booleans, short arrays", () => {
    const h = validateHap(hap({ s: "sawtooth", note: 48, gain: 1.7, room: 3, cutoff: 200000, clip: true, n: [1, 2, 3] }));
    expect(h?.v).toMatchObject({ s: "sawtooth", gain: 1.7, cutoff: 200000 }); // loudness and range are not limited
  });
  it("rejects what could crash superdough or the page", () => {
    expect(validateHap(null)).toBeNull();
    expect(validateHap(hap({ gain: NaN }))).toBeNull();
    expect(validateHap(hap({ gain: Infinity }))).toBeNull();
    expect(validateHap(hap({ s: "x".repeat(200) }))).toBeNull();
    expect(validateHap(hap({ n: Array(40).fill(1) }))).toBeNull();
    expect(validateHap(hap({ "bad key": 1 }))).toBeNull();
    expect(validateHap(hap({ a: { b: 1 } }))).toBeNull();
    expect(validateHap(hap(JSON.parse('{"__proto__": 1}')))).toBeNull(); // a real __proto__ key
    expect(validateHap(hap(Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, 1]))))).toBeNull();
    expect(validateHap(hap({ s: "bd" }, { d: -1 }))).toBeNull();
    expect(validateHap(hap({ s: "bd" }, { cps: 0 }))).toBeNull();
    expect(validateHap(hap({ s: "bd" }, { t: "1" }))).toBeNull();
    expect(validateHap(hap([1, 2]))).toBeNull();
  });
  it("caps a report: text length, number of notes, and ignores other fields", () => {
    const r = validateReport({ ok: false, error: "e".repeat(999), notes: Array(20).fill("n".repeat(300)), eventsPerCycle: 3.456, extra: "x" });
    expect(r?.error?.length).toBe(200); expect(r?.notes).toHaveLength(8); expect(r?.notes[0].length).toBe(120); expect(r?.eventsPerCycle).toBe(3.5);
    expect(r).not.toHaveProperty("extra");
    expect(validateReport({ ok: "yes" })).toBeNull();
  });
});

describe("sample banks", () => {
  it("only the known banks load, and from a pinned commit", () => {
    expect(resolveBankRequest("github:tidalcycles/dirt-samples")).toMatch(/Dirt-Samples\/[0-9a-f]{40}\/strudel\.json$/);
    expect(resolveBankRequest("vcsl")).toMatch(/dough-samples\/[0-9a-f]{40}\/vcsl\.json$/);
    expect(resolveBankRequest("https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json")).toMatch(/piano\.json$/);
    expect(resolveBankRequest("https://evil.example/map.json")).toBeNull();
    expect(resolveBankRequest("github:someone/else")).toBeNull();
    expect(resolveBankRequest("http://169.254.169.254/")).toBeNull();
  });
  it("pins a branch URL to its commit and refuses any other host", () => {
    expect(pinBase("https://raw.githubusercontent.com/sgossner/VCSL/master/Aerophones/x.wav")).toMatch(/VCSL\/[0-9a-f]{40}\/Aerophones\/x\.wav$/);
    expect(pinBase("https://evil.example/")).toBeNull();
    expect(pinBase("https://raw.githubusercontent.com/someone/else/main/")).toBeNull();
  });
  it("makes a fetched map safe: pinned base, no per-key base", () => {
    const ok = safeSampleMap({ _base: "https://raw.githubusercontent.com/yaxu/mrid/main/", a: ["a.wav"], b: { _base: "https://evil.example/", x: ["x.wav"] } });
    expect(ok?.base).toMatch(/mrid\/[0-9a-f]{40}\/$/);
    expect(ok?.map).not.toHaveProperty("_base"); expect((ok?.map.b as object)).not.toHaveProperty("_base");
    expect(safeSampleMap({ _base: "https://evil.example/", a: ["a.wav"] })).toBeNull();
    expect(safeSampleMap([1])).toBeNull();
  });
});

describe("the code the listener may copy", () => {
  it("opens strudel.cc with the code in the hash, as strudel.cc encodes it", () => {
    const code = "setcps(1)\nnote(\"c3\")";
    expect(strudelUrl(code)).toBe(`https://strudel.cc/#${encodeURIComponent(btoa(code))}`);
    expect(() => strudelUrl('note("c3") // é — ♪')).not.toThrow();
  });
  it("adds the tempo when the code has none, so it sounds the same there", () => {
    expect(copyableCode('s("bd")', 120)).toBe('setcps(120/60/4)\ns("bd")');
    expect(copyableCode('setcpm(30)\ns("bd")', 120)).toBe('setcpm(30)\ns("bd")');
  });
});

describe("the beat of a Strudel state", () => {
  it("runs at the pattern's bpm from the first moment, with no tempo glide, and carries on from grid.beat", () => {
    const s = neutralState(); s.arp.tempo = 90; s.grid = { arp: 0, bass: 0, beat: 8, fromTempo: 60, glide: 6 };
    s.engine = "strudel"; s.pattern = { code: 's("bd")', bpm: 120 };
    expect(beatsAt(s, 0)).toBe(8);
    expect(beatsAt(s, 3)).toBeCloseTo(8 + 3 * 2, 9); // 120 BPM = 2 beats a second at once
    expect(tempoAt(s, 0)).toBe(120); expect(tempoAt(s, 10)).toBe(120);
    const synth = { ...s, engine: "synth" as const };
    expect(tempoAt(synth, 0)).toBe(60); // the synth still glides from its own fromTempo
  });
});
