import { describe, expect, it } from "vitest";
import { decideSwitch, effectiveRestAfter, faceLine, normalizeFace } from "./modes";

const base = { policy: "auto" as const, current: "internal" as const, requested: "external" as const };

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
  it("on auto the model switches either way at once: no timer, no message count (consent is a rule in the guidance)", () => {
    expect(decideSwitch(base)).toEqual({ change: "external" });
    expect(decideSwitch({ ...base, current: "external", requested: "internal" })).toEqual({ change: "internal" });
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
});
