import type { EngineState } from "@sonorous/engine";

export interface SetRow {
  turn: number; final: boolean; created_at: string; clamps: string[] | null; effective: EngineState;
  intent: { mood?: Record<string, number>; note?: string; overridden?: string[]; silence?: boolean; end?: boolean };
}

const NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const AXES = ["warmth", "closeness", "joy", "calm", "spontaneity"] as const;


/** What the owner sees under "What Claude set": the mood as sent, the sound as played, clamps and the note. */
export function describeSet(row: SetRow) {
  const e = row.effective;
  const mood: Array<{ axis: string; value: number }> = AXES.map((a) => ({ axis: a, value: Math.round((row.intent.mood?.[a] ?? 0) * 100) / 100 }));
  if (row.intent.mood?.tension !== undefined) mood.push({ axis: "tension", value: Math.round(row.intent.mood.tension * 100) / 100 });
  const sound = `${NOTE[((e.arp.root % 12) + 12) % 12]} ${e.arp.scale.replace("_", " ")}, ${Math.round(e.arp.tempo)} BPM, ${e.osc.wave}, `
    + `${e.arp.pattern.replace("_", " ")}, cutoff ${Math.round(e.filter.cutoff)} Hz`;
  const colour = `hue ${Math.round(e.colour.h)}, saturation ${Math.round(e.colour.s * 100) / 100}, lightness ${Math.round(e.colour.l * 100) / 100}`;
  return {
    mood, sound, colour, note: row.intent.note ?? null, clamps: row.clamps ?? [],
    overridden: row.intent.overridden ?? [], silence: Boolean(row.intent.silence),
  };
}
