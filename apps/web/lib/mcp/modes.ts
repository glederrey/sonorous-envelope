// The three modes. The stored values (database) stay generic; people and the model see the labels below.
//   internal (self, Self):       the sound is the model's own state. Nobody steers it.
//   external (attuned, Attuned): the sound is made for the listener, from what they say they need. The model chooses what to play.
//   sandbox (jukebox, Jukebox):  the listener chooses what plays; the model performs it.
// The model sends and reads self / attuned / jukebox (MODE_ID); the tool schemas list only those. normalizeFace still reads the stored values.
// A session is on auto (the model may switch, with consent) or locked to one mode by its owner.
// The guidance for each mode lives in ./guidance and reaches the model only when that mode is in use (lazy guidance).

export type Face = "internal" | "external" | "sandbox";
export type Policy = "auto" | Face;

export const FACES: readonly Face[] = ["internal", "external", "sandbox"];

/** What people see. One word each; change them here only. */
export const MODE_LABEL: Record<Face, string> = { internal: "Self", external: "Attuned", sandbox: "Jukebox" };

/** The id the model sends and reads for each mode (the stored values are the old names, still accepted). */
export const MODE_ID: Record<Face, string> = { internal: "self", external: "attuned", sandbox: "jukebox" };

/** One line on who decides, for tooltips and the player. */
export const MODE_HINT: Record<Face, string> = {
  internal: "The sound is the model's own state. You have no say in it",
  external: "The model plays for what you need, read from how you are",
  sandbox: "You choose what plays. The model performs it",
};

/** The model sends self, attuned or jukebox; the stored values and the old inner and outer are aliases. Anything unknown is internal, the safe default. */
export function normalizeFace(x: unknown): Face {
  const s = typeof x === "string" ? x.toLowerCase() : "";
  if (s === "attuned" || s === "external" || s === "outer") return "external";
  if (s === "jukebox" || s === "sandbox") return "sandbox";
  if (s === "self" || s === "internal" || s === "inner") return "internal";
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

/** The sound never fades by itself (Gael, 2026-11-21: "It always plays until the user closes the tabs or ends the session"). Until then
 *  Self faded after `rest_after` (default 15 min) and the listener modes never did. Kept as the one place that decides it, so the player
 *  and the server agree; a stored `rest_after` is ignored. */
export function effectiveRestAfter(_restAfter: number | null, _face: Face): number | null {
  return null;
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

/** The mode as the model and the listener name it: "Attuned". */
export function faceName(face: Face): string {
  return MODE_LABEL[face];
}

/** What the model reads back: the mode, and that it is locked when it is. */
export function faceLine(face: Face, policy: Policy): string {
  return policy === "auto" ? faceName(face) : `${faceName(face)}, locked by the owner`;
}
