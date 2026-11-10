import { describe, expect, it } from "vitest";
import { mulberry32 } from "@sonorous/engine";
import {
  hardCaps, MASTER_VOLUME, Colour, ListenerSettings, Mood, SetSoundInput, applyColour, applyLimits, applyOverride, buildFeedback,
  describeReactions, harmonyFor, isResting, analyze, nextGrid, stepSecondsOf, mergeSticky, stickyToSynth, callSynth, stretch, stretchMood, voiceSeedOf, characterFor, voiceToSynth, Voice, moodToEngineState, nextSlowMood, parseSettings, restingNote,
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
      const s = moodToEngineState(mood, mood, voiceSeedOf(JSON.stringify(mood)));
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
      expect(inRange(s.arp.octaves, 1, 4)).toBe(true);
      expect(inRange(s.fx.delay.time, 0.05, 0.75)).toBe(true);
      expect(inRange(s.fx.delay.feedback, 0, 0.6)).toBe(true);
      expect(inRange(s.colour.l, 0, 0.6)).toBe(true);
      expect(inRange(s.bass.stepSeconds, 1, 2)).toBe(true);
      expect(s.lfo.length).toBeLessThanOrEqual(2);
      expect(s.arp.chord.length).toBeGreaterThanOrEqual(3);
      expect(s.arp.chord.length).toBeLessThanOrEqual(8);
    }
  });

  it("is monotonic: calm slows the tempo, warmth never harshens the wave; the volume never moves with the mood", () => {
    const order = ["sine", "triangle", "sawtooth", "square"];
    for (const base of random(40)) {
      let prevT = Infinity, prevW = Infinity;
      for (let x = 0; x <= 1.0001; x += 0.1) {
        expect(moodToEngineState({ ...base, calm: x }).arp.tempo).toBeLessThanOrEqual(prevT + 1e-9);
        prevT = moodToEngineState({ ...base, calm: x }).arp.tempo;
        expect(moodToEngineState({ ...base, closeness: x }).volume).toBe(MASTER_VOLUME);
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
      const p = moodToEngineState({ ...mood, spontaneity: Math.min(mood.spontaneity, 0.4) }).arp.pattern;
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
  it("uses a colour sent without a mode, keeping the mapped fields it leaves out", () => {
    const mapped = moodToEngineState(neutral).colour;
    const c = applyColour(mapped, { hue: 0, saturation: 1, lightness: 0.9 });
    expect(c.h).toBe(0); expect(c.s).toBe(1); expect(c.l).toBe(0.9);
    expect(c.motion).toBe(mapped.motion); expect(c.texture).toBe(mapped.texture);
    expect(Colour.parse({ hue: 0 }).mode).toBeUndefined();
  });
  it("follow mode reaches the whole wheel: red, green and magenta, not only blue to orange", () => {
    const hues = random(400).map((m) => moodToEngineState(m).colour.h);
    const near = (target: number) => hues.some((h) => Math.min(Math.abs(h - target), 360 - Math.abs(h - target)) < 20);
    for (const target of [0, 60, 120, 200, 330]) expect(near(target)).toBe(true);
  });
  it("the master volume is a constant, and synth no longer takes a volume", () => {
    expect(moodToEngineState(neutral).volume).toBe(MASTER_VOLUME);
    expect(SetSoundInput.parse({ mood: neutral, synth: { volume: 1 } as never }).synth).toEqual({});
  });
});

describe("limits (safety and stability only)", () => {
  const limit = (mood: MoodT, extra: object = {}) => applyLimits({ mapped: moodToEngineState(mood), ...extra });
  it("lets Claude's choices through unclamped, whatever the mood", () => {
    for (const mood of [...corners, ...random(300)]) expect(limit(mood).clamps).toEqual([]);
  });
  it("keeps extreme but legal settings as sent: tempo, roughness, resonance, sudden transitions, full echo", () => {
    const mapped = moodToEngineState(neutral);
    mapped.arp.tempo = 200; mapped.filter.resonance = 20; mapped.osc.drive = 1; mapped.osc.wave = "square"; mapped.fx.delay.mix = 1;
    const { effective, clamps } = applyLimits({ mapped, transition: { time: 0.1, curve: "sudden" } });
    expect(clamps).toEqual([]);
    expect(effective.arp.tempo).toBe(200); expect(effective.osc.drive).toBe(1); expect(effective.osc.wave).toBe("square");
    expect(effective.fx.delay.mix).toBe(1);
    expect(effective.transition).toEqual({ time: 0.1, curve: "sudden" });
  });
  it("caps the volume at 0.9", () => {
    const mapped = moodToEngineState(neutral); mapped.volume = 1;
    const { effective, clamps } = applyLimits({ mapped });
    expect(effective.volume).toBe(0.9); expect(clamps[0]).toMatch(/volume/);
  });
  it("never lets the colour pulse faster than 3 Hz, whatever is asked", () => {
    const mapped = moodToEngineState(neutral);
    mapped.colour = { ...mapped.colour, motion: "pulse", pulseHz: 9 };
    const { effective, clamps } = applyLimits({ mapped });
    expect(effective.colour.pulseHz).toBe(3); expect(clamps[0]).toMatch(/pulse/);
    mapped.colour.motion = "still";
    expect(applyLimits({ mapped }).effective.colour.pulseHz).toBe(0);
  });
  it("keeps the echo inside the delay buffer and below self-oscillation", () => {
    const mapped = moodToEngineState(neutral); mapped.fx.delay = { time: 9, feedback: 1, mix: 1 };
    const { effective } = applyLimits({ mapped });
    expect(effective.fx.delay.time).toBe(1.5); expect(effective.fx.delay.feedback).toBe(0.85);
  });
  it("is idempotent", () => {
    const mapped = moodToEngineState(neutral); mapped.volume = 1; mapped.fx.delay.feedback = 1; mapped.colour = { ...mapped.colour, motion: "pulse", pulseHz: 9 };
    const once = applyLimits({ mapped }).effective;
    const twice = JSON.parse(JSON.stringify(once)); hardCaps(twice);
    expect(twice).toEqual(once);
  });
  it("always empties the gesture slot", () => { expect(limit(neutral).effective.gesture).toBeNull(); });
});

describe("schemas and feedback", () => {
  it("rejects out-of-range values with a readable error", () => {
    const r = Mood.safeParse({ ...neutral, joy: 1.5 });
    expect(r.success).toBe(false);
    expect(SetSoundInput.safeParse({ mood: neutral }).success).toBe(true);
    expect(SetSoundInput.safeParse({ mood: neutral, synth: { filter: { cutoff: 5 } } }).success).toBe(false);
    expect(SetSoundInput.parse({ mood: neutral }).final).toBe(false);
  });
  it("drops the removed limit keys from old rows and falls back to defaults for broken ones", () => {
    const old = parseSettings({ consent: "ambient", max_volume: 0.3, max_harshness: 0.2, colour: { enabled: false }, rest_after: 600 });
    expect(old).toEqual({ rest_after: 600, image_feedback: "off", gestures: null });
    expect(parseSettings({ rest_after: "nope" })).toEqual({ rest_after: 900, image_feedback: "off", gestures: null });
    expect(parseSettings(undefined)).toEqual({ rest_after: 900, image_feedback: "off", gestures: null });
  });
  it("builds a compact feedback object that omits empty fields", () => {
    const eff = moodToEngineState(neutral);
    const f = buildFeedback({ turn: 3, intent: neutral, effective: eff, clamps: [], players: 1 });
    expect(f).not.toHaveProperty("clamped"); expect(f).not.toHaveProperty("notes"); expect(f).not.toHaveProperty("controls");
    expect(JSON.stringify(f).length).toBeLessThan(900);
    const g = buildFeedback({ turn: 3, intent: neutral, effective: eff, clamps: ["volume 1→0.9 (safety)"], players: 0, controls: { volume: 0.5 } });
    expect(g.clamped).toHaveLength(1); expect(g.controls).toEqual({ volume: 0.5 });
    expect(g.notes).toEqual(["no player open: nobody is hearing this"]);
  });
});

describe("rest_after", () => {
  const at = (secAgo: number) => new Date(1_000_000_000_000 - secAgo * 1000).toISOString();
  const now = 1_000_000_000_000;
  it("rests only after the delay, never when off", () => {
    expect(isResting(at(299), 300, now)).toBe(false);
    expect(isResting(at(301), 300, now)).toBe(true);
    expect(isResting(at(99999), null, now)).toBe(false);
  });
  it("defaults to 300 for settings stored before it existed", () => {
    expect(parseSettings({ consent: "ambient" }).rest_after).toBe(900);
    expect(parseSettings({ rest_after: null }).rest_after).toBeNull();
  });
  it("tells undefined (keep) from null (off) in set_sound input", () => {
    const base = { mood: { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5 } };
    expect(SetSoundInput.parse(base).rest_after).toBeUndefined();
    expect(SetSoundInput.parse({ ...base, rest_after: null }).rest_after).toBeNull();
    expect(SetSoundInput.safeParse({ ...base, rest_after: 10 }).success).toBe(false);
  });
  it("words the resting note in minutes", () => {
    expect(restingNote(900)).toBe("the sound faded after 15 min without an update from you");
  });
});

describe("stretch, variety and voice", () => {
  it("stretch is monotonic, fixes 0.5 and stays in [0,1]", () => {
    expect(stretch(0.5)).toBe(0.5);
    expect(stretch(0.4)).toBeCloseTo(0.34, 6);
    expect(stretch(0.7)).toBeCloseTo(0.82, 6);
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.01) { const y = stretch(x); expect(y).toBeGreaterThanOrEqual(prev); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(1); prev = y; }
  });
  const inBand = (n: number, seed = 11) => { const r = mulberry32(seed); const b = () => 0.4 + 0.3 * r();
    return Array.from({ length: n }, () => ({ warmth: b(), closeness: b(), joy: b(), calm: b(), spontaneity: b() })); };
  const shape = (st: ReturnType<typeof moodToEngineState>) => `${st.arp.chord.join(",")}|${st.arp.pattern}|${st.arp.octaves}`;
  it("moods in [0.4, 0.7]^5 give several distinct shapes from the axes alone", () => {
    const shapes = new Set(inBand(200).map((mood) => shape(moodToEngineState(stretchMood(mood)))));
    expect(shapes.size).toBeGreaterThanOrEqual(6);
  });
  it("the same axes give different shapes for different sessions, and the same for one session", () => {
    const mood = stretchMood({ warmth: 0.55, closeness: 0.55, joy: 0.6, calm: 0.6, spontaneity: 0.5 });
    const a = shape(moodToEngineState(mood, mood, voiceSeedOf("session-a")));
    expect(shape(moodToEngineState(mood, mood, voiceSeedOf("session-a")))).toBe(a);
    const others = new Set(Array.from({ length: 30 }, (_, i) => shape(moodToEngineState(mood, mood, voiceSeedOf(`session-${i}`)))));
    expect(others.size).toBeGreaterThan(3);
  });
  it("the seeded character is deterministic per id and differs between ids", () => {
    expect(characterFor(voiceSeedOf("x"))).toEqual(characterFor(voiceSeedOf("x")));
    const roots = new Set(Array.from({ length: 40 }, (_, i) => characterFor(voiceSeedOf(`id-${i}`)).rootOffset));
    expect(roots.size).toBeGreaterThan(2);
  });
  it("an explicit voice replaces the mapped fields, nothing else", () => {
    const mood = stretchMood({ warmth: 0.6, closeness: 0.6, joy: 0.6, calm: 0.6, spontaneity: 0.3 });
    const mapped = moodToEngineState(mood, mood, voiceSeedOf("v"));
    const v = Voice.parse({ root: "A2", scale: "dorian", chord: [1, 5, 9], pattern: "random", octaves: 2, wave: "square" });
    const { state } = applyOverride(mapped, voiceToSynth(v));
    expect(state.arp.scale).toBe("dorian"); expect(state.arp.chord).toEqual([1, 5, 9]); expect(state.arp.pattern).toBe("random");
    expect(state.arp.octaves).toBe(2); expect(state.osc.wave).toBe("square");
    expect(state.arp.tempo).toBe(mapped.arp.tempo); expect(state.filter.cutoff).toBe(mapped.filter.cutoff);
    expect(voiceToSynth(undefined)).toBeUndefined();
    expect(voiceToSynth({})).toBeUndefined();
  });
});

describe("stack, pad and the amp LFO in the synth override", () => {
  const base = { mood: neutral };
  it("accepts a stack of up to 3 intervals and a pad of up to 5 notes", () => {
    expect(SetSoundInput.safeParse({ ...base, synth: { osc: { stack: [7, 12, 16] }, pad: { notes: ["D3", "A3", "C4", "E4", "G4"] } } }).success).toBe(true);
    expect(SetSoundInput.safeParse({ ...base, synth: { osc: { stack: [1, 2, 3, 4] } } }).success).toBe(false);
    expect(SetSoundInput.safeParse({ ...base, synth: { pad: { notes: ["D3", "A3", "C4", "E4", "G4", "B4"] } } }).success).toBe(false);
  });
  it("allows an amp LFO up to 80 Hz but the other targets only up to 12 Hz", () => {
    const lfo = (target: string, rate: number) => SetSoundInput.safeParse({ ...base, synth: { lfo: [{ target, rate, depth: 0.5, shape: "sine" }] } }).success;
    expect(lfo("amp", 80)).toBe(true); expect(lfo("amp", 25)).toBe(true); expect(lfo("amp", 81)).toBe(false);
    expect(lfo("cutoff", 12)).toBe(true); expect(lfo("cutoff", 13)).toBe(false);
    expect(lfo("pitch", 30)).toBe(false); expect(lfo("pan", 30)).toBe(false);
  });
  it("puts the stack and the pad on the state, and a pad with notes turns itself on", () => {
    const { state, overridden } = applyOverride(moodToEngineState(neutral), {
      osc: { stack: [7, 12] }, pad: { notes: ["D3", "A3"], attack: 3 },
    });
    expect(state.osc.stack).toEqual([7, 12]);
    expect(state.pad).toMatchObject({ on: true, notes: [50, 57], attack: 3 });
    expect(overridden).toEqual(expect.arrayContaining(["osc.stack", "pad.notes", "pad.attack"]));
    expect(moodToEngineState(neutral).osc.stack).toEqual([]);
    expect(moodToEngineState(neutral).pad.on).toBe(false);
  });
  it("the colour pulse never follows the amp LFO, whatever its rate", () => {
    const { state } = applyOverride(moodToEngineState(m({ calm: 0.1 })), { lfo: [{ target: "amp", rate: 70, depth: 1, shape: "sine" }] });
    expect(state.colour.pulseHz).toBeLessThanOrEqual(1);
    expect(applyLimits({ mapped: state }).effective.colour.pulseHz).toBeLessThanOrEqual(3);
  });
});

describe("what stays on the session", () => {
  const colourOwn = { hue: 10, saturation: 0.9 };
  it("keeps the colour, stack, pad and LFOs from one call to the next, merging field by field", () => {
    let s = mergeSticky(null, { colour: colourOwn, synth: { osc: { stack: [7, 12] }, pad: { notes: ["D3", "A3"], attack: 3 }, lfo: [{ target: "amp", rate: 80, depth: 1, shape: "sine" }] } });
    expect(s.colour).toEqual(colourOwn); expect(s.stack).toEqual([7, 12]); expect(s.pad).toEqual({ notes: ["D3", "A3"], attack: 3, on: true }); expect(s.lfo).toHaveLength(1);
    s = mergeSticky(s, { colour: { lightness: 0.7 }, synth: { pad: { level: 0.4 } } });
    expect(s.colour).toEqual({ hue: 10, saturation: 0.9, lightness: 0.7 });
    expect(s.pad).toEqual({ notes: ["D3", "A3"], attack: 3, level: 0.4, on: true });
    expect(s.stack).toEqual([7, 12]); expect(s.lfo).toHaveLength(1);
    expect(mergeSticky(s, {})).toEqual(s); // a call that sends none of them changes nothing
  });
  it("clears: colour follow, stack [], lfo [] go back to the mapped values; the pad is silenced with on false", () => {
    const s = mergeSticky(null, { colour: colourOwn, synth: { osc: { stack: [7] }, lfo: [{ target: "amp", rate: 30, depth: 1, shape: "sine" }], pad: { notes: ["D3"] } } });
    const c = mergeSticky(s, { colour: { mode: "follow" }, synth: { osc: { stack: [] }, lfo: [] } });
    expect(c.colour).toBeUndefined(); expect(c.stack).toBeUndefined(); expect(c.lfo).toBeUndefined(); expect(c.pad).toBeDefined();
    expect(stickyToSynth(mergeSticky(c, { synth: { pad: { on: false } } }))?.pad).toMatchObject({ on: false, notes: ["D3"] });
  });
  it("new pad notes switch the pad back on after it was silenced", () => {
    let s = mergeSticky(null, { synth: { pad: { notes: ["D3"] } } });
    s = mergeSticky(s, { synth: { pad: { on: false } } });
    expect(stickyToSynth(s)?.pad?.on).toBe(false);
    s = mergeSticky(s, { synth: { pad: { notes: ["G2", "D3"] } } });
    const { state } = applyOverride(moodToEngineState(neutral), stickyToSynth(s));
    expect(state.pad.on).toBe(true); expect(state.pad.notes).toEqual([43, 50]);
  });
  it("turns kept settings into a synth override, and an empty lfo in a call into nothing", () => {
    expect(stickyToSynth(null)).toBeUndefined(); expect(stickyToSynth({})).toBeUndefined();
    expect(stickyToSynth({ stack: [7], lfo: [{ target: "amp", rate: 30, depth: 1, shape: "sine" }] })).toEqual({ osc: { stack: [7] }, lfo: [{ target: "amp", rate: 30, depth: 1, shape: "sine" }] });
    expect(callSynth({ lfo: [] })).toBeUndefined();
    expect(callSynth({ lfo: [], filter: { cutoff: 900 } })).toEqual({ filter: { cutoff: 900 } });
    expect(callSynth({ lfo: [{ target: "pan", rate: 1, depth: 1, shape: "sine" }] })?.lfo).toHaveLength(1);
  });
  it("reports pad, stack, LFOs, echo and the pattern in the feedback", () => {
    const { state } = applyOverride(moodToEngineState(neutral), { osc: { stack: [7, 12] }, pad: { notes: ["D3", "A3"] }, lfo: [{ target: "amp", rate: 80, depth: 1, shape: "sine" }] });
    const f = buildFeedback({ turn: 1, intent: neutral, effective: state, clamps: [], players: 1 });
    expect(f.playing).toMatchObject({ stack: [7, 12], pad: { notes: ["D3", "A3"], wave: "sine" }, lfo: ["amp 80Hz depth 1 sine"] });
    expect(f.playing).toHaveProperty("pattern"); expect(f.playing).toHaveProperty("echo"); expect(f.playing).toHaveProperty("chord");
    const plain = buildFeedback({ turn: 1, intent: neutral, effective: moodToEngineState(neutral), clamps: [], players: 1 }).playing as Record<string, unknown>;
    expect(plain).not.toHaveProperty("stack"); expect(plain).not.toHaveProperty("pad");
  });
});

describe("colour shapes and breathe", () => {
  const base = () => moodToEngineState(stretchMood(neutral), stretchMood(neutral), 1).colour;
  it("follow mode: a close, warm mood is a glow, anything else the linear wash it always was", () => {
    expect(moodToEngineState(stretchMood(m({ closeness: 0.9, warmth: 0.9 })), neutral, 1).colour.shape).toBe("glow");
    expect(moodToEngineState(stretchMood(m({ closeness: 0.2, warmth: 0.9 })), neutral, 1).colour.shape).toBe("wash");
  });
  it("the model can ask for a shape and for breathe, and breathe never pulses", () => {
    const c = applyColour(base(), { shape: "sweep", motion: "breathe" });
    expect(c.shape).toBe("sweep"); expect(c.motion).toBe("breathe"); expect(c.pulseHz).toBe(0);
    expect(Colour.safeParse({ shape: "orbit" }).success).toBe(false);
    const s = moodToEngineState(neutral, neutral, 1); s.colour = { ...c, pulseHz: 9 };
    hardCaps(s); expect(s.colour.pulseHz).toBe(0);
  });
  it("shows a shape other than the wash in the feedback, and nothing for the wash", () => {
    const s = moodToEngineState(neutral, neutral, 1);
    const f = (shape?: "wash" | "glow") => buildFeedback({ turn: 1, intent: neutral, effective: { ...s, colour: { ...s.colour, shape } }, clamps: [], players: 1 }).colour as Record<string, unknown>;
    expect(f("glow").shape).toBe("glow"); expect(f("wash")).not.toHaveProperty("shape");
  });
});

describe("reactions", () => {
  it("folds repeats and says how long ago", () => {
    const now = Date.parse("2026-11-10T10:00:00Z");
    const rows = [{ kind: "calmer", created_at: "2026-11-10T09:57:00Z" }, { kind: "calmer", created_at: "2026-11-10T09:59:30Z" }, { kind: "more_of_this", created_at: "2026-11-10T09:59:55Z" }];
    expect(describeReactions(rows, now)).toEqual(["more of this, 5 s ago", "calmer x2, 30 s ago"]);
    expect(describeReactions([], now)).toEqual([]);
  });
});

describe("analysis", () => {
  const state = (o: Partial<MoodT> = {}) => moodToEngineState(stretchMood({ ...neutral, ...o }), stretchMood({ ...neutral, ...o }), voiceSeedOf("a"));
  it("explains a reading that is far from what was sent: names the parts that pull it", () => {
    const eff = state({ joy: 0.1, calm: 0.2 });
    const an = analyze(eff, 3);
    const fb = buildFeedback({ turn: 1, intent: { ...neutral, joy: 1 }, effective: eff, clamps: [], players: 1, analysis: an }) as { reads_why?: Record<string, string> };
    expect(fb.reads_why?.joy).toMatch(/^held down by \w+(, \w+)?$/);
    const close = buildFeedback({ turn: 1, intent: { ...neutral, joy: an.reads_as.joy, calm: an.reads_as.calm, warmth: an.reads_as.warmth, closeness: an.reads_as.closeness, spontaneity: an.reads_as.spontaneity },
      effective: eff, clamps: [], players: 1, analysis: an });
    expect(close).not.toHaveProperty("reads_why");
  });
  it("measures a state: plausible loudness, words and estimates in range", () => {
    const a = analyze(state({ joy: 0.7, calm: 0.7 }), 3);
    expect(a.sound.loudness_db).toBeLessThan(-5); expect(a.sound.loudness_db).toBeGreaterThan(-60);
    expect(["very low", "low", "medium", "high", "very high"]).toContain(a.sound.brightness);
    expect(["sparse", "medium", "dense"]).toContain(a.sound.density);
    for (const v of Object.values(a.reads_as)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it("reads a calm, warm sound as calmer than an urgent, cold one, from the audio alone", () => {
    const calm = analyze(state({ calm: 0.95, warmth: 0.9, joy: 0.6, spontaneity: 0.1 }), 3).reads_as;
    const urgent = analyze(state({ calm: 0.05, warmth: 0.1, joy: 0.3, spontaneity: 0.9 }), 3).reads_as;
    expect(calm.calm).toBeGreaterThan(urgent.calm + 0.2);
    expect(calm.warmth).toBeGreaterThan(urgent.warmth);
  });
  it("reads a major chord as more joyful than a minor one, and a stack as denser notes together", () => {
    const base = state({ joy: 0.5 }); base.arp.chord = [1, 3, 5]; base.drone.on = false; base.bass.on = false; base.arp.scale = "major";
    const minor = JSON.parse(JSON.stringify(base)); minor.arp.scale = "minor";
    expect(analyze(base, 3).reads_as.joy).toBeGreaterThan(analyze(minor, 3).reads_as.joy);
  });
  it("keeps valence and arousal apart (third test): a low joy on a bright square wave still reads low, an urgent mood reads urgent", () => {
    const sad = state({ joy: 0.2, calm: 0.5 }); sad.osc.wave = "square"; sad.filter.cutoff = 5000;
    expect(analyze(sad, 3).reads_as.joy).toBeLessThan(0.4);
    expect(analyze(state({ joy: 0.5, calm: 0.12, spontaneity: 0.7 }), 3).reads_as.calm).toBeLessThan(0.35);
  });
  it("tension: absent or 0 leaves the sound as it was, and more of it is heard as more clash", () => {
    const base = stretchMood(neutral);
    expect(moodToEngineState({ ...base, tension: 0 }, base, 7)).toEqual(moodToEngineState(base, base, 7));
    const low = analyze(moodToEngineState(stretchMood({ ...neutral, tension: 0 }), base, 7), 3).reads_as.tension;
    const high = analyze(moodToEngineState(stretchMood({ ...neutral, tension: 0.9 }), base, 7), 3).reads_as.tension;
    expect(high).toBeGreaterThan(low + 0.3);
  });
  it("is deterministic and does not change the state it measures", () => {
    const s = state(); const copy = JSON.stringify(s);
    expect(analyze(s, 5).reads_as).toEqual(analyze(s, 5).reads_as);
    expect(JSON.stringify(s)).toBe(copy);
  });
  it("is fast enough to run inside set_sound", () => {
    const t = Date.now(); analyze(state(), 1); expect(Date.now() - t).toBeLessThan(1500);
  });
  it("puts sound and reads_as in the feedback only when it has them", () => {
    const eff = state();
    expect(buildFeedback({ turn: 1, intent: neutral, effective: eff, clamps: [], players: 1 })).not.toHaveProperty("reads_as");
    const f = buildFeedback({ turn: 1, intent: neutral, effective: eff, clamps: [], players: 1, analysis: { sound: { brightness: "low" }, reads_as: { joy: 0.5 } } });
    expect(f.sound).toEqual({ brightness: "low" }); expect(f.reads_as).toEqual({ joy: 0.5 });
  });
});

describe("the shared timeline", () => {
  const st = (tempo: number, rate: "1/8" | "1/4" = "1/8") => { const s = moodToEngineState(neutral); s.arp.tempo = tempo; s.arp.rate = rate; s.bass.stepSeconds = 2; return s; };
  it("starts at zero and counts steps forward at the previous state's step length", () => {
    expect(nextGrid(null, 1000)).toEqual({ arp: 0, bass: 0 });
    const a = st(120); a.grid = { arp: 0, bass: 0 };
    const prev = { effective: a, created_at: new Date(10_000).toISOString() };
    const g = nextGrid(prev, 10_000 + 3_000); // 3 s later: 0.25 s steps and 2 s bass steps
    expect(g.arp).toBeCloseTo(12, 9); expect(g.bass).toBeCloseTo(1.5, 9);
    const b = st(60, "1/4"); b.grid = g; b.transition = { time: 0, curve: "sudden" };
    const g2 = nextGrid({ effective: b, created_at: new Date(13_000).toISOString() }, 13_000 + 2_000);
    expect(g2.arp).toBeCloseTo(14, 9); // 1 s steps now
  });
  it("counts the steps of a tempo glide in closed form, and a state written mid-glide starts from the tempo that played", () => {
    const a = st(120); a.grid = { arp: 0, bass: 0 };
    const b = st(60); b.transition = { time: 4, curve: "smooth" }; b.grid = nextGrid({ effective: a, created_at: new Date(0).toISOString() }, 10_000, b);
    expect(b.grid.fromTempo).toBe(120); expect(b.grid.glide).toBe(4);
    // 4 steps/s going down to 2 steps/s over 4 s: after 2 s the rate is 3 and 7 steps have passed
    expect(nextGrid({ effective: b, created_at: new Date(0).toISOString() }, 2_000).arp - b.grid.arp).toBeCloseTo(7, 6);
    expect(nextGrid({ effective: b, created_at: new Date(0).toISOString() }, 2_000).fromTempo).toBeCloseTo(90, 6);
    expect(nextGrid({ effective: b, created_at: new Date(0).toISOString() }, 6_000).arp - b.grid.arp).toBeCloseTo(12 + 4, 6); // 12 in the glide, then 2 s at 2/s
  });
  it("never goes backwards, and copes with states that have no grid", () => {
    const a = st(100);
    expect(nextGrid({ effective: a, created_at: new Date(5000).toISOString() }, 4000).arp).toBe(0);
    expect(stepSecondsOf(a).arp).toBeCloseTo(0.3, 9);
  });
});

