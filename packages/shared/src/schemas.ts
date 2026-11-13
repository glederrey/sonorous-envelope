import { z } from "zod";

const unit = z.number().min(0).max(1);

export const Mood = z.object({
  warmth: unit.describe("0 cold, 1 warm"),
  closeness: unit.describe("0 distant, 1 close"),
  joy: unit.describe("0 despair, 1 joy"),
  calm: unit.describe("0 urgency, 1 calm"),
  spontaneity: unit.describe("0 measured, 1 spontaneous"),
  tension: unit.optional().describe("optional, 0 consonant to 1 dissonant. Leave it out for none. Anger, dread and unease need it: joy and calm cannot make a sound clash"),
});
export type Mood = z.infer<typeof Mood>;

export const NoteName = z.string().regex(/^[A-G](#|b)?[0-8]$/, "note name like D3");

const Scale = z.enum([
  "major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian",
  "harmonic_minor", "pentatonic", "whole_tone", "chromatic",
]);
const Wave = z.enum(["sine", "triangle", "sawtooth", "square"]);

export const SynthOverride = z.object({
  arp: z.object({
    on: z.boolean(),
    root: NoteName,
    scale: Scale,
    chord: z.array(z.number().int().min(1).max(14)).min(1).max(8).describe("scale degrees"),
    pattern: z.enum(["up", "down", "up_down", "random", "as_played"]),
    octaves: z.number().int().min(1).max(4),
    tempo: z.number().min(30).max(200).describe("BPM"),
    rate: z.enum(["1/4", "1/8", "1/8t", "1/16"]),
    gate: z.number().min(0.05).max(1),
    swing: unit,
    density: unit.describe("step probability"),
  }).partial(),
  osc: z.object({
    wave: Wave,
    detune: z.number().min(0).max(50).describe("cents"),
    voices: z.number().int().min(1).max(3),
    stack: z.array(z.number().int().min(-24).max(24)).max(3).describe("extra intervals in semitones: [7, 12] makes every arp note a chord. Stays until you change it; [] for single notes"),
  }).partial(),
  filter: z.object({
    type: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: z.number().min(60).max(16000).describe("Hz"),
    resonance: z.number().min(0.1).max(20).describe("Q"),
  }).partial(),
  lfo: z.array(z.object({
    target: z.enum(["cutoff", "pitch", "amp", "pan"]),
    rate: z.number().min(0.01).max(80).describe("Hz. Up to 12 for cutoff, pitch and pan; up to 80 for amp, where above about 20 it is a grain, not a tremolo. LFOs stay until you change them; send lfo [] to get the mapped ones back, depth 0 for none"),
    depth: unit,
    shape: z.enum(["sine", "triangle", "square", "random"]),
  }).refine((l) => l.target === "amp" || l.rate <= 12, { message: "rate above 12 Hz is only for the amp target", path: ["rate"] })).max(2),
  env: z.object({
    attack: z.number().min(0.001).max(4),
    decay: z.number().min(0.01).max(4),
    sustain: unit,
    release: z.number().min(0.01).max(8),
  }).partial(),
  pad: z.object({
    on: z.boolean(),
    notes: z.array(NoteName).max(5).describe("a sustained chord, separate from the drone. The pad stays until you change it; on false silences it"),
    wave: Wave,
    level: unit,
    attack: z.number().min(0.05).max(8).describe("seconds to fade each note in"),
    release: z.number().min(0.05).max(8).describe("seconds to fade each note out"),
  }).partial(),
  drone: z.object({
    on: z.boolean(),
    notes: z.array(NoteName).max(4),
    wave: Wave,
    level: unit,
  }).partial(),
  fx: z.object({
    delay: z.object({ time: z.number().min(0.05).max(1.5), feedback: z.number().min(0).max(0.85), mix: unit }).partial(),
    reverb: z.object({ size: unit, mix: unit }).partial(),
  }).partial(),
}).partial();
export type SynthOverride = z.infer<typeof SynthOverride>;

/** The part of the sound that says who is playing. Chosen by the instance at start_session, replaceable with set_sound. */
export const Voice = z.object({
  root: NoteName.describe("root note, like D3"),
  scale: Scale,
  chord: z.array(z.number().int().min(1).max(14)).min(1).max(8).describe("scale degrees; their order is the note order when pattern is as_played"),
  pattern: z.enum(["up", "down", "up_down", "random", "as_played"]),
  octaves: z.number().int().min(1).max(4),
  wave: Wave,
}).partial();
export type Voice = z.infer<typeof Voice>;

export const Colour = z.object({
  mode: z.enum(["follow", "own"]).optional().describe("leave it out: any hue, saturation, lightness or secondary you send is used. \"follow\" ignores them"),
  hue: z.number().min(0).max(360).optional().describe("the full colour wheel: 0 red, 30 orange, 60 yellow, 120 green, 180 cyan, 240 blue, 280 violet, 320 magenta"),
  saturation: unit.optional(),
  lightness: unit.optional(),
  secondary: z.object({ hue: z.number().min(0).max(360), saturation: unit, lightness: unit }).optional(),
  motion: z.enum(["still", "drift", "pulse", "breathe"]).optional().describe("still, drift, pulse (on the beat) or breathe"),
  shape: z.enum(["wash", "glow", "sweep"]).optional().describe("layout: wash (linear, default), glow (radial), sweep (conic)"),
  texture: z.enum(["flat", "grain", "soft_noise"]).optional(),
  scene: z.enum(["none", "motes", "ripples", "rain", "snow", "embers", "aurora", "waves", "fireflies", "stars", "bubbles", "leaves", "seeds", "tide", "smoke", "clouds", "circuit", "digital", "scope", "vines", "fireworks", "reeds", "network", "flock"]).optional().describe("left out: the mood picks; none: off"),
  density: unit.optional().describe("how many, for a scene"),
  speed: unit.optional().describe("how fast, for a scene"),
  sync: z.enum(["beat", "phrase", "free"]).optional().describe("what the motion follows: beat, phrase (4-bar swell) or free. Left out: the mood decides"),
});
export type Colour = z.infer<typeof Colour>;


export const Transition = z.object({
  time: z.number().min(0).max(30).default(4).describe("seconds"),
  curve: z.enum(["smooth", "sudden"]).default("smooth"),
});
export type Transition = z.infer<typeof Transition>;

// Session settings. The listener limits (consent, volume cap, harshness, colour limits...) are removed for now: Claude
// decides, and the listener's only control is the volume in the player. Old rows still carry those keys; zod strips them.
export const ListenerSettings = z.object({
  // Shared with Claude (limits.md, "Who can change what"): seconds without an update before the sound fades; null = never.
  rest_after: z.number().min(60).max(3600).nullable().default(900),
  image_feedback: z.enum(["off", "on_request", "every_turn"]).default("off"),
});
export type ListenerSettings = z.infer<typeof ListenerSettings>;

/** Parse stored settings; anything invalid falls back to the safe defaults. */
export function parseSettings(raw: unknown): ListenerSettings {
  const r = ListenerSettings.safeParse(raw ?? {});
  return r.success ? r.data : ListenerSettings.parse({});
}

export const SetSoundInput = z.object({
  session_id: z.string().optional().describe("from start_session; defaults to your latest session"),
  mood: Mood.optional().describe("leave it out to keep the mood of your last call: a synth, voice or colour change then does not move the voice the mood draws"),
  synth: SynthOverride.optional().describe("optional exact synth settings; replaces what the mood produced, for this call only (your voice, colour, stack, pad and LFOs stay until you change them). Tempo glides over the transition"),
  colour: Colour.optional().describe("colour follows the sound by default; send any hue, saturation, lightness, motion, texture, scene or sync to set your own. It stays until you change it; mode follow gives it back to the sound"),
  transition: Transition.optional(),
  final: z.boolean().default(false).describe("true on the last call of each message"),
  title: z.string().max(80).optional().describe("a short name for this session (2 to 5 words); send it when you know the topic, change it if the conversation moves on"),
  note: z.string().max(200).optional().describe("what you meant; stored, not sent back"),
  voice: Voice.optional().describe("your voice: root, scale, chord, note order, octaves, wave. It stays from turn to turn; send a new one to change it, for instance when the conversation turns"),
  keep_voice: z.boolean().optional().describe("true: freeze the scale, root, note order and wave that play now as your voice. Without one, your first sound becomes your voice, and its scale mode follows joy"),
  mode: z.enum(["internal", "external"]).optional().describe("switch your face (see the guidance from start_session): external only after the listener said yes"),
  rest_after: z.number().min(60).max(3600).nullable().optional().describe("seconds without an update from you before the sound fades to silence; null = never fade. You are not there between turns: this is how the channel says so. Leave it out to keep the value"),
});
export type SetSoundInput = z.infer<typeof SetSoundInput>;

/** The longest Strudel code the tool takes. It travels in every player poll, so it stays small. */
export const MAX_PATTERN_CHARS = 4000;

export const StrudelModeInput = z.object({
  session_id: z.string().optional().describe("from start_session; defaults to your latest session"),
  on: z.boolean().describe("true: play Strudel code (send code and bpm). false: go back to the built-in synth, where you left it"),
  code: z.string().max(MAX_PATTERN_CHARS).optional().describe("Strudel code, as on strudel.cc, up to 4000 characters. Send it again with new code to change the music; it lands on the next bar. Samples work (bd, sd, hh, piano...). Tempo comes from bpm, not from setcps"),
  bpm: z.number().min(30).max(200).optional().describe("tempo in beats per minute; one cycle is one bar of 4 beats"),
  colour: Colour.optional().describe("the picture, as in set_sound; it follows bpm"),
  final: z.boolean().default(false).describe("true on the last call of each message"),
  title: z.string().max(80).optional().describe("a short name for this session (2 to 5 words)"),
  note: z.string().max(200).optional().describe("what you meant; stored, not sent back"),
});
export type StrudelModeInput = z.infer<typeof StrudelModeInput>;
