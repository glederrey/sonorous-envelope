import { describe, expect, it } from "vitest";
import { neutralState } from "@sonorous/engine";
import { restedState } from "./rested-state";

describe("restedState", () => {
  it("is silent, dark and still over 30 s, and leaves the input alone", () => {
    const base = neutralState();
    base.volume = 0.5; base.colour.l = 0.4; base.colour.motion = "pulse"; base.colour.pulseHz = 1;
    const r = restedState(base);
    expect(r.volume).toBe(0);
    expect(r.transition).toEqual({ time: 30, curve: "smooth" });
    expect(r.colour.l).toBeLessThan(0.1);
    expect(r.colour.motion).toBe("still");
    expect(r.colour.pulseHz).toBe(0);
    expect(base.volume).toBe(0.5);
    expect(r.arp.on).toBe(base.arp.on); // layers keep running, only the volume fades
  });
});
