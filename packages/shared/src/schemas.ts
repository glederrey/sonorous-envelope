import { z } from "zod";

const unit = z.number().min(0).max(1);

export const Mood = z.object({
  warmth: unit.describe("0 cold, 1 warm"),
  closeness: unit.describe("0 distant, 1 close"),
  joy: unit.describe("0 despair, 1 joy"),
  calm: unit.describe("0 urgency, 1 calm"),
  spontaneity: unit.describe("0 measured, 1 spontaneous"),
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
  }).partial(),
  filter: z.object({
    type: z.enum(["lowpass", "highpass", "bandpass"]),
    cutoff: z.number().min(60).max(16000).describe("Hz"),
    resonance: z.number().min(0.1).max(20).describe("Q"),
  }).partial(),
  lfo: z.array(z.object({
    target: z.enum(["cutoff", "pitch", "amp", "pan"]),
    rate: z.number().min(0.01).max(12).describe("Hz"),
    depth: unit,
    shape: z.enum(["sine", "triangle", "square", "random"]),
  })).max(2),
  env: z.object({
    attack: z.number().min(0.001).max(4),
    decay: z.number().min(0.01).max(4),
    sustain: unit,
    release: z.number().min(0.01).max(8),
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
  volume: unit,
}).partial();
export type SynthOverride = z.infer<typeof SynthOverride>;

export const Colour = z.object({
  mode: z.enum(["follow", "own"]).default("follow"),
  hue: z.number().min(0).max(360).optional(),
  saturation: unit.optional(),
  lightness: unit.optional(),
  secondary: z.object({ hue: z.number().min(0).max(360), saturation: unit, lightness: unit }).optional(),
  motion: z.enum(["still", "drift", "pulse"]).optional(),
  texture: z.enum(["flat", "grain", "soft_noise"]).optional(),
});
export type Colour = z.infer<typeof Colour>;

export const Transition = z.object({
  time: z.number().min(0).max(30).default(4).describe("seconds"),
  curve: z.enum(["smooth", "sudden"]).default("smooth"),
});
export type Transition = z.infer<typeof Transition>;

export const ListenerSettings = z.object({
  consent: z.enum(["ambient", "expressive", "anything"]).default("ambient"),
  max_volume: unit.default(0.6),
  max_harshness: unit.default(0.5),
  min_transition: z.number().min(0).max(30).default(3),
  mood_floor: z.object({ joy: unit.default(0), calm: unit.default(0) }).default({ joy: 0, calm: 0 }),
  gestures: z.boolean().default(true),
  max_delay_mix: unit.default(0.4),
  colour: z.object({
    enabled: z.boolean().default(true),
    max_lightness: unit.default(0.5),
    max_saturation: unit.default(0.7),
  }).default({ enabled: true, max_lightness: 0.5, max_saturation: 0.7 }),
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
  mood: Mood,
  synth: SynthOverride.optional().describe("optional exact synth settings; replaces what the mood produced"),
  colour: Colour.optional().describe("colour follows the sound unless you set mode own"),
  transition: Transition.optional(),
  final: z.boolean().default(false).describe("true on the last call of each message"),
  note: z.string().max(200).optional().describe("what you meant; stored, not sent back"),
});
export type SetSoundInput = z.infer<typeof SetSoundInput>;
