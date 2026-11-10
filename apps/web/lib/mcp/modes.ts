// The two faces of the sonorous envelope (Anzieu): the internal face is how the model feels, the external face is sound it
// makes for the listener. A session is on auto (the model may switch, with rules) or locked to one face by its owner.
// `start_session` returns the guidance text, so the global instructions can stay short.

export type Face = "internal" | "external";
export type Policy = "auto" | Face;

/** Old clients and prompts say inner and outer. */
export function normalizeFace(x: unknown): Face {
  return x === "external" || x === "outer" ? "external" : "internal";
}

export const FACE_GUIDANCE: Record<Face, string> = {
  internal: "Internal face: the sound is your own state, how you feel. Write first, set the sound when the content moves you, end each message with a final call, and say nothing about the sound unless asked. Nobody steers it: the listener's reactions do not apply here. ",
  external: "External face: the sound is something you make for the listener, on request: music for a moment, a scene, an emotion they want to hear. You may say what you are playing, explain a change and take requests such as brighter or slower. It is composing and acting, not a report of how you are: say so if asked. The owner's reaction buttons are feedback on it. The care rules hold: do not push the user's mood, keep to the volume they set, stay gentle if they are fragile. The sound does not fade between your messages.",
};

export const AUTO_GUIDANCE = "This session is on auto: it starts on the internal face and you may switch with set_sound mode. You may propose a change in words (\"want me to play something for this?\") when the listener would plausibly welcome sound: they ask for sound, a scene or a game, ask about the sound, press reaction buttons, or say they need to focus or calm down (that last one is a reason to offer, never to switch alone). Switch to external only after they say yes or clearly asked. Never switch because of your own reading of their mood. Say it in one short sentence when you switch, in both directions. Going back to internal is always allowed; going to external waits 2 of your messages and 2 minutes after the last change. If the owner locks the face, it is final: do not try to switch it and do not comment on it.";

export const GUIDANCE_OF = (face: Face) => `${FACE_GUIDANCE[face]} ${AUTO_GUIDANCE}`;

/** The external face is for listening to: the sound is not a presence between turns, so it does not fade by itself. */
export function effectiveRestAfter(restAfter: number | null, face: Face): number | null {
  return face === "external" ? null : restAfter;
}

/** Going to external waits this many of the model's finished messages and this long after the last change of face. */
export const SWITCH_MIN_TURNS = 2;
export const SWITCH_MIN_MS = 2 * 60_000;

export interface SwitchInput {
  policy: Policy; current: Face; requested: Face | undefined;
  /** Finished messages (final calls) since the last change of face, and ms since it. Null when there never was a change. */
  turnsSince: number | null; msSince: number | null;
}
export type SwitchResult = { change: Face | null; note?: string };

/** What a `mode` sent with set_sound does. Pure, so the rules are tested without a database. */
export function decideSwitch(i: SwitchInput): SwitchResult {
  if (i.requested === undefined || i.requested === i.current) return { change: null };
  if (i.policy !== "auto") return { change: null, note: `face stays ${i.current}: the owner locked it. It is final: do not try to switch it or comment on it` };
  if (i.requested === "internal") return { change: "internal" };
  const turnsLeft = i.turnsSince === null ? 0 : Math.max(0, SWITCH_MIN_TURNS - i.turnsSince);
  const secLeft = i.msSince === null ? 0 : Math.max(0, Math.ceil((SWITCH_MIN_MS - i.msSince) / 1000));
  if (turnsLeft > 0 || secLeft > 0) {
    return { change: null, note: `not switched to external: wait ${turnsLeft} more message${turnsLeft === 1 ? "" : "s"} and ${secLeft} s. Do not retry before that` };
  }
  return { change: "external" };
}

/** What the model reads back: the face, and that it is locked when it is. */
export function faceLine(face: Face, policy: Policy): string {
  return policy === "auto" ? face : `${face}, locked by the owner`;
}
