import { describe, expect, it } from "vitest";
import { mulberry32 } from "@sonorous/engine";
import {
  ListenerSettings, Mood, SetSoundInput, applyColour, applyLimits, applyMoodFloor, applyOverride, buildFeedback,
  harmonyFor, harshness, moodToEngineState, nextSlowMood, parseSettings,
  type Mood as MoodT,
} from "../src";

const neutral: MoodT = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.8, spontaneity: 0.2 };
const m = (o: Partial<MoodT>): MoodT => ({ ...neutral, ...o });
const settings = (o: object = {}) => ListenerSettings.parse(o);

const corners: MoodT[] = [];
for (let b = 0; b < 32; b++) corners.push({
  warmth: b & 1, closeness: (b >> 1) & 1, joy: (b >> 2) & 1, calm: (b >> 3) & 1, spontaneity: (b >> 4) & 1,
});
const random = (n: number) => { const r = mulberry32(5); return Array.from({ length: n }, () => ({
  warmth: r(), closeness: r(), joy: r(), calm: r(), spontaneity: r() })); };

describe("mood mapping", () => {
  it("keeps every field inside the engine's valid ranges at all corners and random points", () => {
    for (const mood of [...corners, ...random(1000)]) {
      const s = moodToEngineState(mood);
      const inRange = (x: number, a: number, b: number) => Number.isFinite(x) && x >= a - 1e-9 && x <= b + 1e-9;
      expect(inRange(s.arp.tempo, 30, 200)).toBe(true);
      expect(inRange(s.filter.cutoff, 60, 16000)).toBe(true);
      expect(inRange(s.filter.resonance, 0.1, 20)).toBe(true);
      expect(inRange(s.volume, 0, 1)).toBe(true);
      expect(inRange(s.osc.drive, 0, 1)).toBe(true);
      expect(inRange(s.env.attack, 0.001, 4)).toBe(true);
      expect(inRange(s.env.decay, 0.01, 4)).toBe(true);
      expect(inRange(s.env.release, 0.01, 8)).toBe(true);
      expect(inRange(s.arp.density, 0.35, 1)).toBe(true);
      expect(inRange(s.arp.gate, 0.05, 1)).toBe(true);
      expect(inRange(s.arp.octaves, 1, 3)).toBe(true);
      expect(inRange(s.fx.delay.time, 0.05, 0.75)).toBe(true);
      expect(inRange(s.fx.delay.feedback, 0, 0.6)).toBe(true);
      expect(inRange(s.colour.l, 0, 0.6)).toBe(true);
      expect(inRange(s.bass.stepSeconds, 1, 2)).toBe(true);
      expect(s.lfo.length).toBeLessThanOrEqual(2);
      expect(s.arp.chord.length).toBeGreaterThanOrEqual(3);
      expect(s.arp.chord.length).toBeLessThanOrEqual(8);
    }
  });

  it("is monotonic: calm slows the tempo, closeness raises volume, warmth never harshens the wave", () => {
    const order = ["sine", "triangle", "sawtooth", "square"];
    for (const base of random(40)) {
      let prevT = Infinity, prevV = -Infinity, prevW = Infinity;
      for (let x = 0; x <= 1.0001; x += 0.1) {
        expect(moodToEngineState({ ...base, calm: x }).arp.tempo).toBeLessThanOrEqual(prevT + 1e-9);
        prevT = moodToEngineState({ ...base, calm: x }).arp.tempo;
        const v = moodToEngineState({ ...base, closeness: x }).volume;
        expect(v).toBeGreaterThanOrEqual(prevV - 1e-9); prevV = v;
        const w = order.indexOf(moodToEngineState({ ...base, warmth: x }).osc.wave);
        expect(w).toBeLessThanOrEqual(prevW); prevW = w;
      }
    }
  });

  it("follows the chord-quality table", () => {
    expect(harmonyFor(m({ joy: 0.7, calm: 0.7, warmth: 0.8 }))).toEqual({ scale: "major", degrees: [1, 3, 5, 7] });
    expect(harmonyFor(m({ joy: 0.7, calm: 0.7, warmth: 0.2 }))).toEqual({ scale: "dorian", degrees: [1, 3, 5, 7] });
    expect(harmonyFor(m({ joy: 0.7, calm: 0.2 }))).toEqual({ scale: "major", degrees: [1, 3, 5] });
    expect(harmonyFor(m({ joy: 0.9, calm: 0.2 }))).toEqual({ scale: "major", degrees: [1, 3, 5, 9] });
    expect(harmonyFor(m({ joy: 0.45, calm: 0.2 }))).toEqual({ scale: "mixolydian", degrees: [1, 3, 5, 7] });
    expect(harmonyFor(m({ joy: 0.2, calm: 0.7 }))).toEqual({ scale: "minor", degrees: [1, 3, 5] });
    expect(harmonyFor(m({ joy: 0.2, calm: 0.2 }))).toEqual({ scale: "locrian", degrees: [1, 3, 5] });
    const blend = harmonyFor(m({ joy: 0.45, calm: 0.45 }));
    expect(blend.degrees).toEqual([1, 3, 5, 7]);
  });

  it("adds a 4th for high spontaneity only when asked", () => {
    expect(harmonyFor(m({ joy: 0.2, calm: 0.7, spontaneity: 0.9 }), true).degrees).toEqual([1, 3, 4, 5]);
    expect(harmonyFor(m({ joy: 0.2, calm: 0.7, spontaneity: 0.9 })).degrees).toEqual([1, 3, 5]);
  });

  it("never gives a falling pattern for joy ≥ 0.6, nor a rising one for joy ≤ 0.4 (without random)", () => {
    for (const mood of random(500)) {
      const p = moodToEngineState({ ...mood, spontaneity: Math.min(mood.spontaneity, 0.7) }).arp.pattern;
      if (mood.joy >= 0.6) expect(p).not.toBe("down");
      if (mood.joy <= 0.4) expect(p).not.toBe("up");
    }
  });

  it("applies roughness only in the angry corner", () => {
    for (const mood of random(1000)) {
      const d = moodToEngineState(mood).osc.drive;
      if (mood.joy >= 0.6 || mood.calm >= 0.6 || mood.warmth >= 0.9) expect(d).toBe(0);
    }
    expect(moodToEngineState({ warmth: 0, closeness: 0.5, joy: 0, calm: 0, spontaneity: 0.5 }).osc.drive).toBeCloseTo(0.8);
  });

  it("moves the slow mood 25 % per final update, never on non-final updates, and converges", () => {
    const a = m({ joy: 0 }), b = m({ joy: 1 });
    expect(nextSlowMood(null, a, true)).toEqual(a);
    expect(nextSlowMood(a, b, false)).toEqual(a);
    expect(nextSlowMood(a, b, true).joy).toBeCloseTo(0.25);
    let s = a; for (let i = 0; i < 40; i++) s = nextSlowMood(s, b, true);
    expect(s.joy).toBeCloseTo(1, 3);
  });

  it("builds the bass layer from the slow mood", () => {
    const s = moodToEngineState(m({ joy: 0.9, calm: 0.2 }), m({ joy: 0.2, calm: 0.9 }));
    expect(s.bass.scale).toBe("minor");
    expect(s.bass.stepSeconds).toBeCloseTo(1.9);
    expect(s.bass.root).toBeLessThan(s.arp.root);
  });

  it("matches snapshots for the reference moods", () => {
    const refs = {
      neutral, warmCloseCalm: m({ warmth: 0.9, closeness: 0.9, joy: 0.7, calm: 0.9 }),
      coldDistant: m({ warmth: 0.1, closeness: 0.1, joy: 0.4, calm: 0.5 }),
      joyfulSpontaneous: m({ joy: 0.95, calm: 0.2, spontaneity: 0.9 }),
      despairCalm: m({ joy: 0.05, calm: 0.9, warmth: 0.3 }), urgent: m({ joy: 0.3, calm: 0.05, spontaneity: 0.6 }),
    };
    const sum = Object.fromEntries(Object.entries(refs).map(([k, v]) => {
      const s = moodToEngineState(v);
      return [k, { scale: s.arp.scale, chord: s.arp.chord, pattern: s.arp.pattern, tempo: Math.round(s.arp.tempo), rate: s.arp.rate,
                   wave: s.osc.wave, cutoff: Math.round(s.filter.cutoff), drone: s.drone.on, arp: s.arp.on }];
    }));
    expect(sum).toMatchSnapshot();
  });
});

