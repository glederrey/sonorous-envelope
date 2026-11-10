import { describe, expect, it } from "vitest";
import { checkGesture, decideSwitch, gesturesOn, effectiveRestAfter, faceLine, normalizeFace, SWITCH_MIN_MS } from "./modes";

const base = { policy: "auto" as const, current: "internal" as const, requested: "external" as const, turnsSince: 5, msSince: SWITCH_MIN_MS + 1 };

describe("faces", () => {
  it("reads old names", () => {
    expect(normalizeFace("outer")).toBe("external");
    expect(normalizeFace("inner")).toBe("internal");
    expect(normalizeFace(undefined)).toBe("internal");
  });
  it("does nothing when no face is asked for, or the same one", () => {
    expect(decideSwitch({ ...base, requested: undefined })).toEqual({ change: null });
    expect(decideSwitch({ ...base, requested: "internal" })).toEqual({ change: null });
  });
  it("a lock is final, and says so", () => {
    for (const policy of ["internal", "external"] as const) {
      const r = decideSwitch({ ...base, policy, current: policy === "internal" ? "internal" : "external", requested: policy === "internal" ? "external" : "internal" });
      expect(r.change).toBeNull();
      expect(r.note).toMatch(/locked/);
    }
  });
  it("going internal is always allowed, even right after a change", () => {
    expect(decideSwitch({ ...base, current: "external", requested: "internal", turnsSince: 0, msSince: 1000 })).toEqual({ change: "internal" });
  });
  it("going external waits 2 finished messages and 2 minutes after the last change, and says how long", () => {
    expect(decideSwitch(base)).toEqual({ change: "external" });
    expect(decideSwitch({ ...base, turnsSince: 1 }).note).toMatch(/1 more message and 0 s/);
    expect(decideSwitch({ ...base, turnsSince: 0, msSince: 30_000 }).note).toMatch(/2 more messages and 90 s/);
    expect(decideSwitch({ ...base, msSince: SWITCH_MIN_MS - 5000 }).note).toMatch(/0 more messages and 5 s/);
    expect(decideSwitch({ ...base, turnsSince: null, msSince: null })).toEqual({ change: "external" }); // never switched before
  });
  it("the external face never fades by itself", () => {
    expect(effectiveRestAfter(900, "external")).toBeNull();
    expect(effectiveRestAfter(900, "internal")).toBe(900);
    expect(effectiveRestAfter(null, "internal")).toBeNull();
  });
  it("tells the model when the face is locked", () => {
    expect(faceLine("internal", "auto")).toBe("internal");
    expect(faceLine("external", "external")).toBe("external, locked by the owner");
  });

  it("gestures: the owner's setting wins, the default follows the face, the internal face stays soft and has no growl", () => {
    expect(gesturesOn(null, "external")).toBe(true); expect(gesturesOn(null, "internal")).toBe(false);
    expect(gesturesOn(true, "internal")).toBe(true); expect(gesturesOn(false, "external")).toBe(false);
    expect(checkGesture({ type: "sigh", intensity: 0.8 }, "external", null)).toEqual({ play: true, intensity: 0.8 });
    expect(checkGesture({ type: "sigh", intensity: 0.8 }, "internal", null).play).toBe(false);
    expect(checkGesture({ type: "sigh", intensity: 0.8 }, "internal", true)).toMatchObject({ play: true, intensity: 0.5 });
    expect(checkGesture({ type: "growl", intensity: 0.3 }, "internal", true).play).toBe(false);
    expect(checkGesture({ type: "growl", intensity: 0.9 }, "external", null)).toEqual({ play: true, intensity: 0.9 });
    expect(checkGesture({ type: "purr", intensity: 0.5 }, "external", false).note).toMatch(/owner turned gestures off/);
  });
});
