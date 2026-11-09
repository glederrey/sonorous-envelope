import { describe, expect, it } from "vitest";
import { neutralState } from "@sonorous/engine";
import { describeSet } from "./what-claude-set";

describe("describeSet", () => {
  it("summarises the mood sent, the sound, the colour, the note and the clamps", () => {
    const effective = neutralState(); effective.arp.root = 50; effective.arp.scale = "harmonic_minor"; effective.arp.tempo = 90.4;
    const d = describeSet({
      turn: 3, final: true, created_at: "2026-11-09T10:00:00Z", clamps: ["pulse 9→3 (safety)"], effective,
      intent: { mood: { warmth: 0.8, closeness: 0.5, joy: 0.123, calm: 1, spontaneity: 0 }, note: "tired but warm", overridden: ["arp.root"] },
    });
    expect(d.mood).toEqual([
      { axis: "warmth", value: 0.8 }, { axis: "closeness", value: 0.5 }, { axis: "joy", value: 0.12 },
      { axis: "calm", value: 1 }, { axis: "spontaneity", value: 0 },
    ]);
    expect(d.sound).toMatch(/^D harmonic minor, 90 BPM/);
    expect(d.note).toBe("tired but warm"); expect(d.clamps).toEqual(["pulse 9→3 (safety)"]); expect(d.overridden).toEqual(["arp.root"]);
  });
  it("copes with a state that has no note, mood or clamps", () => {
    const d = describeSet({ turn: 0, final: true, created_at: "x", clamps: null, effective: neutralState(), intent: {} });
    expect(d.note).toBeNull(); expect(d.clamps).toEqual([]); expect(d.mood.every((m) => m.value === 0)).toBe(true);
  });
});
