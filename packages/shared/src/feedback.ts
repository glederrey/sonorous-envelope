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
  /** What the owner pressed since the last call (reactions.ts), one short line per kind. */
  reactions?: string[];
  /** the face playing, with "locked by the owner" when it is */
  mode?: string;
  /** The compact analysis of the state (analysis.ts): `sound` words and the `reads_as` estimate. */
  /** What the player reported about the Strudel code that plays (pattern_reports); only for a Strudel state. */
  pattern?: Record<string, unknown>;
  analysis?: { sound: Record<string, unknown>; reads_as: Record<string, number>; why?: Record<string, { low: string; high: string }> } | null;
}

/** What actually plays, in the vocabulary of what Claude can set, so it can check that its choices arrived.
 *  Stored states from before the stack and the pad existed lack those keys, hence the optional chaining. */
function playingOf(e: EngineState) {
  if (e.engine === "strudel" && e.pattern) {
    // the synth fields are the paused synth; what plays is the pattern
    const c = e.colour, p: Record<string, unknown> = { engine: "strudel", bpm: Math.round(e.pattern.bpm), code: `${e.pattern.code.length} characters` };
    const chosen = c.scene && c.scene !== "none" && !c.sceneAuto; // a scene the mood picked is not reported: only what you set
    if (chosen || c.sync) p.picture = [chosen ? `${c.scene} density ${r2(c.density ?? 0.4)} speed ${r2(c.speed ?? 0.4)}` : "", c.sync ? `sync ${c.sync}` : ""].filter(Boolean).join(", ");
    return p;
  }
  const p: Record<string, unknown> = {
    scale: scaleLabel(e.arp.root, e.arp.scale), tempo: Math.round(e.arp.tempo), wave: e.osc.wave,
    cutoff: Math.round(e.filter.cutoff), resonance: r2(e.filter.resonance), detune: Math.round(e.osc.detune), volume: r2(e.volume), drone: e.drone.on,
    pattern: e.arp.pattern, rate: e.arp.rate, octaves: e.arp.octaves, chord: e.arp.chord,
  };
  if (!e.arp.on) p.arp = "off";
  if (e.osc.stack?.length) p.stack = e.osc.stack;
  if (e.pad?.on && e.pad.notes.length) p.pad = { notes: e.pad.notes.map(midiName), wave: e.pad.wave };
  if (e.lfo.length) p.lfo = e.lfo.map((l) => `${l.target} ${r2(l.rate)}Hz depth ${r2(l.depth)} ${l.shape}`);
  p.echo = r2(e.fx.delay.mix); p.reverb = r2(e.fx.reverb.mix);
  // the picture, only when you set something beyond the mood: scene, its density and speed, and what it follows
  const c = e.colour;
  const chosen = c.scene && c.scene !== "none" && !c.sceneAuto; // a scene the mood picked is not reported: only what you set
  if (chosen || c.sync) p.picture = [chosen ? `${c.scene} density ${r2(c.density ?? 0.4)} speed ${r2(c.speed ?? 0.4)}` : "", c.sync ? `sync ${c.sync}` : ""].filter(Boolean).join(", ");
  return p;
}

/** The compact object returned by set_sound and get_feedback. Empty arrays and unknown fields are left out. */
export function buildFeedback(i: FeedbackInput) {
  const e = i.effective;
  const out: Record<string, unknown> = {
    turn: i.turn,
    intent: { warmth: r2(i.intent.warmth), closeness: r2(i.intent.closeness), joy: r2(i.intent.joy), calm: r2(i.intent.calm), spontaneity: r2(i.intent.spontaneity),
      ...(i.intent.tension === undefined ? {} : { tension: r2(i.intent.tension) }) },
    playing: playingOf(e),
  };
  if (i.clamps.length) out.clamped = i.clamps;
  out.colour = { h: Math.round(e.colour.h), s: r2(e.colour.s), l: r2(e.colour.l), motion: e.colour.motion, ...(e.colour.shape && e.colour.shape !== "wash" ? { shape: e.colour.shape } : {}) };
  if (i.controls) out.controls = { volume: r2(i.controls.volume) };
  if (i.analysis) {
    out.sound = i.analysis.sound; out.reads_as = i.analysis.reads_as;
    // where the reading is far from what was sent, say which parts of the sound pull it that way
    const why: Record<string, string> = {};
    for (const [axis, read] of Object.entries(i.analysis.reads_as)) {
      const sent = (i.intent as Record<string, number>)[axis], w = i.analysis.why?.[axis];
      if (sent === undefined || !w || Math.abs(read - sent) < 0.25) continue;
      why[axis] = read < sent ? `held down by ${w.low}` : `lifted by ${w.high}`;
    }
    if (Object.keys(why).length) out.reads_why = why;
  }
  if (i.pattern) out.pattern = i.pattern;
  if (i.reactions?.length) out.reactions = i.reactions;
  if (i.mode) out.mode = i.mode;
  out.players = i.players;
  if (i.resting) out.resting = true;
  const notes = [...(i.notes ?? [])];
  if (i.players === 0) notes.unshift("no player open: nobody is hearing this");
  if (notes.length) out.notes = notes;
  return out;
}
