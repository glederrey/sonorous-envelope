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
  | "purr" | "chirp" | "laugh" | "growl" | "sigh" | "pluck";

export interface ResolvedColour {
  h: number; s: number; l: number;
  secondary?: { h: number; s: number; l: number };
  motion: "still" | "drift" | "pulse" | "breathe";
  /** How the colours are laid out (visuals.md): `wash` a linear gradient, `glow` a radial one, `sweep` a conic one. Absent: wash. */
  shape?: "wash" | "glow" | "sweep";
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
  /** The shared timeline (roadmap #34): the step counters of the arpeggio and the bass layer, as fractions, at the moment the state
   *  was written. The server fills it in; with the state's creation time every device knows where each step is. */
  grid?: { arp: number; bass: number; /** the tempo (BPM) that played when this state was written: the arpeggio's tempo glides from it to this state's own */ fromTempo?: number; /** seconds the glide lasts (the transition the state was written with); the ramp must not depend on `transition`, which the player rewrites when a sound rests */ glide?: number };
  /** `delay`: seconds to wait before this state starts (set by `silence` with `end`, so the closing sound plays out first). */
  transition: { time: number; curve: "smooth" | "sudden"; delay?: number };
}

export interface NoteEvent { time: number; midi: number; velocity: number; layer: "arp" | "bass" }
