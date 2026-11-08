import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths with a query", () => {
    expect(safeNext("/oauth/consent?authorization_id=abc")).toBe("/oauth/consent?authorization_id=abc");
    expect(safeNext("/s/xyz")).toBe("/s/xyz");
  });

  it("falls back on empty values", () => {
    expect(safeNext(null)).toBe("/sessions");
    expect(safeNext("")).toBe("/sessions");
    expect(safeNext(undefined, "/")).toBe("/");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.example")).toBe("/sessions");
    expect(safeNext("//evil.example")).toBe("/sessions");
    expect(safeNext("/\\evil.example")).toBe("/sessions");
    expect(safeNext("javascript:alert(1)")).toBe("/sessions");
  });

  it("rejects control characters", () => {
    expect(safeNext("/ok\r\nLocation: https://evil.example")).toBe("/sessions");
  });
});
