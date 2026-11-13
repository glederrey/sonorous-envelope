import { clone } from "./util";
import { mulberry32, neutralState, noteToMidi, type EngineState, type ResolvedColour, type ScaleName, type Wave } from "@sonorous/engine";
import type { Colour, Mood, SynthOverride, Voice } from "./schemas";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pick = <T>(list: readonly T[], t: number) => list[Math.min(list.length - 1, Math.floor(t * list.length))];

/** All tuning constants in one place. Calibrate by ear (docs/roadmap.md). */
export const TUNING = {
  rootMidi: 50,
  slowFraction: 0.25,
  scalesByJoy: ["phrygian", "harmonic_minor", "minor", "dorian", "mixolydian", "major", "lydian"] as ScaleName[],
};

/** Instances send cautious values (0.4 to 0.7). Stretch the middle before mapping: 0.4 becomes 0.34, 0.7 becomes 0.82. */
export const stretch = (x: number) => clamp(0.5 + 1.6 * (x - 0.5));
export const stretchMood = (m: Mood): Mood => ({
  warmth: stretch(m.warmth), closeness: stretch(m.closeness), joy: stretch(m.joy), calm: stretch(m.calm), spontaneity: stretch(m.spontaneity),
  ...(m.tension === undefined ? {} : { tension: m.tension }), // not stretched: it is an explicit control, 0 means none
});

