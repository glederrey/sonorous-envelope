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
  it("stays within 40 ms of the beat at every tempo", () => {
    for (const bpm of [60, 120, 180, 200]) {
      const s = state(bpm), clock = new BeatClock();
      const frames = run(clock, (t) => beatsAt(s, t), 10);
      const worst = Math.max(...frames.map((f) => Math.abs(f.drawn - f.want))) * (60 / bpm);
      expect(worst).toBeLessThan(0.04);
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

  it("never snaps: a jump in the target is closed gradually", () => {
    const clock = new BeatClock();
    const frames = run(clock, (t) => (t < 1 ? t * 2 : t * 2 + 3), 9); // 120 BPM, then the target jumps 3 beats ahead at t = 1; closing 3 beats at 0.5 beats/s takes 6 s
    const steps = frames.slice(1).map((f, i) => f.drawn - frames[i].drawn);
    // per frame: the natural 2 beats/s plus at most 0.5 beats/s of correction
    expect(Math.max(...steps)).toBeLessThan((2 + 0.5) / 60 + 1e-9);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    const last = frames[frames.length - 1];
    expect(Math.abs(last.drawn - last.want)).toBeLessThan(0.05); // and it has caught up
  });

  it("starts from the target after a hidden tab or a huge gap", () => {
    const clock = new BeatClock();
    clock.update(10, 0); clock.update(10.03, 16);
    expect(clock.update(500, 60_000)).toBe(500);
    clock.update(501, 60_016);
    expect(clock.update(2, 60_032)).toBe(2); // a gap over 16 beats snaps too
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
