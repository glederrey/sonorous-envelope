import { describe, expect, it } from "vitest";
import { planTurn } from "./turn";

const at = (ms: number) => new Date(ms).toISOString();

describe("planTurn", () => {
  it("starts turn 1 with no previous state", () => {
    const p = planTurn(null, false, 1000);
    expect(p).toMatchObject({ isNewTurn: true, stateTurn: 1, missedFinal: false });
  });
  it("starts a new turn after a final state", () => {
    const p = planTurn({ turn: 3, final: true, created_at: at(0) }, false, 5000);
    expect(p).toMatchObject({ isNewTurn: true, stateTurn: 4, missedFinal: false });
  });
  it("stays in the same turn after a recent non-final state", () => {
    const p = planTurn({ turn: 3, final: false, created_at: at(0) }, true, 10_000);
    expect(p).toMatchObject({ isNewTurn: false, stateTurn: 3, missedFinal: false });
  });
  it("treats a stale non-final state as a missed final and starts the next turn", () => {
    const p = planTurn({ turn: 3, final: false, created_at: at(0) }, false, 30_000);
    expect(p).toMatchObject({ isNewTurn: true, stateTurn: 4, missedFinal: true });
  });
  it("advances the session turn only on a final update", () => {
    expect(planTurn(null, true, 0).sessionTurn(0)).toBe(1);
    expect(planTurn(null, false, 0).sessionTurn(0)).toBe(0);
  });
});
