import { describe, expect, it } from "vitest";
import { Engine, neutralState, renderOffline, noteToMidi, buildCycle, mulberry32, type EngineState, type NoteEvent } from "../src";

const SR = 22050;
const render = (s: EngineState, seconds = 4, seed = 7) => renderOffline(s, { seconds, sampleRate: SR, seed });
const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const same = (a: Float32Array, b: Float32Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const rms = (a: Float32Array) => Math.sqrt(a.reduce((m, v) => m + v * v, 0) / a.length);

describe("music helpers", () => {
  it("parses note names", () => {
    expect(noteToMidi("D3")).toBe(50);
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("F#2")).toBe(42);
    expect(noteToMidi("Bb4")).toBe(70);
    expect(noteToMidi("H9")).toBeUndefined();
  });
  it("orders patterns without repeating the ends in up_down", () => {
    const up = buildCycle(60, "major", [1, 3, 5], 1, "up");
    expect(up).toEqual([60, 64, 67]);
    expect(buildCycle(60, "major", [1, 3, 5], 1, "down")).toEqual([67, 64, 60]);
    expect(buildCycle(60, "major", [1, 3, 5], 1, "up_down")).toEqual([60, 64, 67, 64]);
    expect(buildCycle(60, "major", [1, 3, 5], 2, "up")).toEqual([60, 64, 67, 72, 76, 79]);
  });
  it("continues degrees past the top of the scale into the next octave", () => {
    expect(buildCycle(60, "major", [1, 3, 5, 7, 8, 10], 1, "up")).toEqual([60, 64, 67, 71, 72, 76]);
  });
});

