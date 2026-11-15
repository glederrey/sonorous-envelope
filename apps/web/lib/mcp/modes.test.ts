import { describe, expect, it } from "vitest";
import { decideSwitch, effectiveRestAfter, faceLine, faceName, forListener, MODE_ID, normalizeFace, parsePolicy } from "./modes";
import { guidanceUpdate, patternSceneMotion } from "./service";

const base = { policy: "auto" as const, current: "internal" as const, requested: "external" as const };

describe("modes", () => {
  it("reads old names and labels", () => {
    expect(normalizeFace("outer")).toBe("external");
    expect(normalizeFace("inner")).toBe("internal");
    expect(normalizeFace("self")).toBe("internal");
    expect(normalizeFace("Self")).toBe("internal");
    expect(normalizeFace("internal")).toBe("internal");
    expect(normalizeFace("external")).toBe("external");
    expect(normalizeFace("attuned")).toBe("external");
    expect(normalizeFace("jukebox")).toBe("sandbox");
    expect(normalizeFace("sandbox")).toBe("sandbox");
    expect(normalizeFace(undefined)).toBe("internal");
  });
  it("parses the owner's policy: a sandbox lock stays sandbox, junk is auto", () => {
    expect(parsePolicy("sandbox")).toBe("sandbox");
    expect(parsePolicy("external")).toBe("external");
    expect(parsePolicy("internal")).toBe("internal");
    expect(parsePolicy("auto")).toBe("auto");
    expect(parsePolicy("junk")).toBe("auto");
    expect(parsePolicy(undefined)).toBe("auto");
  });
  it("forListener is true for external and sandbox", () => {
    expect(forListener("internal")).toBe(false);
    expect(forListener("external")).toBe(true);
    expect(forListener("sandbox")).toBe(true);
  });
  it("does nothing when no mode is asked for, or the same one", () => {
    expect(decideSwitch({ ...base, requested: undefined })).toEqual({ change: null });
    expect(decideSwitch({ ...base, requested: "internal" })).toEqual({ change: null });
  });
  it("a lock is final, and says so", () => {
    for (const locked of ["internal", "external", "sandbox"] as const) {
      const requested = locked === "internal" ? "sandbox" : "internal";
      const r = decideSwitch({ policy: locked, current: locked, requested });
      expect(r.change).toBeNull();
      expect(r.note).toMatch(/locked/);
      expect(r.note).toContain(faceName(locked));
    }
  });
  it("on auto the model switches to and from sandbox at once", () => {
    expect(decideSwitch(base)).toEqual({ change: "external" });
    expect(decideSwitch({ ...base, current: "external", requested: "internal" })).toEqual({ change: "internal" });
    expect(decideSwitch({ ...base, requested: "sandbox" })).toEqual({ change: "sandbox" });
    expect(decideSwitch({ ...base, current: "sandbox", requested: "external" })).toEqual({ change: "external" });
  });
  it("the listener modes never fade by themselves", () => {
    expect(effectiveRestAfter(900, "external")).toBeNull();
    expect(effectiveRestAfter(900, "sandbox")).toBeNull();
    expect(effectiveRestAfter(900, "internal")).toBe(900);
    expect(effectiveRestAfter(null, "internal")).toBeNull();
  });
  it("tells the model the mode and when it is locked", () => {
    expect(faceLine("internal", "auto")).toBe("Self");
    expect(faceLine("external", "external")).toBe("Attuned, locked by the owner");
    expect(faceLine("sandbox", "sandbox")).toBe("Jukebox, locked by the owner");
  });
  it("names the modes with the labels only, and the ids the model sends round-trip", () => {
    expect(faceName("external")).toBe("Attuned");
    expect(faceName("sandbox")).toBe("Jukebox");
    expect(MODE_ID).toEqual({ internal: "self", external: "attuned", sandbox: "jukebox" });
    for (const f of ["internal", "external", "sandbox"] as const) expect(normalizeFace(MODE_ID[f])).toBe(f);
  });
});

describe("guidanceUpdate", () => {
  it("sends nothing when the model already has the rules of this mode", () => {
    expect(guidanceUpdate({ guided: "external", face: "external", switched: false })).toEqual({ send: false, ownerChanged: false, store: null });
    expect(guidanceUpdate({ guided: "internal", face: "internal", switched: true })).toEqual({ send: false, ownerChanged: false, store: null });
  });
  it("sends the new rules after the model's own switch, without the owner note", () => {
    expect(guidanceUpdate({ guided: "internal", face: "sandbox", switched: true })).toEqual({ send: true, ownerChanged: false, store: "sandbox" });
  });
  it("sends the rules and says the owner switched when no switch happened in this call", () => {
    expect(guidanceUpdate({ guided: "internal", face: "external", switched: false })).toEqual({ send: true, ownerChanged: true, store: "external" });
  });
  it("a session from before the migration records the mode and sends nothing", () => {
    expect(guidanceUpdate({ guided: null, face: "external", switched: false })).toEqual({ send: false, ownerChanged: false, store: "external" });
  });
});

describe("patternSceneMotion", () => {
  it("takes the speed of the picture from the tempo, clamped", () => {
    expect(patternSceneMotion(60)).toEqual({ speed: 0.2, density: 0.5 });
    expect(patternSceneMotion(30).speed).toBe(0.2);
    expect(patternSceneMotion(135).speed).toBeCloseTo(0.7);
    expect(patternSceneMotion(200).speed).toBe(0.9);
  });
});
