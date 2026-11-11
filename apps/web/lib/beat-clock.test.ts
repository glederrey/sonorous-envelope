import { describe, expect, it } from "vitest";
import { beatsAt, neutralState, type EngineState } from "@sonorous/engine";
import { BeatClock, beatFraction, outputLatencySeconds } from "./beat-clock";

const state = (tempo: number, rate: EngineState["arp"]["rate"] = "1/8", grid?: EngineState["grid"]): EngineState => {
  const s = neutralState(); s.arp.tempo = tempo; s.arp.rate = rate; s.grid = grid ?? { arp: 0, bass: 0, beat: 0 }; return s;
};
/** Runs the clock at 60 frames per second over `seconds` and returns, per frame, the drawn beats and the beats of the target. */
function run(clock: BeatClock, target: (t: number) => number, seconds: number, t0 = 0) {
  const out: { drawn: number; want: number }[] = [];
  for (let t = t0; t <= t0 + seconds + 1e-9; t += 1 / 60) out.push({ drawn: clock.update(target(t), t * 1000), want: target(t) });
  return out;
}

describe("beat clock", () => {
  it("closes a phase offset to within 40 ms at every tempo", () => {
    for (const bpm of [60, 120, 180, 200]) {
      const s = state(bpm), clock = new BeatClock();
      // a clock offset: from t = 1 s the model says the beat is 0.3 of a beat later (the server-time estimate moved)
      const frames = run(clock, (t) => beatsAt(s, t) + (t >= 1 ? 0.3 : 0), 8);
      const tail = frames.slice(-60); // the last second
      expect(Math.max(...tail.map((f) => Math.abs(f.drawn - f.want)))).toBeLessThan(0.04 * (bpm / 60));
    }
  });

  it("follows a tempo glide and a rate change in the shared timeline", () => {
    const a = state(120);
    // a state written 3 s in, gliding to 60 BPM over 4 s with quarter-note steps: the beat counter carries on from 6
    const b = state(60, "1/4", { arp: 3, bass: 0, beat: 6, fromTempo: 120, glide: 4 });
    const target = (t: number) => (t < 3 ? beatsAt(a, t) : beatsAt(b, t - 3));
    const frames = run(new BeatClock(), target, 9);
    expect(Math.max(...frames.map((f) => Math.abs(f.drawn - f.want)))).toBeLessThan(0.08); // beats, at most 80 ms at 60 BPM
    expect(target(3)).toBeCloseTo(6, 9);
  });

  it("never runs the pulse through anti-phase: whole beats at once, the fraction closed gradually", () => {
    const wrap = (d: number) => d - Math.round(d); // difference of the beat fractions, in [-0.5, 0.5]
    for (const jump of [3, 3.4, 2.6, -0.3]) {
      const frames = run(new BeatClock(), (t) => (t < 1 ? t * 2 : t * 2 + jump), 8); // 120 BPM, then the target jumps ahead at t = 1
      const diffs = frames.map((f) => Math.abs(wrap(f.drawn - f.want)));
      expect(Math.max(...diffs)).toBeLessThanOrEqual(Math.abs(wrap(jump)) + 1e-9); // the phase error never exceeds the initial one
      // the fraction itself never moves faster than the natural 2 beats/s plus the bounded correction
      const steps = frames.slice(1).map((f, i) => wrap(f.drawn - frames[i].drawn));
      expect(Math.max(...steps.map(Math.abs))).toBeLessThan((2 + 0.5) / 60 + 1e-9);
      expect(diffs[diffs.length - 1]).toBeLessThan(0.02); // and it has caught up
    }
  });

  it("starts from the target after a hidden tab or a huge gap", () => {
    const clock = new BeatClock();
    clock.update(10, 0); clock.update(10.03, 16);
    expect(clock.update(500, 60_000)).toBe(500);
  });

  it("reads the beat fraction", () => {
    expect(beatFraction(7.25)).toBeCloseTo(0.25, 9);
    expect(beatFraction(3)).toBe(0);
  });
});

describe("output latency", () => {
  it("prefers outputLatency, falls back to baseLatency, adds the listener's nudge, and stays sane", () => {
    expect(outputLatencySeconds({ outputLatency: 0.12, baseLatency: 0.01 })).toBeCloseTo(0.12, 9);
    expect(outputLatencySeconds({ baseLatency: 0.01 })).toBeCloseTo(0.01, 9); // Safari has no outputLatency
    expect(outputLatencySeconds({ outputLatency: 0, baseLatency: 0.02 }, 150)).toBeCloseTo(0.17, 9);
    expect(outputLatencySeconds(null)).toBe(0);
    expect(outputLatencySeconds({ outputLatency: 5 })).toBe(1);
    expect(outputLatencySeconds({ baseLatency: 0.01 }, -500)).toBe(0);
    expect(outputLatencySeconds({ baseLatency: 0.01 }, NaN)).toBeCloseTo(0.01, 9);
  });
});