/** The per-session seed behind the fallback voice and the `as_played` order: fixed for the session id. */
export function voiceSeedOf(sessionId: string): number {
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) { h ^= sessionId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type ChordShape = "closed" | "open" | "ninth" | "suspended";

/** What an instance sounds like when it chose no voice: drawn from the voice seed, so two instances sending the same axes differ. */
export interface Character { rootOffset: number; shape: ChordShape; octaveDelta: number }
export function characterFor(seed: number): Character {
  const r = mulberry32(seed ^ 0x5eed);
  return {
    rootOffset: Math.floor(r() * 7) - 3,
    shape: pick(["closed", "open", "ninth", "suspended"] as const, r()),
    octaveDelta: Math.floor(r() * 3) - 1,
  };
}

/** Spread a chord: the second note moves up an octave ([1,3,5,7] becomes [1,5,7,10]). */
export function openVoicing(degrees: number[]): number[] {
  if (degrees.length < 3) return degrees;
  const out = [...degrees]; out[1] += 7;
  return out.sort((a, b) => a - b);
}

const permute = <T>(list: T[], seed: number): T[] => {
  const r = mulberry32(seed ^ 0xa5ed), out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** A voice is a partial synth override: root, scale, chord, note order, octaves, wave. It replaces the mapped fields. */
export function voiceToSynth(v: Voice | null | undefined): SynthOverride | undefined {
  if (!v) return undefined;
  const arp: NonNullable<SynthOverride["arp"]> = {};
  if (v.root) arp.root = v.root;
  if (v.scale) arp.scale = v.scale;
  if (v.chord) arp.chord = v.chord;
  if (v.pattern) arp.pattern = v.pattern;
  if (v.octaves !== undefined) arp.octaves = v.octaves;
  const out: SynthOverride = {};
  if (Object.keys(arp).length) out.arp = arp;
  if (v.wave) out.osc = { wave: v.wave };
  return Object.keys(out).length ? out : undefined;
}

/** The bass and the drone sit in the voice's own key and scale, so the harmony under the arpeggio agrees with it (a minor voice over a major bass would read neither). */
export function alignToVoice(state: EngineState, v: Voice | null | undefined): EngineState {
  if (!v || (!v.root && !v.scale)) return state;
  const s: EngineState = JSON.parse(JSON.stringify(state));
  const root = v.root ? noteToMidi(v.root) : undefined;
  if (v.scale) { s.bass.scale = v.scale; s.bass.chord = [1, 3, 5]; }
  if (root !== undefined) {
    s.bass.root = root - 12;
    s.drone.notes = s.drone.notes.length === 2 && s.drone.notes[1] - s.drone.notes[0] === 3 ? [root - 12, root - 9] : [root - 12, root - 5];
  }
  return s;
}

/** The master volume is a constant: loudness belongs to the listener's slider, never to Claude or the mood. */
export const MASTER_VOLUME = 0.5;

export const NEUTRAL_MOOD: Mood = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.8, spontaneity: 0.2 };

export interface Harmony { scale: ScaleName; degrees: number[] }

/** Chord quality from joy, calm and warmth (docs/implementation/mood-mapping.md). The first matching row wins. */
export function harmonyFor(m: Mood, withSuspension = false): Harmony {
  const { warmth: w, joy: j, calm: k, spontaneity: s } = m;
  let h: Harmony;
  if (j >= 0.55 && k >= 0.5) h = { scale: w > 0.5 ? "major" : "dorian", degrees: [1, 3, 5, 7] };
  else if (j >= 0.55) h = { scale: "major", degrees: j > 0.8 ? [1, 3, 5, 9] : [1, 3, 5] };
  else if (j >= 0.4 && k < 0.4) h = { scale: "mixolydian", degrees: [1, 3, 5, 7] };
  else if (j < 0.4 && k >= 0.5) h = { scale: "minor", degrees: [1, 3, 5] };
  else if (j < 0.4 && k < 0.5) h = { scale: "locrian", degrees: [1, 3, 5] };
  else h = { scale: pick(TUNING.scalesByJoy, j), degrees: j < 0.25 ? [1, 3, 5] : j < 0.6 ? [1, 3, 5, 7] : [1, 3, 5, 9] };
  if (withSuspension && s > 0.7) h = { ...h, degrees: [...h.degrees, 4].sort((a, b) => a - b) };
  return h;
}

const rootFor = (m: Mood) => TUNING.rootMidi + Math.round(lerp(-5, 7, 0.6 * m.joy + 0.4 * (1 - m.closeness)));

/** Take the chord degrees in order, continuing past the top, until there are `n` of them (never fewer than the chord). */
function expandDegrees(base: number[], n: number): number[] {
  const out = [...base];
  while (out.length < n) out.push(base[out.length % base.length] + 7 * Math.floor(out.length / base.length));
  return out;
}

/** Slow mood after an update: starts at the first mood, then moves a fraction towards each final mood. */
export function nextSlowMood(prev: Mood | null | undefined, mood: Mood, final: boolean): Mood {
  if (!prev) return { ...mood };
  if (!final) return { ...prev };
  const f = TUNING.slowFraction;
  return {
    warmth: lerp(prev.warmth, mood.warmth, f), closeness: lerp(prev.closeness, mood.closeness, f),
    joy: lerp(prev.joy, mood.joy, f), calm: lerp(prev.calm, mood.calm, f),
    spontaneity: lerp(prev.spontaneity, mood.spontaneity, f),
  };
}

const ramp = (x: number, lo: number, hi: number) => clamp((x - lo) / (hi - lo));

/** The scene the mood suggests when the model sets none (visuals.md, "Emotions in the picture"): the emotion regions of the five axes and
 *  tension, each with the scene that carries it. Fuzzy, so neighbouring moods get neighbouring pictures; the strongest region wins, and a
 *  mood that fits none well (the middle of every axis) gets no scene. The form of each scene then follows the same axes (`feel`). */
export function moodToScene(m: Mood): { scene: NonNullable<ResolvedColour["scene"]>; density: number; speed: number } | null {
  const { warmth: w, closeness: c, joy: j, calm: k, spontaneity: s2 } = m, t = clamp(m.tension ?? 0);
  const lowJoy = 1 - ramp(j, 0.2, 0.45), calm = ramp(k, 0.35, 0.65), notTense = 1 - ramp(t, 0.3, 0.6);
  const anger = ramp(t, 0.35, 0.65) * (1 - ramp(j, 0.45, 0.7)) * (1 - ramp(k, 0.5, 0.75));
  const score: Array<[NonNullable<ResolvedColour["scene"]>, number]> = [
    ["snow", lowJoy * ramp(k, 0.6, 0.85) * (1 - ramp(w, 0.35, 0.55)) * (1 - ramp(c, 0.2, 0.4)) * notTense], // lonely hush: cold, distant, very calm
    ["rain", Math.max(lowJoy * calm * (1 - ramp(t, 0.15, 0.3)) * (1 - ramp(w, 0.5, 0.75)),            // sad: cold, low, quiet, a thin rain
                      anger * (1 - ramp(w, 0.1, 0.3)))],                               // icy anger: a storm
    ["embers", anger * ramp(w, 0.05, 0.25)],                                           // anger: sparks that jerk and flicker
    ["fireflies", ramp(w, 0.55, 0.8) * ramp(c, 0.55, 0.8) * ramp(j, 0.25, 0.5) * ramp(k, 0.4, 0.7) * notTense * (1 - ramp(j, 0.7, 0.9))], // tender: soft lights that glow on and off
    ["leaves", ramp(j, 0.05, 0.2) * (1 - ramp(j, 0.4, 0.6)) * ramp(w, 0.55, 0.75) * ramp(k, 0.25, 0.45) * ramp(c, 0.35, 0.55) * notTense], // wistful and melancholic: warm, low joy
    ["stars", ramp(w, 0.2, 0.4) * ramp(j, 0.3, 0.5) * (1 - ramp(j, 0.55, 0.75)) * ramp(k, 0.7, 0.9) * (1 - ramp(c, 0.3, 0.5)) * notTense], // serene, far: an open night
    ["fireworks", ramp(j, 0.8, 0.95) * (1 - ramp(k, 0.1, 0.3)) * notTense],                                      // elation: bursts of light
    ["smoke", (1 - ramp(j, 0.3, 0.5)) * ramp(k, 0.45, 0.7) * ramp(t, 0.2, 0.4) * (1 - ramp(t, 0.5, 0.7))],      // brooding, uneasy: wisps that rise and curl
    ["circuit", (1 - ramp(w, 0.25, 0.45)) * (1 - ramp(s2, 0.3, 0.5)) * ramp(j, 0.35, 0.5) * (1 - ramp(j, 0.6, 0.75)) * ramp(k, 0.4, 0.6) * (1 - ramp(k, 0.8, 0.95)) * notTense], // focused, exact: traces and stepped pulses
    ["digital", (1 - ramp(w, 0.25, 0.45)) * ramp(t, 0.3, 0.5) * (1 - ramp(t, 0.65, 0.85)) * ramp(j, 0.3, 0.5) * (1 - ramp(j, 0.65, 0.8)) * (1 - ramp(k, 0.55, 0.8))], // alert, processing: falling blocks
    ["scope", (1 - ramp(w, 0.25, 0.45)) * ramp(j, 0.5, 0.7) * (1 - ramp(k, 0.5, 0.75)) * (1 - ramp(s2, 0.5, 0.7)) * notTense], // driven, focused: the sound drawn on a scope
    ["vines", ramp(j, 0.4, 0.55) * (1 - ramp(j, 0.65, 0.8)) * ramp(k, 0.35, 0.5) * (1 - ramp(k, 0.6, 0.75)) * ramp(t, 0.25, 0.4) * (1 - ramp(t, 0.55, 0.7)) * (1 - ramp(s2, 0.4, 0.6))], // determined: growth
    ["reeds", ramp(w, 0.5, 0.7) * (1 - ramp(c, 0.3, 0.5)) * ramp(j, 0.1, 0.25) * (1 - ramp(j, 0.5, 0.65)) * ramp(k, 0.3, 0.6) * notTense], // longing: warm, far, bending in the wind
    ["network", ramp(w, 0.25, 0.4) * (1 - ramp(w, 0.55, 0.75)) * ramp(c, 0.45, 0.65) * ramp(j, 0.4, 0.55) * (1 - ramp(j, 0.65, 0.8)) * ramp(k, 0.35, 0.5) * (1 - ramp(k, 0.65, 0.8)) * ramp(s2, 0.25, 0.4) * (1 - ramp(s2, 0.6, 0.8)) * notTense], // curious, thinking: nodes that link up
    ["flock", ramp(s2, 0.8, 1) * ramp(k, 0.3, 0.55) * (1 - ramp(k, 0.65, 0.85)) * (1 - ramp(t, 0.2, 0.45)) * ramp(j, 0.2, 0.4) * (1 - ramp(j, 0.6, 0.8))], // swept up, restless: a flock
    ["bubbles", ramp(j, 0.6, 0.8) * ramp(s2, 0.65, 0.9) * (1 - ramp(k, 0.7, 0.9)) * (1 - ramp(t, 0.4, 0.7))], // playful: rings that rise
    ["ripples", ramp(t, 0.3, 0.55) * ramp(j, 0.35, 0.55) * (1 - ramp(k, 0.5, 0.8))],   // nervous: rings that scatter
    ["motes", ramp(j, 0.55, 0.8) * (1 - ramp(k, 0.45, 0.65)) * (1 - ramp(t, 0.4, 0.7))], // happy: bright lights that rise
    ["lanterns", ramp(w, 0.5, 0.75) * ramp(j, 0.5, 0.7) * (1 - ramp(j, 0.85, 1)) * ramp(k, 0.45, 0.7) * (1 - ramp(c, 0.7, 0.95)) * notTense], // hope: warm lights that rise
    ["seeds", ramp(j, 0.55, 0.75) * ramp(k, 0.4, 0.65) * (1 - ramp(k, 0.85, 1)) * ramp(s2, 0.3, 0.5) * (1 - ramp(s2, 0.7, 0.9)) * (1 - ramp(c, 0.5, 0.75)) * notTense], // light and free: seeds on the air
    ["tide", ramp(k, 0.7, 0.9) * ramp(j, 0.4, 0.55) * (1 - ramp(j, 0.6, 0.75)) * ramp(c, 0.4, 0.6) * notTense], // peaceful, accepting: a line of foam
    ["aurora", ramp(j, 0.55, 0.8) * ramp(k, 0.65, 0.9) * (1 - ramp(c, 0.35, 0.6)) * notTense], // awe: open, high and slow
    ["waves", ramp(j, 0.6, 0.8) * ramp(k, 0.65, 0.9) * ramp(c, 0.3, 0.55) * notTense], // content, relief: an even swell
  ];
  let best = score[0];
  for (const x of score) if (x[1] > best[1]) best = x;
  if (best[1] < 0.3) return null;
  // Coarse steps: a scene's motion is a rate times the beat count, so a small drift of the mood between two messages must not move every item.
  const q = (x: number) => clamp(Math.round(x * 4) / 4, 0.25, 0.9);
  return { scene: best[0], density: q(0.2 + 0.55 * best[1]), speed: q(lerp(0.8, 0.12, k) + 0.15 * t) };
}

export function moodToColour(m: Mood, cutoff: number, lfo1Rate: number): ResolvedColour {
  const { warmth: w, joy: j, calm: k, spontaneity: s } = m;
  const cutNorm = clamp((Math.log2(cutoff) - Math.log2(400)) / (Math.log2(6000) - Math.log2(400)));
  // The follow-mode hue walks the whole wheel (blue, cyan, green, yellow, orange, red, magenta) so that moods that sound
  // different also look different. It is only a default: Claude can send any hue.
  const t = 0.45 * w + 0.3 * j + 0.25 * (1 - k);
  const h0 = (((250 - 300 * t) % 360) + 360) % 360;
  // anger is red whatever the rest says: tension with no joy and no calm pulls the hue round the short way to red
  const anger = clamp(((m.tension ?? 0) - 0.35) / 0.3) * (1 - clamp((j - 0.45) / 0.25)) * (1 - clamp((k - 0.5) / 0.25));
  const h = (360 + h0 + ((((356 - h0) % 360) + 540) % 360 - 180) * anger) % 360;
  const sat = Math.min(0.85, lerp(0.15, 0.6, 0.5 * j + 0.5 * (1 - k)) * lerp(0.6, 1, j) + 0.35 * anger);
  const l = Math.min(0.6, lerp(0.12, 0.45, 0.6 * j + 0.4 * cutNorm));
  // Motion is safe at any tempo now (visual.ts), so every mood moves: calm breathes over the phrase, the middle drifts, the agitated pulses on the beat.
  // "still" is only for a model that asks for it.
  const motion = k > 0.7 ? "breathe" : k > 0.45 ? "drift" : "pulse";
  // close and warm is a tight glow; the rest keeps the linear wash it always had
  const shape = m.closeness > 0.7 && w > 0.5 ? "glow" : "wash";
  const pick = moodToScene(m);
  return {
    h, s: sat, l,
    secondary: { h: (h + 25) % 360, s: sat, l: Math.max(0, l - 0.08) },
    motion, shape,
    texture: w < 0.3 ? "grain" : s > 0.6 ? "soft_noise" : "flat",
    pulseHz: motion === "pulse" ? Math.min(lfo1Rate, 1) : 0,
    ...(pick ? { ...pick, sceneAuto: true } : {}),
    feel: moodToFeel(m),
  };
}

/** How the mood shapes the motion of the picture (visuals.md). Starting values, tuned by eye, and the same stretched axes the sound uses:
 *  calm sets how hard the picture follows the beat, joy expands and lifts or contracts and sinks it, tension makes it irregular,
 *  warmth softens it, closeness makes it near and large, spontaneity makes its timing uneven. */
export function moodToFeel(m: Mood): NonNullable<ResolvedColour["feel"]> {
  const tension = m.tension ?? 0;
  return {
    depth: clamp(lerp(1, 0.25, m.calm)), lift: clamp(m.joy), jitter: clamp(tension),
    soft: clamp(m.warmth), near: clamp(m.closeness), irreg: clamp(m.spontaneity),
  };
}

/** Axes to a full engine state. `slow` is the slow mood for the background layer (defaults to the mood itself).
 *  `voiceSeed` (from the session id) gives the instance a character when it chose no voice; without it the mapping is purely the axes. */
export function moodToEngineState(m: Mood, slow: Mood = m, voiceSeed?: number): EngineState {
  const { warmth: w, closeness: c, joy: j, calm: k, spontaneity: s } = m;
  const tn = clamp(m.tension ?? 0);
  const base = neutralState();

  // harmony
  const harmony = harmonyFor(m, true);
  const ch = voiceSeed === undefined ? null : characterFor(voiceSeed);
  const root = rootFor(m) + (ch?.rootOffset ?? 0);
  // closeness spreads the chord; the character may add a shape of its own
  let degrees = harmony.degrees;
  if (m.closeness < 0.4 || ch?.shape === "open") degrees = openVoicing(degrees);
  if (ch?.shape === "ninth" && !degrees.includes(9)) degrees = [...degrees, 9].sort((a, b) => a - b);
  if (ch?.shape === "suspended" && !degrees.includes(4)) degrees = [...degrees, 4].sort((a, b) => a - b);
  const tempo = lerp(150, 56, k) * lerp(0.9, 1.1, j);
  const notes = 3 + Math.round(3 * (1 - k));
  const pattern: EngineState["arp"]["pattern"] = s <= 0.4 ? (j >= 0.6 ? "up" : j <= 0.4 ? "down" : "up_down") : s <= 0.6 ? "as_played" : "random";
  const rate = k > 0.75 ? "1/4" : k > 0.45 ? (s > 0.6 ? "1/8t" : "1/8") : "1/16";
  const drive = 0.8 * (Math.max(0, 0.6 - j) / 0.6) * (Math.max(0, 0.6 - k) / 0.6) * (Math.max(0, 0.9 - w) / 0.9);
  const cutoff = Math.pow(2, lerp(Math.log2(400), Math.log2(6000), 0.5 * (1 - w) + 0.35 * j + 0.15 * (1 - k)));
  const wave: Wave = w > 0.66 ? "sine" : w > 0.4 ? "triangle" : w > 0.2 ? "sawtooth" : "square";

  // LFOs
  const lfo: EngineState["lfo"] = [{
    target: "cutoff", rate: lerp(0.3, 0.1, k), depth: lerp(0.15, 0.5, s), shape: s > 0.75 ? "random" : "sine",
  }];
  if (k < 0.4) lfo.push({ target: "amp", rate: lerp(6, 3, k / 0.4), depth: 0.15 + 0.2 * (1 - k), shape: "sine" });
  else if (w > 0.7) lfo.push({ target: "pitch", rate: lerp(4, 6.5, 1 - k), depth: lerp(0.1, 0.2, 1 - k), shape: "sine" });

  // background (bass) layer from the slow mood
  const sh = harmonyFor(slow);
  const bassRoot = rootFor(slow) - 12;

  const delayTime = Math.min(0.75, (60 / tempo) * 0.75);
  const stepMs = (60 / tempo) * ({ "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 } as Record<string, number>)[rate] * 1000;
  const state: EngineState = {
    ...base,
    arp: {
      on: true,
      root, scale: harmony.scale,
      // as_played keeps the order we give it: shuffle once from the voice seed so it does not simply climb
      chord: ((c) => (pattern === "as_played" && voiceSeed !== undefined ? permute(c, voiceSeed) : c))(expandDegrees(degrees, Math.max(notes, degrees.length))),
      pattern,
      octaves: clamp(1 + Math.round(3 * (1 - c) * (0.5 + 0.5 * s)) + (ch?.octaveDelta ?? 0), 1, 4),
      tempo, rate,
      gate: lerp(0.3, 0.95, 0.6 * k + 0.4 * w),
      swing: 0.4 * s,
      density: clamp(lerp(1, 0.6, s) * lerp(0.75, 1, 1 - k), 0.35, 1),
      // timing looseness is a share of the step, not a fixed 25 ms: on a slow sound (one note a second) 25 ms is inaudible and
      // spontaneity read 0.03 whatever was sent (round 6); on a fast one the old value is about what this gives
      jitterMs: Math.min(150, lerp(0, 0.18 * stepMs, s) + 5 * (1 - j) * k),
    },
    // tension (optional, 0 = none = the sound without it): clashing intervals on every note, a wider detune, some grit
    osc: {
      wave, voices: tn > 0.3 ? Math.max(2, w > 0.5 ? 2 : 1) : w > 0.5 ? 2 : 1, detune: Math.min(50, lerp(2, 14, w) + 10 * drive + 24 * tn),
      drive: Math.min(1, drive + 0.4 * tn), stack: tn > 0.7 ? [1, 6, 11] : tn > 0.5 ? [6, 11] : tn > 0.3 ? [6] : tn > 0.12 ? [10] : [],
    },
    filter: { type: "lowpass", cutoff, resonance: Math.min(20, lerp(0.7, 6, (1 - w) * (1 - k)) + 4 * tn) },
    lfo,
    env: {
      attack: lerp(0.005, 0.3, k * (0.6 + 0.4 * w)),
      decay: lerp(0.5, 0.15, j),
      sustain: lerp(0.2, 0.65, 0.5 * w + 0.5 * k),
      release: Math.min(2, lerp(0.1, 1.5, k) * lerp(1, 1.3, 1 - j)),
    },
    drone: {
      on: k > 0.5 || j < 0.3,
      notes: j < 0.3 ? [root - 12, root - 9] : [root - 12, root - 5],
      wave: w > 0.5 ? "sine" : "triangle",
      level: lerp(0.1, 0.3, k),
    },
    bass: {
      on: true, root: bassRoot, scale: sh.scale, chord: sh.degrees,
      stepSeconds: lerp(1, 2, slow.calm), wave: slow.warmth > 0.5 ? "sine" : "triangle",
      level: lerp(0.1, 0.25, slow.calm),
    },
    fx: {
      delay: { time: delayTime, feedback: Math.min(0.6, lerp(0.45, 0.15, c)), mix: lerp(0.35, 0.1, c) * (0.5 + 0.5 * k) },
      reverb: { size: lerp(0.9, 0.5, c), mix: lerp(0.5, 0.12, c) },
    },
    pan: { width: lerp(1, 0.3, c) },
    volume: MASTER_VOLUME,
    transition: { time: 4, curve: "smooth" },
  };
  state.colour = moodToColour(m, cutoff, lfo[0].rate);
  return state;
}

/** Deep-merge the model's synth override over the mapped state. Returns the new state and the overridden field paths. */
export function applyOverride(mapped: EngineState, synth: SynthOverride | undefined): { state: EngineState; overridden: string[] } {
  if (!synth) return { state: mapped, overridden: [] };
  const s: EngineState = clone(mapped);
  const overridden: string[] = [];
  const set = (path: string, assign: () => void) => { assign(); overridden.push(path); };

  const a = synth.arp;
  if (a) {
    if (a.on !== undefined) set("arp.on", () => { s.arp.on = a.on!; });
    if (a.root !== undefined) { const m = noteToMidi(a.root); if (m !== undefined) set("arp.root", () => { s.arp.root = m; }); }
    if (a.scale) set("arp.scale", () => { s.arp.scale = a.scale!; });
    if (a.chord) set("arp.chord", () => { s.arp.chord = a.chord!; });
    if (a.pattern) set("arp.pattern", () => { s.arp.pattern = a.pattern!; });
    if (a.octaves !== undefined) set("arp.octaves", () => { s.arp.octaves = a.octaves!; });
    if (a.tempo !== undefined) set("arp.tempo", () => { s.arp.tempo = a.tempo!; });
    if (a.rate) set("arp.rate", () => { s.arp.rate = a.rate!; });
    if (a.gate !== undefined) set("arp.gate", () => { s.arp.gate = a.gate!; });
    if (a.swing !== undefined) set("arp.swing", () => { s.arp.swing = a.swing!; });
    if (a.density !== undefined) set("arp.density", () => { s.arp.density = a.density!; });
  }
  const o = synth.osc;
  if (o) {
    if (o.wave) set("osc.wave", () => { s.osc.wave = o.wave!; });
    if (o.detune !== undefined) set("osc.detune", () => { s.osc.detune = o.detune!; });
    if (o.voices !== undefined) set("osc.voices", () => { s.osc.voices = o.voices!; });
    if (o.stack) set("osc.stack", () => { s.osc.stack = [...o.stack!]; });
  }
  const f = synth.filter;
  if (f) {
    if (f.type) set("filter.type", () => { s.filter.type = f.type!; });
    if (f.cutoff !== undefined) set("filter.cutoff", () => { s.filter.cutoff = f.cutoff!; });
    if (f.resonance !== undefined) set("filter.resonance", () => { s.filter.resonance = f.resonance!; });
  }
  if (synth.lfo) set("lfo", () => { s.lfo = synth.lfo!.map((l) => ({ ...l })); });
  const e = synth.env;
  if (e) {
    if (e.attack !== undefined) set("env.attack", () => { s.env.attack = e.attack!; });
    if (e.decay !== undefined) set("env.decay", () => { s.env.decay = e.decay!; });
    if (e.sustain !== undefined) set("env.sustain", () => { s.env.sustain = e.sustain!; });
    if (e.release !== undefined) set("env.release", () => { s.env.release = e.release!; });
  }
  const d = synth.drone;
  if (d) {
    if (d.on !== undefined) set("drone.on", () => { s.drone.on = d.on!; });
    if (d.notes) {
      const midi = d.notes.map(noteToMidi).filter((x): x is number => x !== undefined);
      set("drone.notes", () => { s.drone.notes = midi; });
    }
    if (d.wave) set("drone.wave", () => { s.drone.wave = d.wave!; });
    if (d.level !== undefined) set("drone.level", () => { s.drone.level = d.level!; });
  }
  const pd = synth.pad;
  if (pd) {
    if (pd.on !== undefined) set("pad.on", () => { s.pad.on = pd.on!; });
    if (pd.notes) {
      const midi = pd.notes.map(noteToMidi).filter((x): x is number => x !== undefined);
      set("pad.notes", () => { s.pad.notes = midi; if (midi.length && pd.on === undefined) s.pad.on = true; });
    }
    if (pd.wave) set("pad.wave", () => { s.pad.wave = pd.wave!; });
    if (pd.level !== undefined) set("pad.level", () => { s.pad.level = pd.level!; });
    if (pd.attack !== undefined) set("pad.attack", () => { s.pad.attack = pd.attack!; });
    if (pd.release !== undefined) set("pad.release", () => { s.pad.release = pd.release!; });
  }
  const fx = synth.fx;
  if (fx?.delay) for (const k of ["time", "feedback", "mix"] as const)
    if (fx.delay[k] !== undefined) set(`fx.delay.${k}`, () => { s.fx.delay[k] = fx.delay![k]!; });
  if (fx?.reverb) for (const k of ["size", "mix"] as const)
    if (fx.reverb[k] !== undefined) set(`fx.reverb.${k}`, () => { s.fx.reverb[k] = fx.reverb![k]!; });
  return { state: s, overridden };
}

/** In `own` mode the model's HSL values replace the mapped ones; limits still apply afterwards. */
export function applyColour(mapped: ResolvedColour, input: Colour | undefined): ResolvedColour {
  // Anything sent is used, unless the call says mode "follow". Fields left out keep the mapped value.
  if (!input || input.mode === "follow") return mapped;
  const out: ResolvedColour = { ...mapped };
  if (input.scene) { out.scene = input.scene; delete out.sceneAuto; }
  if (input.density !== undefined) out.density = input.density;
  if (input.speed !== undefined) out.speed = input.speed;
  if (input.sync) out.sync = input.sync;
  if (input.hue !== undefined) out.h = input.hue;
  if (input.saturation !== undefined) out.s = input.saturation;
  if (input.lightness !== undefined) out.l = input.lightness;
  if (input.secondary) out.secondary = { h: input.secondary.hue, s: input.secondary.saturation, l: input.secondary.lightness };
  if (input.motion) { out.motion = input.motion; out.pulseHz = input.motion === "pulse" ? (mapped.pulseHz || 0.3) : 0; }
  if (input.texture) out.texture = input.texture;
  if (input.shape) out.shape = input.shape;
  return out;
}