describe("override and colour", () => {
  it("replaces fields, converts note names, and records what was overridden", () => {
    const { state, overridden } = applyOverride(moodToEngineState(neutral), {
      arp: { root: "D3", chord: [1, 5] }, filter: { cutoff: 900 }, drone: { notes: ["D2", "A2"], on: true },
    });
    expect(state.arp.root).toBe(50); expect(state.arp.chord).toEqual([1, 5]);
    expect(state.filter.cutoff).toBe(900); expect(state.drone.notes).toEqual([38, 45]);
    expect(overridden).toEqual(expect.arrayContaining(["arp.root", "arp.chord", "filter.cutoff", "drone.notes", "drone.on"]));
  });
  it("own colour replaces the mapped values", () => {
    const c = applyColour(moodToEngineState(neutral).colour, { mode: "own", hue: 10, lightness: 0.3 });
    expect(c.h).toBe(10); expect(c.l).toBe(0.3);
    expect(applyColour(moodToEngineState(neutral).colour, { mode: "follow", hue: 10 }).h).not.toBe(10);
  });
});

describe("limits", () => {
  const limit = (mood: MoodT, s = settings(), extra: object = {}) =>
    applyLimits({ mapped: moodToEngineState(mood), mood, settings: s, ...extra });

  it("raises joy and calm to the floor", () => {
    const r = applyMoodFloor(m({ joy: 0.1, calm: 0.1 }), settings());
    expect(r.mood.joy).toBe(0.2); expect(r.mood.calm).toBe(0.3);
    expect(r.clamps).toEqual(["joy 0.1→0.2 (mood floor)", "calm 0.1→0.3 (mood floor)"]);
    expect(applyMoodFloor(m({ joy: 0.1 }), settings({ consent: "anything", mood_floor: { joy: 0.4, calm: 0 } })).mood.joy).toBe(0.4);
  });

  it("caps volume, never above 0.9 even if the listener allows more", () => {
    const hi = moodToEngineState(neutral); hi.volume = 1;
    expect(applyLimits({ mapped: hi, mood: neutral, settings: settings({ max_volume: 0.4 }) }).effective.volume).toBe(0.4);
    expect(applyLimits({ mapped: hi, mood: neutral, settings: settings({ max_volume: 1, consent: "anything" }) }).effective.volume).toBe(0.9);
  });

  it("enforces consent ceilings: tempo, wave, scale, resonance, roughness", () => {
    const wild = moodToEngineState({ warmth: 0, closeness: 0.5, joy: 0, calm: 0, spontaneity: 0.5 });
    wild.arp.tempo = 190; wild.filter.resonance = 15;
    const amb = applyLimits({ mapped: wild, mood: neutral, settings: settings({ max_harshness: 1 }) }).effective;
    expect(amb.arp.tempo).toBeLessThanOrEqual(110);
    expect(["sine", "triangle"]).toContain(amb.osc.wave);
    expect(amb.arp.scale).toBe("minor");
    expect(amb.filter.resonance).toBeLessThanOrEqual(4);
    expect(amb.osc.drive).toBe(0);
    const any = applyLimits({ mapped: wild, mood: neutral, settings: settings({ consent: "anything", max_harshness: 1 }) }).effective;
    expect(any.arp.tempo).toBe(190); expect(any.osc.wave).toBe("square"); expect(any.arp.scale).toBe("locrian");
    expect(any.osc.drive).toBeGreaterThan(0);
  });

  it("limits the note rate by consent", () => {
    const busy = moodToEngineState(m({ calm: 0 })); busy.arp.rate = "1/16"; busy.arp.tempo = 100; busy.arp.density = 1;
    const e = applyLimits({ mapped: busy, mood: neutral, settings: settings() }).effective;
    expect((e.arp.tempo / 60 / ({ "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 })[e.arp.rate]) * e.arp.density).toBeLessThanOrEqual(4.0001);
  });

  it("brings harshness under the listener's maximum", () => {
    const hard = moodToEngineState({ warmth: 0, closeness: 0.5, joy: 0, calm: 0, spontaneity: 0.5 });
    hard.filter.cutoff = 9000; hard.filter.resonance = 12;
    const s = settings({ consent: "anything", max_harshness: 0.3 });
    const { effective, clamps } = applyLimits({ mapped: hard, mood: neutral, settings: s });
    expect(harshness(effective)).toBeLessThanOrEqual(0.3 + 0.12);
    expect(harshness(effective)).toBeLessThan(harshness(hard));
    expect(clamps.some((c) => c.startsWith("harshness"))).toBe(true);
  });

  it("stretches transitions: listener minimum, consent minimum, large mood change", () => {
    const t = (tr: object, s = settings(), prev?: MoodT) =>
      applyLimits({ mapped: moodToEngineState(neutral), mood: neutral, previousMood: prev, transition: tr as never, settings: s }).effective.transition;
    expect(t({ time: 1, curve: "smooth" }).time).toBe(4);
    expect(t({ time: 1, curve: "sudden" }).curve).toBe("smooth");
    expect(t({ time: 1, curve: "sudden" }, settings({ consent: "anything", min_transition: 0 })).curve).toBe("sudden");
    expect(t({ time: 5, curve: "smooth" }, settings(), m({ joy: 0, calm: 0, warmth: 1 })).time).toBe(8);
    expect(t({ time: 5, curve: "smooth" }, settings({ consent: "anything" }), m({ joy: 0, calm: 0, warmth: 1 })).time).toBe(5);
  });

  it("caps echo", () => {
    const echo = moodToEngineState(neutral); echo.fx.delay = { time: 1.4, feedback: 0.85, mix: 0.9 };
    const e = applyLimits({ mapped: echo, mood: neutral, settings: settings() }).effective;
    expect(e.fx.delay.time).toBe(0.75); expect(e.fx.delay.feedback).toBe(0.6); expect(e.fx.delay.mix).toBe(0.4);
  });

  it("never lets the colour pulse faster than 3 Hz, whatever is asked", () => {
    for (const consent of ["ambient", "expressive", "anything"] as const) {
      const s = moodToEngineState(neutral);
      s.colour = applyColour(s.colour, { mode: "own", motion: "pulse" });
      s.colour.pulseHz = 12;
      const e = applyLimits({ mapped: s, mood: neutral, settings: settings({ consent }) }).effective;
      expect(e.colour.pulseHz).toBeLessThanOrEqual(3);
    }
  });

  it("clamps colour lightness and saturation, and can turn colour off", () => {
    const s = moodToEngineState(neutral); s.colour.l = 0.6; s.colour.s = 0.9;
    const e = applyLimits({ mapped: s, mood: neutral, settings: settings({ colour: { enabled: true, max_lightness: 0.3, max_saturation: 0.4 } }) }).effective;
    expect(e.colour.l).toBe(0.3); expect(e.colour.s).toBe(0.4);
    const off = applyLimits({ mapped: s, mood: neutral, settings: settings({ colour: { enabled: false } }) }).effective;
    expect(off.colour.s).toBe(0); expect(off.colour.l).toBeLessThan(0.1);
  });

  it("lists at most 5 clamps then a count", () => {
    const wild = moodToEngineState({ warmth: 0, closeness: 1, joy: 0, calm: 0, spontaneity: 1 });
    wild.arp.tempo = 200; wild.filter.resonance = 20; wild.volume = 1; wild.fx.delay.mix = 1; wild.osc.wave = "square";
    wild.lfo = [{ target: "amp", rate: 5, depth: 0.6, shape: "sine" }];
    const { clamps } = applyLimits({ mapped: wild, mood: neutral, settings: settings(), transition: { time: 0, curve: "sudden" } });
    expect(clamps.length).toBe(6);
    expect(clamps[5]).toMatch(/^…and \d+ more$/);
  });

  it("is safe at every corner under every consent level", () => {
    for (const consent of ["ambient", "expressive", "anything"] as const) {
      for (const mood of corners) {
        const s = settings({ consent });
        const { effective } = applyLimits({ mapped: moodToEngineState(mood), mood, settings: s });
        expect(effective.volume).toBeLessThanOrEqual(0.6);
        expect(harshness(effective)).toBeLessThanOrEqual(s.max_harshness + 0.12);
        expect(effective.colour.pulseHz).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("schemas and feedback", () => {
  it("rejects out-of-range values with a readable error", () => {
    const r = Mood.safeParse({ ...neutral, joy: 1.5 });
    expect(r.success).toBe(false);
    expect(SetSoundInput.safeParse({ mood: neutral }).success).toBe(true);
    expect(SetSoundInput.safeParse({ mood: neutral, synth: { filter: { cutoff: 5 } } }).success).toBe(false);
    expect(SetSoundInput.parse({ mood: neutral }).final).toBe(false);
  });
  it("falls back to safe defaults for broken settings", () => {
    expect(parseSettings({ consent: "nope" }).consent).toBe("ambient");
    expect(parseSettings(undefined).max_volume).toBe(0.6);
    expect(parseSettings({ max_volume: 0.3 }).max_volume).toBe(0.3);
  });
  it("builds a compact feedback object that omits empty fields", () => {
    const eff = moodToEngineState(neutral);
    const f = buildFeedback({ turn: 3, intent: neutral, effective: eff, clamps: [], players: 1 });
    expect(f).not.toHaveProperty("clamped"); expect(f).not.toHaveProperty("notes"); expect(f).not.toHaveProperty("controls");
    expect(JSON.stringify(f).length).toBeLessThan(450);
    const g = buildFeedback({ turn: 3, intent: neutral, effective: eff, clamps: ["volume 0.7→0.5 (listener limit)"], players: 0, controls: { volume: 0.5, delay: 0.5 } });
    expect(g.clamped).toHaveLength(1); expect(g.controls).toEqual({ volume: 0.5, delay: 0.5 });
    expect(g.notes).toEqual(["no player open: nobody is hearing this"]);
  });
});
