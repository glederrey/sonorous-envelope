import type { EngineState } from "./types";

/** A quiet, valid state: D dorian arpeggio, triangle wave, a little reverb. Used by tests and as a safe fallback. */
export function neutralState(): EngineState {
  return {
    arp: { on: true, root: 50, scale: "dorian", chord: [1, 3, 5, 7], pattern: "up", octaves: 1, tempo: 90,
           rate: "1/8", gate: 0.6, swing: 0, density: 1, jitterMs: 0 },
    osc: { wave: "triangle", detune: 6, voices: 2, drive: 0, stack: [] },
    filter: { type: "lowpass", cutoff: 1500, resonance: 1 },
    lfo: [{ target: "cutoff", rate: 0.2, depth: 0.3, shape: "sine" }],
    env: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.5 },
    drone: { on: false, notes: [38, 45], wave: "sine", level: 0.2 },
    pad: { on: false, notes: [], wave: "sine", level: 0.2, attack: 2, release: 3 },
    bass: { on: false, root: 38, scale: "dorian", chord: [1, 3, 5], stepSeconds: 1.5, wave: "sine", level: 0.15 },
    fx: { delay: { time: 0.4, feedback: 0.3, mix: 0.2 }, reverb: { size: 0.7, mix: 0.25 } },
    pan: { width: 0.7 },
    volume: 0.5,
    colour: { h: 30, s: 0.4, l: 0.3, motion: "drift", texture: "flat", pulseHz: 0 },
    transition: { time: 4, curve: "smooth" },
  };
}