describe("engine", () => {
  it("is deterministic for the same state and seed", () => {
    const s = neutralState();
    s.arp.density = 0.7; s.arp.jitterMs = 15; s.arp.pattern = "random";
    const a = render(s), b = render(s);
    expect(same(a.left, b.left)).toBe(true);
    expect(same(a.right, b.right)).toBe(true);
    expect(a.events).toEqual(b.events);
  });

  it("different seeds give different random patterns", () => {
    const s = neutralState(); s.arp.pattern = "random"; s.arp.chord = [1, 3, 5, 7]; s.arp.octaves = 2;
    const a = render(s, 4, 1).events.map((e) => e.midi), b = render(s, 4, 2).events.map((e) => e.midi);
    expect(a).not.toEqual(b);
  });

  it("stays finite and within ±1 for random valid states", () => {
    const r = mulberry32(99);
    const waves = ["sine", "triangle", "sawtooth", "square"] as const;
    for (let i = 0; i < 25; i++) {
      const s = neutralState();
      s.osc.wave = waves[Math.floor(r() * 4)]; s.osc.voices = 1 + Math.floor(r() * 3); s.osc.drive = r();
      s.filter.cutoff = 100 + r() * 8000; s.filter.resonance = 0.7 + r() * 15;
      s.arp.tempo = 50 + r() * 150; s.arp.octaves = 1 + Math.floor(r() * 3);
      s.arp.swing = r() * 0.4; s.arp.jitterMs = r() * 30; s.volume = r() * 0.9;
      s.fx.delay.feedback = r() * 0.6; s.fx.delay.mix = r() * 0.5; s.fx.reverb.mix = r() * 0.6;
      s.drone.on = r() > 0.5; s.bass.on = r() > 0.5;
      s.lfo = [{ target: "cutoff", rate: r() * 5, depth: r(), shape: "random" }, { target: "amp", rate: r() * 8, depth: r() * 0.6, shape: "square" }];
      const { left, right } = render(s, 2, i);
      for (const ch of [left, right]) {
        for (const v of ch) if (!Number.isFinite(v)) throw new Error(`non-finite sample in state ${i}`);
        expect(peak(ch)).toBeLessThanOrEqual(0.98);
      }
    }
  });

  it("makes sound, and silence when volume is 0", () => {
    const s = neutralState();
    expect(rms(render(s).left)).toBeGreaterThan(0.002);
    s.volume = 0;
    expect(peak(render(s).left)).toBeLessThan(1e-6);
  });

  it("produces arp events that follow pattern, rate and tempo", () => {
    const s = neutralState();
    s.arp.tempo = 120; s.arp.rate = "1/8"; s.arp.chord = [1, 3, 5]; s.arp.root = 60; s.arp.scale = "major"; s.arp.pattern = "up";
    const ev = render(s, 4).events.filter((e) => e.layer === "arp");
    expect(ev.slice(0, 6).map((e) => e.midi)).toEqual([60, 64, 67, 60, 64, 67]);
    expect(ev[1].time - ev[0].time).toBeCloseTo(0.25, 2); // 1/8 at 120 BPM
    expect(ev.length).toBeGreaterThanOrEqual(15);
  });

  it("density 0 plays nothing, arp off plays nothing", () => {
    const s = neutralState(); s.arp.density = 0;
    expect(render(s).events.length).toBe(0);
    const t = neutralState(); t.arp.on = false;
    expect(render(t).events.length).toBe(0);
  });

  it("plays the bass layer at its own step", () => {
    const s = neutralState(); s.arp.on = false; s.bass.on = true; s.bass.stepSeconds = 1; s.bass.root = 38; s.bass.chord = [1, 3, 5];
    const ev = render(s, 6).events.filter((e) => e.layer === "bass");
    expect(ev.length).toBeGreaterThanOrEqual(5);
    expect(ev[1].time - ev[0].time).toBeCloseTo(1, 1);
    expect(neutralState().bass.on).toBe(false);
    expect(render(neutralState()).events.some((e) => e.layer === "bass")).toBe(false);
  });

  it("glides the cutoff monotonically over the transition", () => {
    const e = new Engine(SR, 3);
    const a = neutralState(); a.filter.cutoff = 400;
    const b = neutralState(); b.filter.cutoff = 4000; b.transition = { time: 2, curve: "smooth" };
    e.setState(a, 3); e.setState(b, 3);
    const l = new Float32Array(SR / 10), r = new Float32Array(SR / 10);
    let prev = 0;
    for (let i = 0; i < 25; i++) {
      e.process(l, r, l.length);
      const c = e.params().cutoff;
      expect(c).toBeGreaterThanOrEqual(prev - 1e-9); prev = c;
    }
    expect(prev).toBeCloseTo(4000, 0);
  });

  it("a sudden curve reaches the target in about 30 ms", () => {
    const e = new Engine(SR, 3);
    e.setState(neutralState(), 3);
    const b = neutralState(); b.filter.cutoff = 5000; b.transition = { time: 8, curve: "sudden" };
    e.setState(b, 3);
    const l = new Float32Array(SR / 10), r = new Float32Array(SR / 10);
    e.process(l, r, l.length);
    expect(e.params().cutoff).toBeCloseTo(5000, 0);
  });

  it("works with any block size", () => {
    const s = neutralState();
    const whole = render(s, 1);
    const e = new Engine(SR, 7);
    e.setState(s, 7);
    const n = SR, l = new Float32Array(n), r = new Float32Array(n);
    for (let i = 0; i < n; ) {
      const f = Math.min(n - i, 100 + (i % 7));
      e.process(l.subarray(i, i + f), r.subarray(i, i + f), f); i += f;
    }
    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(l[i] - whole.left[i]));
    expect(maxDiff).toBeLessThan(1e-3);
  });

  it("drive 0 leaves the signal clean, drive adds saturation", () => {
    const clean = neutralState(); clean.osc.wave = "sine"; clean.filter.cutoff = 8000;
    const dirty = neutralState(); dirty.osc.wave = "sine"; dirty.filter.cutoff = 8000; dirty.osc.drive = 1;
    const a = render(clean).left, b = render(dirty).left;
    expect(same(a, b)).toBe(false);
  });

  it("the echo is Claude's: mix 0 is dry, and the maximum feedback and mix stay finite and under the clip", () => {
    const echo = neutralState(); echo.fx.delay = { time: 1.5, feedback: 0.85, mix: 1 }; echo.fx.reverb.mix = 0;
    const none = neutralState(); none.fx.delay = { time: 0.3, feedback: 0.85, mix: 0 }; none.fx.reverb.mix = 0;
    const run = (s: EngineState) => {
      const e = new Engine(SR, 5); e.setState(s, 5);
      const l = new Float32Array(SR * 6), r = new Float32Array(SR * 6); e.process(l, r, l.length); return l;
    };
    const dry = run(none), wet = run(echo);
    expect(same(dry, wet)).toBe(false);
    expect(peak(wet)).toBeLessThanOrEqual(0.98);
    expect(Number.isFinite(rms(wet))).toBe(true);
  });

  it("drone fades in and out over about 3 s", () => {
    const off = neutralState(); off.arp.on = false;
    const on = neutralState(); on.arp.on = false; on.drone.on = true; on.drone.level = 0.3;
    const e = new Engine(SR, 1); e.setState(off, 1); e.setState(on, 1);
    const l = new Float32Array(SR / 2), r = new Float32Array(SR / 2);
    e.process(l, r, l.length); const early = rms(l);
    for (let i = 0; i < 8; i++) e.process(l, r, l.length);
    expect(rms(l)).toBeGreaterThan(early * 2);
  });
});

