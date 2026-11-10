export interface PrevState { turn: number; final: boolean; created_at: string }

/** A new turn starts when the previous state was final, or was a non-final one more than 3 minutes old (a message can take a while, and one message is one turn). */
export const STALE_MS = 180_000;

export function planTurn(prev: PrevState | null, final: boolean, now: number) {
  const age = prev ? now - new Date(prev.created_at).getTime() : Infinity;
  const isNewTurn = !prev || prev.final || age > STALE_MS;
  const stateTurn = isNewTurn ? (prev?.turn ?? 0) + 1 : prev!.turn;
  return {
    isNewTurn,
    stateTurn,
    /** `sessions.turn` is the number of the last final turn. */
    sessionTurn: (current: number) => (final ? stateTurn : current),
    missedFinal: Boolean(prev && !prev.final && isNewTurn),
  };
}

export const MIN_GAP_MS = 300;
export const MAX_PER_MINUTE = 20;
