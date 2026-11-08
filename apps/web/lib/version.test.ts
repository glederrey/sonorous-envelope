import { describe, expect, it } from "vitest";
import { sourceLinks } from "./version";

describe("sourceLinks", () => {
  it("points at the tag of a release", () => {
    const l = sourceLinks("v0.0.11");
    expect(l.source).toBe("https://github.com/glederrey/sonorous-envelope/tree/v0.0.11");
    expect(l.license).toContain("/blob/v0.0.11/LICENSE");
    expect(l.release).toContain("/releases/tag/v0.0.11");
  });
  it("points at the repository for a dev build", () => {
    const l = sourceLinks("dev");
    expect(l.source).toBe("https://github.com/glederrey/sonorous-envelope");
    expect(l.release).toBeNull();
  });
});
