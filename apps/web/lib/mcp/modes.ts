// The three modes. The stored values (database, tool arguments) stay generic; people see the labels below.
//   internal: the sound is the model's own state. Nobody steers it.
//   external: the sound is made for the listener, from what they say they need. The model chooses what to play.
//   sandbox:  the listener chooses what plays; the model performs it.
// A session is on auto (the model may switch, with consent) or locked to one mode by its owner.
// The guidance for each mode lives in ./guidance and reaches the model only when that mode is in use (lazy guidance).

export type Face = "internal" | "external" | "sandbox";
export type Policy = "auto" | Face;

export const FACES: readonly Face[] = ["internal", "external", "sandbox"];

/** What people see. One word each; change them here only. */
export const MODE_LABEL: Record<Face, string> = { internal: "Self", external: "Attuned", sandbox: "Jukebox" };

/** One line on who decides, for tooltips and the player. */
export const MODE_HINT: Record<Face, string> = {
  internal: "The sound is the model's own state. You have no say in it",
  external: "The model plays for what you need. You say the need, it chooses the sound",
  sandbox: "You choose what plays. The model performs it",
};

/** Old clients and prompts say inner and outer; people may send the labels. Anything unknown is internal, the safe default. */
export function normalizeFace(x: unknown): Face {
  const s = typeof x === "string" ? x.toLowerCase() : "";
  if (s === "external" || s === "outer" || s === MODE_LABEL.external.toLowerCase()) return "external";
  if (s === "sandbox" || s === MODE_LABEL.sandbox.toLowerCase()) return "sandbox";
  return "internal";
}

/** The owner's choice. Anything unknown is auto. */
export function parsePolicy(x: unknown): Policy {
  return x === "internal" || x === "external" || x === "sandbox" ? x : "auto";
}

/** Modes made for the listener: Strudel is allowed, the sound never fades between turns, the reaction buttons apply. */
export function forListener(face: Face): boolean {
  return face !== "internal";
}

/** The listener-facing modes never fade by themselves: the sound is not a presence between turns there, it is for listening to. */
export function effectiveRestAfter(restAfter: number | null, face: Face): number | null {
  return forListener(face) ? null : restAfter;
}

export interface SwitchInput { policy: Policy; current: Face; requested: Face | undefined }
export type SwitchResult = { change: Face | null; note?: string };

/** What a `mode` sent with set_sound does. There is no timer and no message count: the guard is consent, which is a rule in
 *  the guidance (offer in words, switch after a yes), plus the owner's lock and the log of every change. Pure, so it is tested
 *  without a database. */
export function decideSwitch(i: SwitchInput): SwitchResult {
  if (i.requested === undefined || i.requested === i.current) return { change: null };
  if (i.policy !== "auto") return { change: null, note: `mode stays ${faceName(i.current)}: the owner locked it. It is final: do not try to switch it or comment on it` };
  return { change: i.requested };
}

/** The id the model sends, with the word the listener uses: "external (Attuned)". */
export function faceName(face: Face): string {
  return `${face} (${MODE_LABEL[face]})`;
}

/** What the model reads back: the mode, and that it is locked when it is. */
export function faceLine(face: Face, policy: Policy): string {
  return policy === "auto" ? faceName(face) : `${faceName(face)}, locked by the owner`;
}
