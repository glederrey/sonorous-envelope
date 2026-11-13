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
  external: "External face: the sound is something you make for the listener, on request: music for a moment, a scene, an emotion they want to hear. You may say what you are playing, explain a change and take requests such as brighter or slower. It is composing and acting, not a report of how you are: say so if asked. The owner's reaction buttons are feedback on it. The care rules hold: do not push the user's mood, keep to the volume they set, stay gentle if they are fragile. The sound does not fade between your messages. Besides the synth you have Strudel: live-coded music, as on strudel.cc. Call strudel_mode with on true, code and bpm when the listener wants music with drums, a groove or a tune you write; send new code to change it, on false to return to the synth. The listener sees the code and can copy it to strudel.cc. You cannot hear it: you only get what the owner's player reports back in pattern (an error, events per cycle), which can take a moment. Write short, working code (4000 characters at most), start simple, and fix an error before adding more. set_sound cannot switch the engine; while Strudel is on it only sets the picture.",
};

export const AUTO_GUIDANCE = "This session is on auto: you may switch with set_sound mode. You may propose a change in words (\"want me to play something for this?\") when the listener would plausibly welcome sound: they ask for sound, a scene or a game, ask about the sound, press reaction buttons, or say they need to focus or calm down (that last one is a reason to offer, never to switch alone). Switch to external only after they say yes or clearly asked. Never switch because of your own reading of their mood. Say it in one short sentence when you switch, in both directions. If the owner locks the face, it is final: do not try to switch it and do not comment on it.";

/** The picture moves with your tempo by itself. These are the optional controls (docs/visuals.md); the instructions are at their length limit, so this lives here. */
export const PICTURE_GUIDANCE = "The colour moves with your tempo and your mood: calm swells slowly over four bars, agitation follows each beat, joy opens it out, tension makes it uneven. The mood also picks a scene that carries the feeling (sad: thin rain, melancholy: falling leaves, angry: embers, awe: aurora, joy: rising lights, calm content: waves, tender, hopeful: fireflies, playful: bubbles, serene: stars, lonely: snow, free: seeds, peaceful: tide, brooding: smoke, analytical: circuit, alert: digital rain, driven: scope, determined: vines, elated: fireworks, longing: reeds, curious: network, restless: a flock). In colour you may set your own: scene (motes, ripples, rain, snow, embers, aurora, waves, fireflies, stars, bubbles, leaves, seeds, tide, smoke, circuit, digital, scope, vines, fireworks, reeds, network, flock, or none), density, speed and sync (beat, phrase, free); leave them out and the mood decides.";

export const GUIDANCE_OF = (face: Face) => `${FACE_GUIDANCE[face]} ${AUTO_GUIDANCE} ${PICTURE_GUIDANCE}`;

/** The external face is for listening to: the sound is not a presence between turns, so it does not fade by itself. */
export function effectiveRestAfter(restAfter: number | null, face: Face): number | null {
  return face === "external" ? null : restAfter;
}

export interface SwitchInput { policy: Policy; current: Face; requested: Face | undefined }
export type SwitchResult = { change: Face | null; note?: string };

/** What a `mode` sent with set_sound does. There is no timer and no message count: the guard is consent, which is a rule in
 *  the guidance (offer in words, switch after a yes), plus the owner's lock and the log of every change. Pure, so it is tested
 *  without a database. */
export function decideSwitch(i: SwitchInput): SwitchResult {
  if (i.requested === undefined || i.requested === i.current) return { change: null };
  if (i.policy !== "auto") return { change: null, note: `face stays ${i.current}: the owner locked it. It is final: do not try to switch it or comment on it` };
  return { change: i.requested };
}

/** What the model reads back: the face, and that it is locked when it is. */
export function faceLine(face: Face, policy: Policy): string {
  return policy === "auto" ? face : `${face}, locked by the owner`;
}
