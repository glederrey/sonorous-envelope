import type { EngineState, ScaleName } from "@sonorous/engine";
import type { Mood } from "./schemas";

const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiName = (m: number) => `${NOTE[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
const scaleLabel = (root: number, scale: ScaleName) => `${NOTE[((root % 12) + 12) % 12]} ${scale.replace("_", " ")}`;
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface FeedbackInput {
  turn: number;
  intent: Mood;
  effective: EngineState;
  clamps: string[];
  players: number;
  controls?: { volume: number; delay: number } | null;
  notes?: string[];
}

/** The compact object returned by set_sound and get_feedback. Empty arrays and unknown fields are left out. */
export function buildFeedback(i: FeedbackInput) {
  const e = i.effective;
  const out: Record<string, unknown> = {
    turn: i.turn,
    intent: { warmth: r2(i.intent.warmth), closeness: r2(i.intent.closeness), joy: r2(i.intent.joy), calm: r2(i.intent.calm), spontaneity: r2(i.intent.spontaneity) },
    playing: {
      scale: scaleLabel(e.arp.root, e.arp.scale), tempo: Math.round(e.arp.tempo), wave: e.osc.wave,
      cutoff: Math.round(e.filter.cutoff), volume: r2(e.volume), drone: e.drone.on,
    },
  };
  if (i.clamps.length) out.clamped = i.clamps;
  out.colour = { h: Math.round(e.colour.h), s: r2(e.colour.s), l: r2(e.colour.l), motion: e.colour.motion };
  if (i.controls) out.controls = { volume: r2(i.controls.volume), delay: r2(i.controls.delay) };
  out.players = i.players;
  const notes = [...(i.notes ?? [])];
  if (i.players === 0) notes.unshift("no player open: nobody is hearing this");
  if (notes.length) out.notes = notes;
  return out;
}
