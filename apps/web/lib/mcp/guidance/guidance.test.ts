import { describe, expect, it } from "vitest";
import { MODE_LABEL, FACES } from "../modes";
import { MODE_GUIDANCE, modeGuidance, startGuidance } from "./index";
import { AUTO_GUIDANCE, LOCKED_GUIDANCE } from "./auto";
import { PICTURE_GUIDANCE } from "./picture";
import { STRUDEL_GUIDANCE } from "./strudel";

describe("mode guidance", () => {
  it("internal has no Strudel rules; external and sandbox include it", () => {
    expect(modeGuidance("internal", "auto")).not.toContain(STRUDEL_GUIDANCE); // it only says that no Strudel plays here
    expect(modeGuidance("external", "auto")).toContain(STRUDEL_GUIDANCE);
    expect(modeGuidance("sandbox", "auto")).toContain(STRUDEL_GUIDANCE);
  });
  it("auto and locked texts differ", () => {
    for (const face of FACES) {
      expect(modeGuidance(face, "auto")).toContain(AUTO_GUIDANCE);
      expect(modeGuidance(face, "auto")).not.toContain(LOCKED_GUIDANCE);
      expect(modeGuidance(face, face)).toContain(LOCKED_GUIDANCE);
      expect(modeGuidance(face, face)).not.toContain(AUTO_GUIDANCE);
    }
  });
  it("every guidance names its mode and its label", () => {
    for (const face of FACES) {
      expect(MODE_GUIDANCE[face]).toContain(MODE_LABEL[face]);
      expect(modeGuidance(face, "auto")).toContain(`Mode ${MODE_LABEL[face]}`);
    }
  });
  it("speaks only the listener's names to the model", () => {
    for (const face of FACES) for (const policy of ["auto", face] as const)
      expect(startGuidance(face, policy)).not.toMatch(/\b(internal|external|sandbox)\b/);
  });
  it("Self lets unease show, softly; Attuned never starts faster than what plays", () => {
    expect(MODE_GUIDANCE.internal).toContain("Your reaction may show");
    expect(MODE_GUIDANCE.external).toContain("never faster, louder or tenser than what is playing now");
  });
  it("sandbox lifts the never-ask rule", () => {
    expect(MODE_GUIDANCE.sandbox).toContain("ask what they want");
  });
  it("start guidance adds the picture controls", () => {
    expect(startGuidance("internal", "auto")).toContain(PICTURE_GUIDANCE);
    expect(modeGuidance("internal", "auto")).not.toContain(PICTURE_GUIDANCE);
  });
});
