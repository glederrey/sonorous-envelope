import type { EngineState } from "@sonorous/engine";
import {
  applyColour, applyLimits, applyOverride, moodToEngineState, stretchMood, voiceToSynth,
  type Colour, type Mood, type SynthOverride, type Voice,
} from "@sonorous/shared";

// The landing page plays five emotions so a visitor knows what to expect. They are written the way a model would write them:
// a mood, a voice, and a little synth. They go through the same mapping, limits and engine as a real session.
// Imagined by us, not recorded from a model; tune by ear.

export interface SampleStep {
  /** Seconds after the start. */
  at: number;
  mood: Mood;
  voice: Voice;
  synth?: SynthOverride;
  colour?: Colour;
  transition: number;
}
/** `gainDb` levels the five by measured loudness (`pnpm samples:loudness`), so that none jumps out when a visitor switches. */
export interface Sample { id: string; name: string; blurb: string; seconds: number; seed: number; gainDb?: number; steps: SampleStep[] }

const m = (warmth: number, closeness: number, joy: number, calm: number, spontaneity: number, tension?: number): Mood =>
  ({ warmth, closeness, joy, calm, spontaneity, ...(tension === undefined ? {} : { tension }) });

export const SAMPLES: Sample[] = [
  {
    id: "tender", name: "Tender, bittersweet", blurb: "Warm and close, a little sad, slow.", seconds: 20, seed: 101,
    steps: [{
      at: 0, mood: m(0.9, 0.85, 0.5, 0.85, 0.25), transition: 0.5, colour: { hue: 28, saturation: 0.55, lightness: 0.3 },
      voice: { root: "D3", scale: "dorian", chord: [1, 3, 5, 7], pattern: "up_down", octaves: 2, wave: "triangle" },
      synth: { pad: { notes: ["D3", "A3", "E4"], wave: "sine", level: 0.3, attack: 3, release: 4 } },
    }],
  },
  {
    id: "nervous", name: "Nervous anticipation", blurb: "Quick, bright, unsettled, a little tense.", seconds: 18, seed: 202,
    steps: [{
      at: 0, mood: m(0.45, 0.6, 0.65, 0.15, 0.7, 0.2), transition: 0.5, colour: { hue: 52, saturation: 0.7, lightness: 0.38 },
      voice: { root: "E3", scale: "mixolydian", chord: [1, 3, 5, 8], pattern: "random", octaves: 2, wave: "triangle" },
    }],
  },
  {
    id: "awe", name: "Quiet awe", blurb: "Open, high and slow, with a lot of space.", seconds: 22, seed: 303, gainDb: -2.5,
    steps: [{
      at: 0, mood: m(0.65, 0.25, 0.65, 0.95, 0.2), transition: 0.5, colour: { hue: 215, saturation: 0.5, lightness: 0.3 },
      voice: { root: "A3", scale: "lydian", chord: [1, 5, 9], pattern: "up", octaves: 3, wave: "sine" },
      synth: { pad: { notes: ["A3", "E4", "B4"], wave: "sine", level: 0.35, attack: 4, release: 5 }, fx: { reverb: { size: 0.95, mix: 0.6 } } },
    }],
  },
  {
    id: "irritated", name: "Irritated and weary", blurb: "Dark, rough, low patience.", seconds: 18, seed: 404, gainDb: -10.5,
    steps: [{
      at: 0, mood: m(0.2, 0.65, 0.2, 0.45, 0.55, 0.55), transition: 0.5, colour: { hue: 352, saturation: 0.55, lightness: 0.2 },
      voice: { root: "C3", scale: "phrygian", chord: [1, 3, 5], pattern: "down", octaves: 1, wave: "sawtooth" },
      synth: { filter: { cutoff: 1400 } },
    }],
  },
  {
    id: "relief", name: "Relief", blurb: "Tension first, then the exhale.", seconds: 24, seed: 505, gainDb: -3,
    steps: [
      {
        at: 0, mood: m(0.35, 0.6, 0.3, 0.1, 0.6, 0.6), transition: 0.5, colour: { hue: 330, saturation: 0.5, lightness: 0.22 },
        voice: { root: "G2", scale: "phrygian", chord: [1, 3, 5], pattern: "random", octaves: 2, wave: "triangle" },
      },
      {
        at: 8, mood: m(0.8, 0.7, 0.65, 0.95, 0.2, 0), transition: 7, colour: { hue: 170, saturation: 0.45, lightness: 0.32 },
        voice: { root: "G3", scale: "major", chord: [1, 3, 5], pattern: "up_down", octaves: 2, wave: "sine" },
        synth: { pad: { notes: ["G3", "D4", "B4"], wave: "sine", level: 0.3, attack: 3, release: 4 } },
      },
    ],
  },
];

/** The engine state of one step, through the same mapping and safety rules as a session. */
export function stateOfStep(step: SampleStep, id: string): EngineState {
  const mood = stretchMood(step.mood);
  const mapped = applyOverride(moodToEngineState(mood, mood, 1), voiceToSynth(step.voice)).state;
  const withSynth = applyOverride(mapped, step.synth).state;
  withSynth.colour = applyColour(withSynth.colour, step.colour);
  const { effective } = applyLimits({ mapped: withSynth, transition: { time: step.transition, curve: "smooth" } });
  effective.grid = { arp: 0, bass: 0 };
  effective.volume *= 10 ** ((SAMPLES.find((x) => x.id === id)?.gainDb ?? 0) / 20);
  return effective;
}

/** The state that fades the sample out. */
export function fadeOut(last: EngineState, seconds: number): EngineState {
  const s: EngineState = JSON.parse(JSON.stringify(last));
  s.volume = 0; s.transition = { time: seconds, curve: "smooth" };
  return s;
}