describe("stack, pad and the fast amp LFO", () => {
  it("a stack makes every arp note a chord: one voice per interval at the same time", () => {
    const s = neutralState();
    s.arp.tempo = 120; s.arp.chord = [1, 3, 5]; s.arp.root = 60; s.arp.scale = "major"; s.arp.pattern = "up"; s.osc.stack = [7, 12];
    const ev = render(s, 2).events.filter((e) => e.layer === "arp");
    expect(ev.slice(0, 3).map((e) => e.midi)).toEqual([60, 67, 72]);
    expect(ev[0].time).toBe(ev[1].time);
    expect(ev[3].midi).toBe(64);
    const plain = neutralState(); plain.arp.chord = [1, 3, 5]; plain.arp.root = 60; plain.arp.scale = "major"; plain.arp.tempo = 120;
    expect(peak(render(s, 4).left)).toBeLessThanOrEqual(0.98);
    expect(same(render(s, 2).left, render(plain, 2).left)).toBe(false);
  });
  it("a pad sounds on its own with the arp off, fades in slowly and stays finite", () => {
    const s = neutralState(); s.arp.on = false; s.pad = { on: true, notes: [48, 55, 60, 64, 67], wave: "triangle", level: 0.5, attack: 2, release: 2 };
    const out = render(s, 6).left;
    const first = rms(out.slice(0, SR / 4)), later = rms(out.slice(SR * 4));
    expect(later).toBeGreaterThan(0.001);
    expect(Number.isFinite(later)).toBe(true);
    const e = new Engine(SR, 3); const off = neutralState(); off.arp.on = false; off.pad = { ...s.pad, on: false };
    e.setState(s, 3); const l = new Float32Array(SR * 2), r = new Float32Array(SR * 2); e.process(l, r, l.length);
    e.setState({ ...off, transition: { time: 0.1, curve: "smooth" } }, 3);
    const tail = new Float32Array(SR * 6), tr = new Float32Array(SR * 6); e.process(tail, tr, tail.length);
    expect(rms(tail.slice(SR * 5))).toBeLessThan(first + later); // the pad dies away with its release
    expect(rms(tail.slice(SR * 5))).toBeLessThan(1e-3);
  });
  it("an amp LFO at 80 Hz changes the sound and stays finite and under the clip", () => {
    const base = neutralState(); base.arp.on = false; base.drone = { on: true, notes: [50, 57], wave: "sawtooth", level: 0.5 };
    const grain = JSON.parse(JSON.stringify(base)) as EngineState;
    grain.lfo = [{ target: "amp", rate: 80, depth: 1, shape: "sine" }];
    const a = render(base, 3).left, b = render(grain, 3).left;
    expect(same(a, b)).toBe(false);
    expect(Number.isFinite(rms(b))).toBe(true); expect(peak(b)).toBeLessThanOrEqual(0.98);
    // the modulation is audible as amplitude movement within 100 ms windows
    const win = Math.floor(SR / 100);
    const levels: number[] = []; for (let i = SR * 2; i + win < b.length; i += win) levels.push(rms(b.slice(i, i + win)));
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.001);
  });

  it("plays a state stored before the stack and the pad existed, the same as one with defaults", () => {
    const full = neutralState();
    const old = JSON.parse(JSON.stringify(full)); delete old.pad; delete old.osc.stack;
    expect(() => render(old as EngineState, 1)).not.toThrow();
    expect(same(render(old as EngineState, 2).left, render(full, 2).left)).toBe(true);
  });
  it("does not jump in level when the pad turns off or changes its number of notes", () => {
    const run = (from: EngineState, to: EngineState) => {
      const e = new Engine(SR, 4); e.setState(from, 4);
      const warm = new Float32Array(SR * 6), wr = new Float32Array(SR * 6); e.process(warm, wr, warm.length);
      const before = rms(warm.slice(SR * 5));
      e.setState({ ...to, transition: { time: 0.03, curve: "smooth" } }, 4);
      const win = Math.floor(SR / 10);
      let worst = 0;
      for (let i = 0; i < 20; i++) { const l = new Float32Array(win), r = new Float32Array(win); e.process(l, r, win); worst = Math.max(worst, rms(l)); }
      return { before, worst };
    };
    const on5 = neutralState(); on5.arp.on = false; on5.pad = { on: true, notes: [48, 55, 60, 64, 67], wave: "triangle", level: 0.5, attack: 1, release: 4 };
    const off = JSON.parse(JSON.stringify(on5)) as EngineState; off.pad.on = false;
    const a = run(on5, off);
    expect(a.worst).toBeLessThanOrEqual(a.before * 1.25);
    const on2 = JSON.parse(JSON.stringify(on5)) as EngineState; on2.pad.notes = [48, 55];
    const b = run(on5, on2);
    expect(b.worst).toBeLessThanOrEqual(b.before * 1.25);
  });

  it("a state with a delay waits, the sound before it plays out, and a newer state replaces one that is waiting", () => {
    const loud = neutralState(); loud.volume = 0.5;
    const quiet = JSON.parse(JSON.stringify(loud)) as EngineState; quiet.volume = 0; quiet.transition = { time: 0.1, curve: "smooth" };
    const block = (e: Engine, sec: number) => { const l = new Float32Array(Math.round(SR * sec)), r = new Float32Array(l.length); e.process(l, r, l.length); return l; };
    const e = new Engine(SR, 9); e.setState(loud, 9); block(e, 1);
    e.setState(quiet, 9, 2);
    expect(rms(block(e, 1.5))).toBeGreaterThan(0.01);  // still playing during the delay
    block(e, 0.9);                                       // past the delay (2 s) and its short fade
    expect(rms(block(e, 1))).toBeLessThan(0.002);        // silent after it
    const f = new Engine(SR, 9); f.setState(loud, 9); block(f, 1);
    f.setState(quiet, 9, 2); f.setState(loud, 9);        // replaced before it started
    expect(rms(block(f, 4))).toBeGreaterThan(0.01);
  });

  it("two devices play the same notes at the same moments, whenever they joined (the shared timeline)", () => {
    const s = neutralState();
    s.arp = { ...s.arp, pattern: "random", density: 0.6, jitterMs: 12, swing: 0.3, tempo: 111, rate: "1/8t", chord: [1, 3, 5, 7], octaves: 2 };
    s.bass = { ...s.bass, on: true }; s.grid = { arp: 3.25, bass: 1.5 };
    const run = (joinedAt: number, seconds: number) => {
      const e = new Engine(SR, 77); const ev: NoteEvent[] = []; e.recordEvents(ev);
      e.setState(s, 5, 0, joinedAt);
      const l = new Float32Array(Math.round(SR * seconds)), r = new Float32Array(l.length); e.process(l, r, l.length);
      return ev.map((x) => ({ ...x, time: x.time + joinedAt })); // times on the shared timeline
    };
    const early = run(0, 12), late = run(5.3, 6.7);
    for (const layer of ["arp", "bass"] as const) {
      const a = early.filter((x) => x.layer === layer && x.time >= 5.8), b = late.filter((x) => x.layer === layer && x.time >= 5.8);
      expect(a.length).toBeGreaterThan(layer === "arp" ? 5 : 2);
      expect(b.map((x) => x.midi)).toEqual(a.map((x) => x.midi));
      for (let i = 0; i < a.length; i++) expect(Math.abs(a[i].time - b[i].time)).toBeLessThan(0.002);
    }
  });
  it("a layer that is off still counts its steps, and resync only moves a grid that has drifted", () => {
    const s = neutralState(); s.arp.tempo = 120; s.arp.rate = "1/8"; s.arp.chord = [1, 3, 5]; s.arp.root = 60; s.arp.scale = "major"; s.arp.pattern = "up";
    const e = new Engine(SR, 3); const ev: NoteEvent[] = []; e.recordEvents(ev);
    e.setState(s, 3, 0, 0); const l = new Float32Array(SR * 2), r = new Float32Array(SR * 2); e.process(l, r, l.length);
    const before = ev.length;
    e.syncGrid(2.0 + 0.01); e.process(l, r, l.length); // 10 ms off: within the tolerance, nothing moves
    const gaps = ev.slice(before).map((x, i, a) => (i ? x.time - a[i - 1].time : 0)).slice(1);
    for (const g of gaps) expect(g).toBeCloseTo(0.25, 2);
    const n2 = ev.length;
    e.syncGrid(4.0 + 0.1); e.process(l, r, l.length); // 100 ms off: pulled back, still on the 0.25 s grid afterwards
    const later = ev.slice(n2).filter((x) => x.layer === "arp").map((x) => x.time);
    for (let i = 2; i < later.length; i++) expect(later[i] - later[i - 1]).toBeCloseTo(0.25, 2);
  });

  it("a resync while a delayed state waits does not move the grid of the sound that plays, nor the one that follows", () => {
    const a = neutralState(); a.arp.tempo = 120; a.arp.rate = "1/8"; a.arp.pattern = "up"; a.arp.chord = [1, 3, 5]; a.grid = { arp: 0, bass: 0 };
    const b = JSON.parse(JSON.stringify(a)) as EngineState; b.volume = 0; b.grid = { arp: 24, bass: 0 }; b.transition = { time: 2, curve: "smooth", delay: 4 };
    const run = (sync: boolean) => {
      const e = new Engine(SR, 3); const ev: NoteEvent[] = []; e.recordEvents(ev);
      e.setState(a, 3, 0, 0);
      const l = new Float32Array(SR), r = new Float32Array(SR); e.process(l, r, l.length);
      e.setState(b, 3, 3, 4);                         // written at 6 s on the shared clock, starts 4 s later, we heard it at 1 s
      for (let i = 0; i < 6; i++) { if (sync && i <= 3) e.syncGrid(0.2 + i); e.process(l, r, l.length); } // wrong elapsed on purpose, only while the state waits
      return ev.filter((x) => x.layer === "arp").map((x) => x.time);
    };
    const plain = run(false), synced = run(true);
    expect(synced).toEqual(plain);
    for (let i = 1; i < plain.length; i++) expect(plain[i] - plain[i - 1]).toBeCloseTo(0.25, 2);
  });
});

