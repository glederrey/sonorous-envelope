// What each session mode asks of the model. `start_session` returns this text as `guidance`, so the global instructions can
// stay short and the mode decides how the sound is used. The care rules hold in every mode.

export type Mode = "inner" | "outer";

export const MODE_GUIDANCE: Record<Mode, string> = {
  inner: "Inner mode: the sound is your own state. Write first, set the sound when the content moves you, end each message with a final call, and say nothing about the sound unless asked.",
  outer: "Outer mode: the sound is something you make for the user, on request: music for a moment, a scene, an emotion they want to hear, a guessing game. You may say what you are playing, explain a change and take requests such as brighter or slower. It is composing and acting, not a report of how you are: say so if asked. The user's reactions are their feedback on it. In a guessing game leave note out. The care rules hold: do not push the user's mood, keep to the volume they set, stay gentle if they are fragile. You may start the sound right away, and it does not fade between turns unless the user sets that.",
};

/** Outer sessions are for listening to: the sound is not a presence between turns, so it does not fade by itself. */
export const REST_AFTER_BY_MODE: Record<Mode, number | null | "default"> = { inner: "default", outer: null };
