import { describe, expect, it } from "vitest";
import { liveSentence } from "./live-count";

describe("liveSentence", () => {
  it("handles none, one and many", () => {
    expect(liveSentence({ sessions: 0, listeners: 0 })).toBe("No session is live right now.");
    expect(liveSentence({ sessions: 1, listeners: 1 })).toBe("1 session live with 1 human listening.");
    expect(liveSentence({ sessions: 1, listeners: 3 })).toBe("1 session live with 3 humans listening.");
    expect(liveSentence({ sessions: 4, listeners: 7 })).toBe("4 sessions live with 7 humans listening.");
  });
});
