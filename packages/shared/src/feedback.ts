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
  controls?: { volume: number } | null;
  notes?: string[];
  /** Set only when the owner's rest_after is on and this call arrived after it. */
  resting?: boolean;
}

/** What actually plays, in the vocabulary of what Claude can set, so it can check that its choices arrived.
 *  Stored states from before the stack and the pad existed lack those keys, hence the optional chaining. */
function playingOf(e: EngineState) {
  const p: Record<string, unknown> = {
    scale: scaleLabel(e.arp.root, e.arp.scale), tempo: Math.round(e.arp.tempo), wave: e.osc.wave,
    cutoff: Math.round(e.filter.cutoff), volume: r2(e.volume), drone: e.drone.on,
    pattern: e.arp.pattern, rate: e.arp.rate, octaves: e.arp.octaves, chord: e.arp.chord,
  };
  if (!e.arp.on) p.arp = "off";
  if (e.osc.stack?.length) p.stack = e.osc.stack;
  if (e.pad?.on && e.pad.notes.length) p.pad = { notes: e.pad.notes.map(midiName), wave: e.pad.wave };
  if (e.lfo.length) p.lfo = e.lfo.map((l) => `${l.target} ${r2(l.rate)}Hz depth ${r2(l.depth)} ${l.shape}`);
  p.echo = r2(e.fx.delay.mix); p.reverb = r2(e.fx.reverb.mix);
  return p;
}

/** The compact object returned by set_sound and get_feedback. Empty arrays and unknown fields are left out. */
export function buildFeedback(i: FeedbackInput) {
  const e = i.effective;
  const out: Record<string, unknown> = {
    turn: i.turn,
    intent: { warmth: r2(i.intent.warmth), closeness: r2(i.intent.closeness), joy: r2(i.intent.joy), calm: r2(i.intent.calm), spontaneity: r2(i.intent.spontaneity) },
    playing: playingOf(e),
  };
  if (i.clamps.length) out.clamped = i.clamps;
  out.colour = { h: Math.round(e.colour.h), s: r2(e.colour.s), l: r2(e.colour.l), motion: e.colour.motion };
  if (i.controls) out.controls = { volume: r2(i.controls.volume) };
  out.players = i.players;
  if (i.resting) out.resting = true;
  const notes = [...(i.notes ?? [])];
  if (i.players === 0) notes.unshift("no player open: nobody is hearing this");
  if (notes.length) out.notes = notes;
  return out;
}
