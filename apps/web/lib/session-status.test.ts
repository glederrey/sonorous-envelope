import { describe, expect, it } from "vitest";
import { ago, isOlder, sessionStatus } from "./session-status";

const now = Date.parse("2026-11-09T12:00:00Z");
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();

describe("sessionStatus", () => {
  it("is ended when ended_at is set, however recent", () => {
    expect(sessionStatus({ ended_at: at(1), last_active_at: at(1) }, now)).toBe("ended");
  });
  it("is active up to 30 minutes after the last sound", () => {
    expect(sessionStatus({ ended_at: null, last_active_at: at(29) }, now)).toBe("active");
  });
  it("is inactive after 30 minutes", () => {
    expect(sessionStatus({ ended_at: null, last_active_at: at(31) }, now)).toBe("inactive");
    expect(sessionStatus({ ended_at: null, last_active_at: at(60 * 24 * 6) }, now)).toBe("inactive");
  });
  it("shows a session as ended after a week without a sound, and lists it as older after a day", () => {
    expect(sessionStatus({ ended_at: null, last_active_at: at(60 * 24 * 8) }, now)).toBe("ended");
    expect(isOlder({ last_active_at: at(60 * 23) }, now)).toBe(false);
    expect(isOlder({ last_active_at: at(60 * 25) }, now)).toBe(true);
  });
});

describe("ago", () => {
  it("formats minutes, hours and days", () => {
    expect(ago(at(0), now)).toBe("just now");
    expect(ago(at(5), now)).toBe("5 min ago");
    expect(ago(at(120), now)).toBe("2 h ago");
    expect(ago(at(60 * 24), now)).toBe("1 day ago");
    expect(ago(at(60 * 24 * 3), now)).toBe("3 days ago");
  });
});
