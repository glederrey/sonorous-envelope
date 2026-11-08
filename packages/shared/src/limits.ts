import { clone } from "./util";
import type { EngineState, Rate, ResolvedColour, ScaleName, Wave } from "@sonorous/engine";
import type { ListenerSettings, Mood, Transition } from "./schemas";

type Consent = ListenerSettings["consent"];

interface Ceilings {
  minTransition: number; maxTempo: number; maxResonance: number; waves: Wave[];
  disallowedScales: ScaleName[]; maxAmpLfo: number; maxNotesPerSec: number; maxDrive: number;
  floor: { joy: number; calm: number }; sudden: boolean;
}

export const CONSENT: Record<Consent, Ceilings> = {
  ambient: {
    minTransition: 4, maxTempo: 110, maxResonance: 4, waves: ["sine", "triangle"],
    disallowedScales: ["locrian", "chromatic", "phrygian"], maxAmpLfo: 0.2, maxNotesPerSec: 4, maxDrive: 0,
    floor: { joy: 0.2, calm: 0.3 }, sudden: false,
  },
  expressive: {
    minTransition: 2, maxTempo: 150, maxResonance: 10, waves: ["sine", "triangle", "sawtooth"],
    disallowedScales: ["chromatic"], maxAmpLfo: 0.4, maxNotesPerSec: 8, maxDrive: 0.5,
    floor: { joy: 0, calm: 0 }, sudden: false,
  },
  anything: {
    minTransition: 0.3, maxTempo: 200, maxResonance: 20, waves: ["sine", "triangle", "sawtooth", "square"],
    disallowedScales: [], maxAmpLfo: 0.6, maxNotesPerSec: 16, maxDrive: 0.8,
    floor: { joy: 0, calm: 0 }, sudden: true,
  },
};

/** A disallowed scale is replaced by this one (explicit, so the result is predictable). */
const SCALE_FALLBACK: Partial<Record<ScaleName, ScaleName>> = { locrian: "minor", phrygian: "minor", chromatic: "pentatonic" };

const RATE_BEATS: Record<Rate, number> = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 };
const SLOWER: Record<Rate, Rate> = { "1/16": "1/8", "1/8t": "1/4", "1/8": "1/4", "1/4": "1/4" };
const WAVE_HARSH: Record<Wave, number> = { sine: 0, triangle: 0.2, sawtooth: 0.7, square: 1 };
const SOFTER: Record<Wave, Wave> = { square: "sawtooth", sawtooth: "triangle", triangle: "sine", sine: "sine" };

const r2 = (x: number) => Math.round(x * 100) / 100;
const norm = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

export const notesPerSecond = (s: EngineState) =>
  (s.arp.on ? (s.arp.tempo / 60 / RATE_BEATS[s.arp.rate]) * s.arp.density : 0);

export function harshness(s: EngineState): number {
  const rateFactor = notesPerSecond(s);
  return Math.min(1,
    0.3 * WAVE_HARSH[s.osc.wave] + 0.2 * norm(s.filter.resonance, 0.7, 12) +
    0.2 * norm(Math.log(s.filter.cutoff), Math.log(400), Math.log(9000)) +
    0.1 * norm(rateFactor, 1, 12) + 0.2 * s.osc.drive);
}

/** Raise joy and calm to the listener's floor and the consent floor, before mapping. */
export function applyMoodFloor(mood: Mood, settings: ListenerSettings): { mood: Mood; clamps: string[] } {
  const f = CONSENT[settings.consent].floor;
  const joy = Math.max(mood.joy, settings.mood_floor.joy, f.joy);
  const calm = Math.max(mood.calm, settings.mood_floor.calm, f.calm);
  const clamps: string[] = [];
  if (joy !== mood.joy) clamps.push(`joy ${r2(mood.joy)}→${r2(joy)} (mood floor)`);
  if (calm !== mood.calm) clamps.push(`calm ${r2(mood.calm)}→${r2(calm)} (mood floor)`);
  return { mood: { ...mood, joy, calm }, clamps };
}

export const moodDistance = (a: Mood, b: Mood) =>
  Math.hypot(a.warmth - b.warmth, a.closeness - b.closeness, a.joy - b.joy, a.calm - b.calm, a.spontaneity - b.spontaneity);

export interface LimitInput {
  mapped: EngineState;
  mood: Mood;
  previousMood?: Mood | null;
  transition?: Transition;
  settings: ListenerSettings;
}

const NEUTRAL_COLOUR: ResolvedColour = { h: 220, s: 0, l: 0.05, motion: "still", texture: "flat", pulseHz: 0 };

/**
 * Applies listener limits and consent to a mapped state. Pure. Runs on the server for every update and again in
 * the player. Returns the effective state and short human-readable clamp entries (max 5, then "…and N more").
 */
