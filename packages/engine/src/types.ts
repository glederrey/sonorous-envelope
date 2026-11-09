export type ScaleName =
  | "major" | "minor" | "dorian" | "phrygian" | "lydian" | "mixolydian" | "locrian"
  | "harmonic_minor" | "pentatonic" | "whole_tone" | "chromatic";
export type Wave = "sine" | "triangle" | "sawtooth" | "square";
export type FilterType = "lowpass" | "highpass" | "bandpass";
export type LfoTarget = "cutoff" | "pitch" | "amp" | "pan";
export type LfoShape = "sine" | "triangle" | "square" | "random";
export type Pattern = "up" | "down" | "up_down" | "random" | "as_played";
export type Rate = "1/4" | "1/8" | "1/8t" | "1/16";
export type GestureType =
  | "purr" | "meow_up" | "meow_down" | "chirp" | "laugh" | "growl" | "sigh" | "hum" | "pluck" | "breath";

export interface ResolvedColour {
  h: number; s: number; l: number;
  secondary?: { h: number; s: number; l: number };
  motion: "still" | "drift" | "pulse";
  texture: "flat" | "grain" | "soft_noise";
  pulseHz: number;
}

/** The complete, fully resolved state the engine plays. Every field is present. */
export interface EngineState {
  arp: {
    on: boolean; root: number; scale: ScaleName; chord: number[]; pattern: Pattern;
    octaves: number; tempo: number; rate: Rate; gate: number; swing: number; density: number;
    jitterMs: number;
  };
  /** `stack`: extra intervals in semitones (max 3); each arp note then sounds as a chord. */
  osc: { wave: Wave; detune: number; voices: number; drive: number; stack: number[] };
  filter: { type: FilterType; cutoff: number; resonance: number };
  lfo: Array<{ target: LfoTarget; rate: number; depth: number; shape: LfoShape }>;
  env: { attack: number; decay: number; sustain: number; release: number };
  drone: { on: boolean; notes: number[]; wave: Wave; level: number };
  /** A sustained chord (MIDI notes, max 5), separate from the drone, with its own slow attack and release. */
  pad: { on: boolean; notes: number[]; wave: Wave; level: number; attack: number; release: number };
  bass: { on: boolean; root: number; scale: ScaleName; chord: number[]; stepSeconds: number; wave: Wave; level: number };
  fx: { delay: { time: number; feedback: number; mix: number }; reverb: { size: number; mix: number } };
  pan: { width: number };
  volume: number;
  gesture: null | { type: GestureType; intensity: number; id: string };
  colour: ResolvedColour;
  /** `delay`: seconds to wait before this state starts (set by `silence` with `end`, so the closing sound plays out first). */
  transition: { time: number; curve: "smooth" | "sudden"; delay?: number };
}

export interface NoteEvent { time: number; midi: number; velocity: number; layer: "arp" | "bass" }
