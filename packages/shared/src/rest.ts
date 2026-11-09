/** Has the sound faded for lack of an update? `restAfter` null means the owner turned the fade off. */
export function isResting(stateCreatedAt: string | number, restAfter: number | null, now: number): boolean {
  if (restAfter === null) return false;
  return now - new Date(stateCreatedAt).getTime() > restAfter * 1000;
}

/** "5 min" style text for the note the model gets. */
export function restingNote(restAfter: number): string {
  const min = Math.round(restAfter / 60);
  return `the sound faded after ${min} min without an update from you`;
}