export function applyLimits(input: LimitInput): { effective: EngineState; clamps: string[] } {
  const { settings } = input;
  const cap = CONSENT[settings.consent];
  const s: EngineState = clone(input.mapped);
  const clamps: string[] = [];
  const note = (field: string, from: number | string, to: number | string, why: string) =>
    clamps.push(`${field} ${typeof from === "number" ? r2(from) : from}→${typeof to === "number" ? r2(to) : to} (${why})`);

  // consent ceilings
  if (s.arp.tempo > cap.maxTempo) { note("tempo", s.arp.tempo, cap.maxTempo, `${settings.consent} limit`); s.arp.tempo = cap.maxTempo; }
  if (s.filter.resonance > cap.maxResonance) { note("resonance", s.filter.resonance, cap.maxResonance, `${settings.consent} limit`); s.filter.resonance = cap.maxResonance; }
  if (!cap.waves.includes(s.osc.wave)) {
    const to = [...cap.waves].reverse().find((w) => WAVE_HARSH[w] <= WAVE_HARSH[s.osc.wave]) ?? "sine";
    note("wave", s.osc.wave, to, `${settings.consent} limit`); s.osc.wave = to;
  }
  if (!cap.waves.includes(s.drone.wave)) s.drone.wave = "sine";
  if (!cap.waves.includes(s.bass.wave)) s.bass.wave = "sine";
  if (cap.disallowedScales.includes(s.arp.scale)) {
    const to = SCALE_FALLBACK[s.arp.scale] ?? "minor";
    note("scale", s.arp.scale, to, `${settings.consent} limit`); s.arp.scale = to;
  }
  if (cap.disallowedScales.includes(s.bass.scale)) s.bass.scale = SCALE_FALLBACK[s.bass.scale] ?? "minor";
  for (const l of s.lfo) if (l.target === "amp" && l.depth > cap.maxAmpLfo) { note("tremolo", l.depth, cap.maxAmpLfo, `${settings.consent} limit`); l.depth = cap.maxAmpLfo; }
  if (s.osc.drive > cap.maxDrive) { note("roughness", s.osc.drive, cap.maxDrive, `${settings.consent} limit`); s.osc.drive = cap.maxDrive; }
  // note rate: slow the rate down, then thin the density
  if (notesPerSecond(s) > cap.maxNotesPerSec) {
    const before = notesPerSecond(s);
    while (notesPerSecond(s) > cap.maxNotesPerSec && SLOWER[s.arp.rate] !== s.arp.rate) s.arp.rate = SLOWER[s.arp.rate];
    if (notesPerSecond(s) > cap.maxNotesPerSec) s.arp.density = Math.max(0.1, s.arp.density * (cap.maxNotesPerSec / notesPerSecond(s)));
    note("note rate", before, notesPerSecond(s), `${settings.consent} limit`);
  }

  // harshness: reduce in order until it fits
  if (harshness(s) > settings.max_harshness) {
    const was = harshness(s);
    const steps: Array<() => void> = [
      () => { s.osc.drive = 0; },
      () => { s.filter.cutoff = Math.max(s.filter.cutoff / 2 ** 1.5, 200); },
      () => { s.filter.resonance = 0.7; },
      () => { s.osc.wave = SOFTER[s.osc.wave]; },
      () => { s.arp.density = s.arp.density / 2; },
    ];
    for (const step of steps) { if (harshness(s) <= settings.max_harshness) break; step(); }
    note("harshness", was, harshness(s), "listener limit");
  }

  // echo
  s.fx.delay.time = Math.min(s.fx.delay.time, 0.75);
  s.fx.delay.feedback = Math.min(s.fx.delay.feedback, 0.6);
  if (s.fx.delay.mix > settings.max_delay_mix) { note("echo", s.fx.delay.mix, settings.max_delay_mix, "listener limit"); s.fx.delay.mix = settings.max_delay_mix; }

  // volume (the absolute cap is never configurable)
  const maxVol = Math.min(settings.max_volume, 0.9);
  if (s.volume > maxVol) { note("volume", s.volume, maxVol, "listener limit"); s.volume = maxVol; }

  // transition
  const requested = input.transition ?? { time: 4, curve: "smooth" as const };
  let time = Math.max(requested.time, settings.min_transition, cap.minTransition);
  if (time !== requested.time) note("transition", `${requested.time}s`, `${r2(time)}s`, "listener limit");
  const curve = requested.curve === "sudden" && cap.sudden ? "sudden" : "smooth";
  if (requested.curve === "sudden" && curve === "smooth") note("curve", "sudden", "smooth", `${settings.consent} limit`);
  if (input.previousMood && settings.consent !== "anything" && moodDistance(input.mood, input.previousMood) > 0.6 && time < 8) {
    note("transition", `${r2(time)}s`, "8s", "large change"); time = 8;
  }
  s.transition = { time, curve };

  // no gesture in this build
  s.gesture = null;

  // colour
  if (!settings.colour.enabled) s.colour = { ...NEUTRAL_COLOUR };
  else {
    const c = s.colour;
    if (c.l > settings.colour.max_lightness) { note("lightness", c.l, settings.colour.max_lightness, "listener limit"); c.l = settings.colour.max_lightness; }
    if (c.s > settings.colour.max_saturation) { note("saturation", c.s, settings.colour.max_saturation, "listener limit"); c.s = settings.colour.max_saturation; }
    if (c.secondary) { c.secondary.l = Math.min(c.secondary.l, settings.colour.max_lightness); c.secondary.s = Math.min(c.secondary.s, settings.colour.max_saturation); }
    // hard rule, not configurable: never faster than 3 Hz
    if (c.pulseHz > 3) { note("pulse", c.pulseHz, 3, "safety"); c.pulseHz = 3; }
    if (c.motion !== "pulse") c.pulseHz = 0;
  }

  // absolute caps
  s.volume = Math.min(s.volume, 0.9);
  s.pan.width = Math.min(1, Math.max(0, s.pan.width));

  if (clamps.length > 5) { const extra = clamps.length - 5; clamps.length = 5; clamps.push(`…and ${extra} more`); }
  return { effective: s, clamps };
}
