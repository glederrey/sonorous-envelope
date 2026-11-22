import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// The tables are untyped here; generic params are loose so any client (including test clients) fits.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;
import { midiToNoteName, noteToMidi, ratePath, SCALES, steppedFromRate, type EngineState } from "@sonorous/engine";
import {
  NEUTRAL_MOOD, applyColour, applyLimits, applyOverride, buildFeedback, isResting, moodToEngineState,
  alignToVoice, analyze, BAND_SCALE, callSynth, describeEmojis, describeReactions, isHeard, mergeSticky, moodToScene, nextBand, nextGrid, nextSlowMood, nextWaveBand, tempoHeard, parseSettings, restingNote, stickyToSynth, stretchMood, voiceSeedOf, voiceToSynth,
  type ListenerSettings, type Sticky, type Mood, type SetSoundInput, type StrudelModeInput, type Transition, type Voice,
} from "@sonorous/shared";
import { publicBaseUrl } from "../env";
import { appVersion } from "../version";
import { ENDED_AFTER_S } from "../session-status";
import { decideSwitch, effectiveRestAfter, faceLine, faceName, forListener, MODE_ID, MODE_LABEL, normalizeFace, parsePolicy, type Face, type Policy } from "./modes";
import { modeGuidance, startGuidance } from "./guidance";
import { MAX_PER_MINUTE, MIN_GAP_MS, planTurn } from "./turn";
import { checkPatternCode } from "./strudel-code";

/** An error the model can read and recover from. Returned as a tool result, never thrown to the protocol. */
export class ToolError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const MAX_ACTIVE_SESSIONS = 10;
const PRESENCE_WINDOW_MS = 45_000;

interface SessionRow {
  id: string; owner_id: string; title: string | null; settings: unknown; current_state_id: string | null;
  turn: number; pending_final: boolean; ended_at: string | null; voice: Voice | null; sticky: Sticky | null; mode?: string; mode_policy?: string; allow_code?: boolean; guided_mode?: string | null; moments?: Record<string, Moment>; motifs?: Record<string, KeptMotif>;
}
interface StateRow {
  id: string; session_id: string; turn: number; final: boolean; created_at: string; analysis: Compact | null;
  intent: { mood?: Mood; note?: string; silence?: boolean; end?: boolean; owner_silenced?: boolean; initial?: boolean; strudel_off?: boolean; from_bpm?: number; motif?: { name?: string }; overridden?: string[] }; effective: EngineState; clamps: string[]; slow_mood: Mood | null;
}

/** A kept moment: a self-contained copy of the sound and picture that played (migration 0022), so it survives the states it came from. */
interface Moment {
  kept_at: string; turn: number; effective: EngineState; intent_mood: Mood | null; analysis: Compact | null; sticky: Sticky | null; voice: Voice | null; note?: string;
}
const MAX_MOMENTS = 12;

/** A phrase the model named (migration 0025): the note names and beats as sent, so a quote (`first`) takes the start of it. */
interface KeptMotif { notes: string[]; beats: number[]; kept_at: string; turn: number }
const MAX_MOTIFS = 12;
const motifNames = (m: Record<string, KeptMotif>) => Object.keys(m).sort((a, b) => m[a].kept_at.localeCompare(m[b].kept_at)); // jsonb does not keep the order of keys

/** The notes and beats a `motif` input plays: what it carries, or a named phrase brought back (all of it, or its first notes). */
function resolveMotif(session: SessionRow, m: NonNullable<SetSoundInput["motif"]>, turn: number, now: number) {
  const saved = session.motifs ?? {}, names = motifNames(saved);
  if (m.recall !== undefined) {
    if (!Object.hasOwn(saved, m.recall)) throw new ToolError("unknown_motif", `No motif named "${m.recall}". Named: ${names.length ? names.join(", ") : "none"}.`);
    const k = saved[m.recall], n = m.first ?? k.notes.length;
    return { notes: k.notes.slice(0, n), beats: k.beats.slice(0, n), label: m.recall, store: undefined };
  }
  const notes = m.notes ?? [], beats = m.beats ?? notes.map(() => 1);
  if (m.name === undefined) return { notes, beats, label: undefined, store: undefined };
  if (!Object.hasOwn(saved, m.name) && names.length >= MAX_MOTIFS) throw new ToolError("motifs_full", "Twelve motifs are named. Keep this one under a name you already used to replace it.");
  return { notes, beats, label: m.name, store: { ...saved, [m.name]: { notes, beats, kept_at: new Date(now).toISOString(), turn } } };
}

/** A motif note outside the scale the voice plays in sounds "not in the tune" (tester report v0.22.0): say which, so it is a choice. */
export function offScaleNote(notes: string[], state: Pick<EngineState, "arp">): string | undefined {
  const { root, scale } = state.arp, steps = SCALES[scale];
  if (!steps || steps.length === 12) return undefined;
  const out = [...new Set(notes.filter((n) => n !== "-" && noteToMidi(n) !== undefined && !steps.includes((((noteToMidi(n)! - root) % 12) + 12) % 12)))];
  return out.length ? `motif notes outside the voice's ${midiToNoteName(root).replace(/-?\d+$/, "")} ${scale.replaceAll("_", " ")}: ${out.join(" ")} (fine if you meant it)` : undefined;
}

function fail(action: string, error: { message: string } | null): never {
  console.error(`mcp ${action} failed:`, error?.message);
  throw new ToolError("server_error", `Could not ${action}. Try again in a moment.`);
}

/** The reading is made with one fixed seed, so the same sound always reads the same (a random pattern would otherwise
 *  give a different note order, and a different reading, on every call). Playback keeps its own random seed. */
const ANALYSIS_SEED = 1;
const randomSeed = () => randomBytes(4).readUInt32BE(0);
const randomMotifId = () => randomBytes(4).readUInt32BE(0) & 0x7fffffff;
const newSessionId = () => randomBytes(18).toString("base64url");

export function mergeClamps(...lists: string[][]): string[] {
  const all = lists.flat().filter((c) => !c.startsWith("…and "));
  return all.length > 5 ? [...all.slice(0, 5), `…and ${all.length - 5} more`] : all;
}

async function resolveSession(db: Db, userId: string, sessionId?: string) {
  if (sessionId) {
    const { data, error } = await db.from("sessions").select("*").eq("id", sessionId).eq("owner_id", userId).maybeSingle();
    if (error) fail("load the session", error);
    if (!data) throw new ToolError("unknown_session", "No session with that id. Call start_session to make one.");
    return { session: data as SessionRow, note: undefined as string | undefined };
  }
  const { data, error } = await db.from("sessions").select("*").eq("owner_id", userId).is("ended_at", null)
    .order("last_active_at", { ascending: false }).limit(1);
  if (error) fail("load the session", error);
  const s = (data ?? [])[0] as SessionRow | undefined;
  if (!s) {
    // the last one ended: say so, as the tool descriptions promise
    const { data: gone } = await db.from("sessions").select("id").eq("owner_id", userId).not("ended_at", "is", null).order("ended_at", { ascending: false }).limit(1);
    if ((gone ?? []).length) throw new ToolError("session_ended", "This session has ended. Call start_session for a new one.");
    throw new ToolError("no_session", "Call start_session first.");
  }
  return { session: s, note: `session_id missing: used ${s.id}` };
}

function assertOpen(s: SessionRow) {
  if (s.ended_at) throw new ToolError("session_ended", "This session has ended. Call start_session for a new one.");
}

async function currentState(db: Db, s: SessionRow): Promise<StateRow | null> {
  if (!s.current_state_id) return null;
  const { data, error } = await db.from("states").select("*").eq("id", s.current_state_id).maybeSingle();
  if (error) fail("load the current state", error);
  return (data as StateRow | null) ?? null;
}

/** Counts listeners. Only the owner's own controls are reported: other listeners can only listen. */
async function presence(db: Db, sessionId: string, ownerId: string, now: number) {
  const since = new Date(now - PRESENCE_WINDOW_MS).toISOString();
  const { data, error } = await db.from("player_heartbeats").select("user_id,audio,volume,seen_at")
    .eq("session_id", sessionId).gte("seen_at", since).order("seen_at", { ascending: false });
  if (error) fail("check who is listening", error);
  const rows = (data ?? []) as Array<{ user_id: string | null; audio: string; volume: number | null }>;
  const pick = rows.find((r) => r.user_id === ownerId && r.volume !== null); // most recent first
  return {
    players: rows.filter((r) => r.audio === "playing").length,
    controls: pick ? { volume: pick.volume as number } : null,
  };
}

/** What the owner pressed and what guests pressed, as the model is told: `guests` is one line of counts (emojis.ts), left out when empty. */
type Said = { reactions: string[]; heard: string[]; guests?: string };

/** Emoji presses from people listening by the link (#152), as one line. They live in their own table, so `claim_reactions` and `heard` never
 *  see them. `claim` marks them delivered (the owner's token: RLS lets only the owner read them); a peek looks at the undelivered ones, and
 *  with `since` also at those another call already claimed from then on (like reactions, for `listen`). Never throws: a press is not worth a failed call. */
async function guestsFor(db: Db, sessionId: string, claim: boolean, now: number, since?: number): Promise<string | undefined> {
  let rows: Array<{ emoji: string; created_at: string }>;
  if (claim) {
    const { data, error } = await db.rpc("claim_emojis", { p_session: sessionId });
    if (error) { console.error("claim_emojis failed:", error.message); return undefined; }
    rows = (data ?? []) as typeof rows;
  } else {
    const base = db.from("emoji_reactions").select("emoji,created_at").eq("session_id", sessionId);
    const q = since === undefined ? base.is("delivered_at", null) : base.or(`delivered_at.is.null,created_at.gte.${new Date(since).toISOString()}`);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) return undefined;
    rows = (data ?? []) as typeof rows;
  }
  return describeEmojis(rows, now);
}

/** Reactions the owner pressed that the model has not been told about. `claim` marks them delivered (set_sound); get_feedback only looks. */
/** What the owner pressed since the last call, split in two. `reactions` steer the sound, and nobody steers Self: there they are claimed
 *  and dropped (never shown, and they do not surface after a later switch). The player shows those buttons only in the listener modes;
 *  this also covers a row written straight through the API. `heard` ("What I heard", #129) is how the sound read to the listener: it
 *  never steers, so it comes back in every mode, Self included. */
/** `since` (peek only): also return presses made from then on that another call already marked read, so `listen` sees a press a final call
 *  sent in the same batch claimed (tester report v0.22.0). */
async function reactionsFor(db: Db, session: { id: string; owner_id: string }, claim: boolean, now: number, face: Face, since?: number): Promise<Said> {
  const sessionId = session.id;
  const guests = await guestsFor(db, sessionId, claim, now, since); // information, like heard: in every mode, and it never breaks the call
  let rows: Array<{ kind: string; created_at: string; user_id?: string | null }>;
  if (claim) {
    const { data, error } = await db.rpc("claim_reactions", { p_session: sessionId });
    if (error) { console.error("claim_reactions failed:", error.message); return { reactions: [], heard: [], ...(guests ? { guests } : {}) }; } // never break a call over a reaction
    rows = (data ?? []) as typeof rows;
  } else {
    const base = db.from("reactions").select("kind,created_at,user_id").eq("session_id", sessionId);
    const q = since === undefined ? base.is("delivered_at", null) : base.or(`delivered_at.is.null,created_at.gte.${new Date(since).toISOString()}`);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(50);
    if (error) return { reactions: [], heard: [], ...(guests ? { guests } : {}) };
    rows = (data ?? []) as typeof rows;
  }
  return {
    reactions: forListener(face) ? describeReactions(rows.filter((r) => !isHeard(r.kind)), now) : [],
    heard: describeReactions(rows.filter((r) => isHeard(r.kind) && r.user_id === session.owner_id), now), // the owner's only: a link listener's reading is claimed and dropped
    ...(guests ? { guests } : {}),
  };
}

/** The fade is the owner's setting (shared with Claude): tell the model when a call arrives after it happened. */
function restInfo(prev: StateRow | null, settings: ListenerSettings, now: number, face: Face = "internal"): { resting: boolean; notes: string[] } {
  const rest = effectiveRestAfter(settings.rest_after, face); // the listener modes never fade
  if (!prev || rest === null || !isResting(prev.created_at, rest, now)) return { resting: false, notes: [] };
  return { resting: true, notes: [restingNote(rest)] };
}

const faceOf = (s: { mode?: string }): Face => normalizeFace(s.mode);

/** Told to the model on a final call while the owner's "Live tuning" switch is on: mode guidance reaches it only at the start or on a change, so a running session learns of the switch here. */
function liveNote(settings: ListenerSettings, face: Face, final: boolean): string | undefined {
  if (!final || !forListener(face) || !settings.live) return undefined;
  return "live tuning is on: the listener wants their buttons to reach you now. Once all your text is written and this final call has returned, call listen as your last call (never in the same batch); answer what it returns with one final set_sound (or strudel_mode while Strudel plays), then listen again, until it says idle. Text before a tool call can be folded away in the chat: ask any question after the last listen";
}

/** Lazy guidance: what to do with the rules of a mode, given the mode whose rules the model last received (`guided`, null for
 *  sessions from before the column) and the mode this call ends in. Pure, so it is tested without a database. */
export function guidanceUpdate(i: { guided: Face | null; face: Face; switched: boolean }): { send: boolean; ownerChanged: boolean; store: Face | null } {
  if (i.guided === null) return { send: false, ownerChanged: false, store: i.face };
  if (i.guided === i.face) return { send: false, ownerChanged: false, store: null };
  return { send: true, ownerChanged: !i.switched, store: i.face };
}

/** Once the final mode of a call is known: attach the rules of that mode if the model has not had them, and remember it (caller's client, RLS). */
async function guide(db: Db, session: SessionRow, face: Face, switched: boolean): Promise<{ guidance?: string; note?: string }> {
  const u = guidanceUpdate({ guided: session.guided_mode ? normalizeFace(session.guided_mode) : null, face, switched });
  if (u.store !== null) {
    const { error } = await db.from("sessions").update({ guided_mode: u.store }).eq("id", session.id);
    if (error) fail("save the mode", error);
  }
  if (!u.send) return {};
  return { guidance: modeGuidance(face, parsePolicy(session.mode_policy)), ...(u.ownerChanged ? { note: `the owner switched the mode to ${faceName(face)}` } : {}) };
}

const withGuidance = (fb: Record<string, unknown>, g: { guidance?: string }): Record<string, unknown> => (g.guidance ? { ...fb, guidance: g.guidance } : fb);

/** Apply a `mode` sent with set_sound: an owner lock stops it; otherwise the face changes and the change is logged. */
async function switchFace(db: Db, session: SessionRow, requested: Face | undefined, stateTurn: number, now: number): Promise<{ face: Face; note?: string }> {
  const current = faceOf(session), policy = parsePolicy(session.mode_policy);
  if (requested === undefined) return { face: current };
  const d = decideSwitch({ policy, current, requested });
  if (d.change === null) return { face: current, note: d.note };
  const { error: e1 } = await db.from("sessions").update({ mode: d.change }).eq("id", session.id);
  if (e1) fail("switch the face", e1);
  const { error: e2 } = await db.from("mode_changes").insert({ session_id: session.id, turn: stateTurn, to_mode: d.change, by: "model", created_at: new Date(now).toISOString() });
  if (e2) console.error("mode_changes insert failed:", e2.message); // the log only: the switch itself worked
  return { face: d.change, note: `switched to ${faceName(d.change)}: say so in one short sentence` };
}

type Compact = { sound: Record<string, unknown>; reads_as: Record<string, number>; why?: Record<string, { low: string; high: string }> };

/** The most one call may raise the loudness of the sound (dB). Going down is never limited. */
const LEVEL_STEP_DB = 4;
/** How long after strudel_mode off the pattern counts as what the listener just heard, for the pace hold of a switch into Attuned (#170). */
const PATTERN_HEARD_MS = 30_000;

/** Step rates from slowest to busiest, for holding the pace on a switch into Attuned. */
const RATE_ORDER: EngineState["arp"]["rate"][] = ["1/4", "1/8", "1/8t", "1/16"];

/** Measure what the state sounds like. It must never break a call: on any failure the feedback just has no reading. */
const LEVEL_PRESS_DB = 3, LEVEL_FLOOR_DB = -12;
/** Self plays at the usual level and the listener modes at the listener's: say so when a mode change moves it (v0.23.5 report). */
function levelSwitchNote(prev: StateRow | null | undefined, now: EngineState): string | undefined {
  const was = prev?.effective.listenerDb ?? 0, is = now.listenerDb ?? 0;
  if (was === is) return undefined;
  return is === 0 ? `level: Self plays at the usual level; the listener's ${was} dB comes back in a listener mode` : `level: the listener's ${is} dB applies again`;
} // 2 dB was heard but felt small (v0.23.5 report): 3 dB a press, four presses to the floor
const dbGain = (db: number) => 10 ** (db / 20);

function measureState(effective: EngineState, seed: number): Compact | null {
  try {
    if (effective.volume <= 0) return null;
    // read the sound itself: not where its step counters happen to be on the shared timeline, nor a tempo glide still in progress,
    // which would change which notes a random pattern plays in the measured window
    // The listener's level (#170) is theirs: reads_as reads the sound at the usual level, so a quieter setting does not read as calmer and
    // the model does not correct for something it cannot change. Loudness scales exactly with the gain, so loudness_db is shifted back.
    const lvl = effective.listenerDb ?? 0;
    const steady: EngineState = { ...effective, volume: lvl < 0 ? effective.volume / dbGain(lvl) : effective.volume, grid: { arp: 0, bass: 0 } };
    const a = analyze(steady, seed);
    return { sound: lvl < 0 ? { ...a.sound, loudness_db: a.sound.loudness_db + Math.round(lvl) } : a.sound, reads_as: a.reads_as, why: a.why };
  } catch (e) {
    console.error("analysis failed:", e);
    return null;
  }
}

/** Sound reaches the listener before anything can be softened: one call may raise the level by at most `stepDb`. A bigger jump is
 *  held down to that step (the master volume of `effective` is scaled, for this state only); it rises further on the next call.
 *  Returns the reading of what plays after the hold, and a note when it held. */
function holdLevel(effective: EngineState, prev: StateRow | null, analysis: Compact | null, stepDb: number, asked?: "softer" | "calmer"): { analysis: Compact | null; note?: string } {
  const wasDb = prev?.intent.owner_silenced ? undefined : prev?.analysis?.sound.loudness_db, nowDb = analysis?.sound.loudness_db;
  if (typeof wasDb !== "number" || typeof nowDb !== "number" || nowDb - wasDb <= stepDb) return { analysis };
  // the readings are rounded to whole dB, so the held sound can still read one above the step: tighten once more if so
  for (let i = 0, over = nowDb - wasDb - stepDb; i < 3 && over > 0; i++) {
    effective.volume = Math.max(0.05, effective.volume * 10 ** (-over / 20));
    analysis = measureState(effective, ANALYSIS_SEED);
    const again = analysis?.sound.loudness_db;
    over = typeof again === "number" ? again - wasDb - stepDb : 0;
  }
  if (asked) return { analysis, note: `level ${stepDb < 0 ? "lowered" : "held"}: the listener asked for ${asked}, so this sound plays ${stepDb < 0 ? `${-stepDb} dB below` : "no louder than"} your last (it would have been ${Math.round(nowDb - wasDb)} dB ${nowDb >= wasDb ? "louder" : "quieter"})` };
  return { analysis, note: `level held: this sound would have been ${Math.round(nowDb - wasDb)} dB louder than your last, so it was kept to ${stepDb ? `+${stepDb} dB` : "the same level (the first sound of a switch to Attuned starts no louder than what played)"}; send again to go further` };
}

/** The presses a call answers: the ones it delivers now (still pending: the normal path, they show in its own `reactions`) and the ones
 *  pressed after the last state and delivered through listen. A press made before the last state was pending then, so that state already
 *  answered it (v0.23.3 report: the rule fired one call late, and twice). Listener modes only; never breaks a call. */
async function answeredPresses(db: Db, sessionId: string, prev: StateRow | null): Promise<Record<"softer" | "calmer" | "harsher" | "stormier", number>> {
  const n = { softer: 0, calmer: 0, harsher: 0, stormier: 0 };
  if (!prev) return n;
  try {
    const { data, error } = await db.from("reactions").select("kind").eq("session_id", sessionId).in("kind", Object.keys(n))
      .or(`delivered_at.is.null,created_at.gt.${new Date(prev.created_at).toISOString()}`).limit(50);
    if (error || !data) return n;
    for (const r of data as Array<{ kind: keyof typeof n }>) if (r.kind in n) n[r.kind]++;
  } catch { /* never break a call over a reaction */ }
  return n;
}

/** The listener's level (#170): each "softer" lowers it 2 dB and it holds, down to -10 dB; each "harsher" or "stormier" raises it 2 dB back
 *  toward 0. Only the listener's presses move it: the model has no volume. A "softer" also keeps that call at least 2 dB under the last one,
 *  and a "calmer" keeps it no louder (holdLevel), since a calmer mood carries its own sound, which can measure louder. */
function listenerLevel(was: number | undefined, p: Record<"softer" | "calmer" | "harsher" | "stormier", number>) {
  const from = was ?? 0, raise = p.harsher + p.stormier;
  const to = Math.min(0, Math.max(LEVEL_FLOOR_DB, from - LEVEL_PRESS_DB * p.softer + LEVEL_PRESS_DB * raise));
  const why = p.softer && raise ? "softer and louder presses" : p.softer ? "softer" : p.harsher ? "harsher" : "stormier";
  const note = to < from ? `level: the listener asked for ${why}, so everything plays ${from - to} dB lower from now on (${to} dB in all, ${LEVEL_FLOOR_DB} at most). Only their presses raise it again (harsher or stormier); you cannot`
    : to > from ? `level: the listener's ${why} raised the level ${to - from} dB (${to === 0 ? "back to the usual level" : `${to} dB in all`})`
    : p.softer && from <= LEVEL_FLOOR_DB ? `level: the listener asked for softer, but the level is at its lowest (${LEVEL_FLOOR_DB} dB): their volume slider goes further` : undefined;
  // at the floor a softer cannot hold any lower: that call is kept no louder, instead of dipping once and rising on the next
  const asked: "softer" | "calmer" | undefined = p.softer && to < from ? "softer" : p.softer || p.calmer ? "calmer" : undefined;
  return { db: to, note, asked };
}

/** The tempo glides over the transition (a linear ramp, the same on every device: engine/src/ramp.ts). Say so when it changed. */
function tempoNote(prev: StateRow | null | undefined, now: EngineState, at: number): string | undefined {
  if (!prev) return undefined;
  if (!tempoHeard(prev, at)) return undefined; // the state before was silent, or the start_session placeholder: its tempo was not heard, so this one starts at its own, with no glide
  const a = Math.round(prev.effective.arp.tempo), b = Math.round(now.arp.tempo);
  if (a === b) return undefined;
  const t = now.transition, glides = t.curve !== "sudden" && t.time >= 0.5 && !(t.delay && t.delay > 0);
  return glides ? `tempo ${a} to ${b}: it glides over ${Math.round(t.time * 10) / 10} s` : `tempo ${a} to ${b}: it changes at once when this state starts (the transition is sudden or very short)`;
}

/** Synth settings last one call, except the ones the session keeps (stack, pad, LFOs). When the last call set some and this one does not,
 *  the mood's values come back: say which moved, so the model does not undo a listener's request by accident (v0.23.2 report). */
function expiredNote(prev: StateRow | null | undefined, now: EngineState, fields: string[]): string | undefined {
  const before = (prev?.intent.overridden ?? []).filter((f) => !f.includes(":") && !/^(osc\.stack|pad\.|lfo)/.test(f));
  const at = (s: EngineState, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], s);
  // whole numbers from 10 up (tempo, cutoff), like the tempo note and playing; two decimals below (resonance, levels)
  const fmt = (v: unknown) => (typeof v === "number" ? String(Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 100) / 100) : typeof v === "string" || typeof v === "boolean" ? String(v) : null);
  const moved = before.filter((f) => !fields.includes(f)).flatMap((f) => {
    const a = fmt(at(prev!.effective, f)), b = fmt(at(now, f));
    return a !== null && b !== null && a !== b ? [`${f} ${a} to ${b}`] : [];
  });
  return moved.length ? `your last synth settings lasted one call, so the mood's values are back: ${moved.join(", ")}. Send them in synth again to keep them` : undefined;
}

/** The arpeggio's rate steps through the straight rates in between over the glide (engine/src/ramp.ts): say so, like the tempo note. */
function rateNote(now: EngineState): string | undefined {
  const from = steppedFromRate(now);
  if (!from) return undefined;
  const path = ratePath(from, now.arp.rate);
  return `rate ${from} to ${now.arp.rate}: it steps${path.length > 2 ? ` through ${path.slice(1, -1).join(", ")}` : ""} over ${Math.round((now.grid?.glide ?? 0) * 10) / 10} s`;
}

/** Without a voice of its own, scale, root and wave follow the mood and move from call to call: say so when they did. */
function voiceNote(prev: StateRow | null | undefined, now: EngineState, voice: Voice | null | undefined, held: boolean, adopted = false): string | undefined {
  if (adopted) return "your first sound is now your voice: root, note order and octaves stay. Its scale mode follows your joy (phrygian low, dorian middle, lydian high) and its wave follows your warmth (square, sawtooth, triangle, sine) until you send a voice";
  if (held) return "voice kept: scale, root, note order and wave now stay until you send a voice";
  if (!prev || (voice && voice.scale && voice.wave && voice.root)) return undefined;
  const a = prev.effective, name = (s: EngineState) => `${midiToNoteName(s.arp.root)} ${s.arp.scale}, ${s.osc.wave}`;
  const from = name(a), to = name(now);
  return from === to ? undefined : `no full voice: the mood moved the voice from ${from} to ${to}. Send keep_voice to hold it`;
}

/** Mapped from the (stretched) mood, then the session's voice, then what the session keeps (stack, pad, LFOs), then the
 *  call's own synth override. */
function mapSound(sessionId: string, mood: Mood, slow: Mood, voice: Voice | null | undefined, sticky: Sticky | null | undefined, synth: SetSoundInput["synth"]) {
  const mapped = moodToEngineState(mood, slow, voiceSeedOf(sessionId));
  const a = applyOverride(alignToVoice(mapped, voice), voiceToSynth(voice));
  const k = applyOverride(a.state, stickyToSynth(sticky));
  const b = applyOverride(k.state, callSynth(synth));
  return { state: b.state, overridden: [...new Set([...a.overridden.map((f) => `voice:${f}`), ...k.overridden.map((f) => `kept:${f}`), ...b.overridden])] };
}

async function insertState(
  db: Db,
  at: number,
  row: { session_id: string; turn: number; final: boolean; intent: unknown; effective: EngineState; clamps: string[]; seed: number; slow_mood: Mood; analysis?: Compact | null },
) {
  // created_at comes from this server's clock, so the rate-limit and new-turn checks compare one clock
  const { data, error } = await db.from("states").insert({ ...row, created_at: new Date(at).toISOString() }).select("id").single();
  if (error || !data) fail("save the sound", error);
  return data.id as string;
}

function feedbackFor(state: StateRow, p: Awaited<ReturnType<typeof presence>>, notes: string[] = [], resting = false, said: Said = { reactions: [], heard: [] }, mode?: string) {
  // states written before the analysis existed have none: measure them now (the engine is deterministic)
  const analysis = state.effective.engine === "strudel" ? null : state.analysis ?? measureState(state.effective, 1);
  return buildFeedback({
    turn: state.turn, intent: state.intent.mood ?? NEUTRAL_MOOD, effective: state.effective, clamps: state.clamps ?? [],
    players: p.players, controls: p.controls, notes, resting, analysis, ...said, mode,
  });
}

export async function startSession(db: Db, userId: string, input: { title?: string; voice?: Voice; mode?: "auto" | "self" | "attuned" | "jukebox" | "internal" | "external" | "sandbox" | "inner" | "outer" }, now = Date.now()) {
  // keep at most 10 active sessions: end the oldest
  const { data: active, error: aerr } = await db.from("sessions").select("id").eq("owner_id", userId).is("ended_at", null)
    .order("last_active_at", { ascending: false });
  if (aerr) fail("check your sessions", aerr);
  for (const old of (active ?? []).slice(MAX_ACTIVE_SESSIONS - 1)) {
    const { error } = await db.from("sessions").update({ ended_at: new Date(now).toISOString() }).eq("id", old.id);
    if (error) console.error("ending an old session failed:", error.message);
  }
  // a session with no sound for a week is over (roadmap: sessions lifecycle); done here so no scheduled job is needed
  const { error: eerr } = await db.from("sessions").update({ ended_at: new Date(now).toISOString() }).eq("owner_id", userId).is("ended_at", null)
    .lt("last_active_at", new Date(now - ENDED_AFTER_S * 1000).toISOString());
  if (eerr) console.error("ending stale sessions failed:", eerr.message);

  const { data: profile } = await db.from("profiles").select("default_settings").eq("id", userId).maybeSingle();
  // a session starts on the internal mode unless the listener asked for sound; it is on auto until the owner locks a face
  const mode: Face = input.mode === "auto" || input.mode === undefined ? "internal" : normalizeFace(input.mode);
  const settings: ListenerSettings = parseSettings(profile?.default_settings ?? {});
  const id = newSessionId();

  const { error: serr } = await db.from("sessions").insert({
    id, owner_id: userId, title: input.title?.slice(0, 80) ?? null, settings, last_active_at: new Date(now).toISOString(),
    voice: input.voice ?? null, mode, guided_mode: mode,
  });
  if (serr) fail("start the session", serr);
  const { error: lerr } = await db.from("listeners").insert({ session_id: id, user_id: userId, role: "owner", label: "you" });
  if (lerr) fail("start the session", lerr);

  const { state: mapped } = mapSound(id, NEUTRAL_MOOD, NEUTRAL_MOOD, input.voice, null, undefined);
  const { effective, clamps } = applyLimits({ mapped });
  effective.grid = nextGrid(null, now);
  const stateId = await insertState(db, now, {
    session_id: id, turn: 0, final: true, intent: { mood: NEUTRAL_MOOD, initial: true }, effective,
    clamps: mergeClamps(clamps), seed: randomSeed(), slow_mood: NEUTRAL_MOOD,
  });
  const { error: uerr } = await db.from("sessions").update({ current_state_id: stateId }).eq("id", id);
  if (uerr) fail("start the session", uerr);

  return {
    session_id: id,
    player_url: `${publicBaseUrl()}/s/${id}`,
    version: appVersion(), // the release this server runs, so a stale deploy shows at once (v0.19.2 tests)
    mode: faceLine(mode, "auto"),
    guidance: startGuidance(mode, "auto"),
    note: forListener(mode)
      ? "Give player_url to the user in your final reply text, after your last tool call of this turn (text between tool calls may be hidden), and tell them to open it and tap Start listening. Pass session_id in every call."
      : "Give player_url to the user in one short sentence in your final reply text, after your last tool call of this turn (text between tool calls may be hidden), and say nothing more about the sound. Pass session_id in every call.",
  };
}

/** `now` is injectable so tests control the clock. */
export async function setSound(db: Db, userId: string, input: SetSoundInput, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const settings = parseSettings(session.settings);
  const prev = await currentState(db, session);

  // rate limits
  if (prev && now - new Date(prev.created_at).getTime() < MIN_GAP_MS) throw new ToolError("too_fast", "Wait a moment between updates.");
  const { count, error: cerr } = await db.from("states").select("id", { count: "exact", head: true })
    .eq("session_id", session.id).gte("created_at", new Date(now - 60_000).toISOString());
  if (cerr) fail("check the update rate", cerr);
  if ((count ?? 0) >= MAX_PER_MINUTE) throw new ToolError("too_fast", "Too many updates this minute. Send fewer, and make the final one count.");

  const turn = planTurn(prev, input.final, now);
  const faceNow = faceOf(session);
  // before this call's own state is saved, so that the message in progress does not count as a finished one
  const sw = await switchFace(db, session, input.mode === undefined ? undefined : normalizeFace(input.mode), turn.stateTurn, now);
  // the axes are stretched (instances send 0.4 to 0.7); nothing else limits the mood
  const switched = sw.face !== faceNow;
  // the owner moved the session to Self from a listener mode: the mood played for the listener is not the model's own state, so it does not carry over
  const guidedMode = session.guided_mode ? normalizeFace(session.guided_mode) : null;
  const ownerToSelf = !switched && sw.face === "internal" && ((guidedMode !== null && forListener(guidedMode)) || Boolean(prev?.intent.owner_silenced)); // owner_silenced: the lock wrote a silent copy (0017), even if another call already took the new guidance
  const sentMood = input.mood ?? (ownerToSelf ? NEUTRAL_MOOD : prev?.intent.mood ?? NEUTRAL_MOOD); // no mood: the last one stays
  // Strudel is on: set_sound never changes the engine. Only the picture, the title and the fade setting apply; the synth stays paused.
  if (prev?.effective.engine === "strudel" && forListener(sw.face)) return setWhileStrudel(db, session, prev, input, turn, now, sw.note, note, sw.face, switched);
  // the phrase for this call (the synth path only: with Strudel on, it was handled above): resolved before anything is saved, so an unknown name is an error, not a half call
  const motif = input.motif ? resolveMotif(session, input.motif, turn.stateTurn, now) : undefined;
  const mood = stretchMood(sentMood);
  const slow = nextSlowMood(ownerToSelf ? undefined : prev?.slow_mood, mood, input.final);

  // a new voice replaces the old one for good; it is a big change, so without a transition of its own it gets a long one
  let voice = input.voice !== undefined ? input.voice : session.voice;
  // keep_voice: freeze what plays now as the voice, so the mood stops redrawing it. The notes are the same, so no long transition.
  let held = false;
  if (input.keep_voice && input.voice === undefined && prev) {
    const e = prev.effective.arp;
    voice = { root: midiToNoteName(e.root), scale: e.scale, chord: e.chord.slice(0, 8), pattern: e.pattern, octaves: e.octaves, wave: prev.effective.osc.wave, ...(session.voice ?? {}) };
    held = true;
  }

  // colour, stack, pad and LFOs stay until Claude changes them (like the voice); fold this call into what the session keeps
  const sticky = mergeSticky(session.sticky, input);
  // A voice the model sends (or freezes) is fixed for good, scale and wave included. Without one, the first sound becomes the voice:
  // root, chord, note order and octaves stay; the scale mode follows joy in three bands (voice-band.ts) and the wave follows warmth in
  // four, so a mood that barely moves cannot move the key, a big joy change can still lift or lower the colour of the sound, and warmth
  // can still change the timbre (the wave is what carries it).
  const explicit = input.voice !== undefined || held;
  if (explicit) { delete sticky.voiceBand; delete sticky.waveBand; }
  const complete = (v: typeof voice) => Boolean(v && v.root && v.scale && v.wave);
  let scaleMoved = false, waveMoved = false, bandNote: string | undefined, waveNote: string | undefined;
  if (!explicit && sticky.voiceBand && complete(voice)) {
    const band = nextBand(sticky.voiceBand, mood.joy);
    if (band !== sticky.voiceBand) {
      bandNote = `your joy moved the mode of your voice from ${voice!.scale} to ${BAND_SCALE[band]} (root and note order unchanged)`;
      voice = { ...voice!, scale: BAND_SCALE[band] }; sticky.voiceBand = band; scaleMoved = true;
    }
    if (sticky.waveBand) {
      const wave = nextWaveBand(sticky.waveBand, mood.warmth);
      if (wave !== sticky.waveBand) {
        waveNote = `your warmth moved the wave of your voice from ${sticky.waveBand} to ${wave} (root, scale and note order unchanged)`;
        voice = { ...voice!, wave }; sticky.waveBand = wave; waveMoved = true;
      }
    }
  }
  // a new voice, or a new mode, is a big change: without a transition of its own it gets a long one
  const transition = (input.voice !== undefined || scaleMoved || waveMoved) && !input.transition ? { curve: "smooth" as const, time: 8 } : input.transition;
  // the call after a pace hold may move on, but a big tempo step out of the hold glides over 10 s, not the default 4 (v0.23.5 report: 76 to 142 in 4 s)
  const afterHold = Boolean(prev?.clamps?.some((c) => c.startsWith("pace held")));
  let { state: overridden, overridden: fields } = mapSound(session.id, mood, slow, voice, sticky, input.synth);
  let adopted = false;
  if (!complete(voice)) {
    const a = overridden.arp;
    const drawn = { root: midiToNoteName(a.root), scale: a.scale, chord: a.chord.slice(0, 8), pattern: a.pattern, octaves: a.octaves, wave: overridden.osc.wave };
    if (explicit) voice = { ...drawn, ...(voice ?? {}) }; // a partial voice the model sent: the rest is drawn once and kept
    else {
      sticky.voiceBand = nextBand(undefined, mood.joy);
      const follows = !voice?.wave; // a wave from start_session is the model's own: it stays
      if (follows) sticky.waveBand = nextWaveBand(undefined, mood.warmth);
      voice = { ...drawn, ...(voice ?? {}), scale: BAND_SCALE[sticky.voiceBand], ...(follows ? { wave: sticky.waveBand } : {}) };
      ({ state: overridden, overridden: fields } = mapSound(session.id, mood, slow, voice, sticky, input.synth)); // this call already plays the banded mode
    }
    adopted = true;
  }
  overridden.colour = applyColour(overridden.colour, sticky.colour);
  // the listener's level: the presses this call answers move it, and it holds (#170)
  // In Self nobody steers and there are no buttons to raise it again, so Self plays at the usual level; the level waits for the next listener mode.
  const lv = forListener(sw.face) ? listenerLevel(sticky.levelDb, await answeredPresses(db, session.id, prev)) : { db: 0, note: undefined, asked: undefined };
  if (forListener(sw.face)) { if (lv.db < 0) sticky.levelDb = lv.db; else delete sticky.levelDb; }
  overridden.volume *= dbGain(lv.db);
  if (lv.db < 0) overridden.listenerDb = lv.db;
  const { effective, clamps } = applyLimits({
    mapped: overridden, transition,
  });
  const allClamps = mergeClamps(clamps);
  if (afterHold && !input.transition && prev && effective.arp.tempo > prev.effective.arp.tempo * 1.25) effective.transition = { time: 10, curve: "smooth" };
  // The call that switches into Attuned is the first sound made for the listener: like the level (below), it is no faster and no busier
  // than what they hear now. Tempo, step rate and note density are held at what played; the model can move them on its next calls.
  // Just after Strudel (strudel_mode off, within PATTERN_HEARD_MS), what they heard was the pattern: its tempo is the one to hold to (#170).
  const patternBpm = prev?.intent.strudel_off && prev.intent.from_bpm && now - new Date(prev.created_at).getTime() < PATTERN_HEARD_MS ? prev.intent.from_bpm : undefined;
  if (switched && sw.face === "external" && prev && (tempoHeard(prev, now) || patternBpm !== undefined)) {
    const synthHeard = tempoHeard(prev, now);
    const was = prev.effective.arp, held: string[] = [];
    const wasTempo = synthHeard ? was.tempo : patternBpm!;
    if (effective.arp.tempo > wasTempo + 0.5) { held.push(`tempo ${Math.round(effective.arp.tempo)} to ${Math.round(wasTempo)} bpm${synthHeard ? "" : ", the tempo of the Strudel pattern that just played; its step rate and density cannot be compared with the synth's, so only the tempo is held"}`); effective.arp.tempo = wasTempo; }
    if (synthHeard && RATE_ORDER.indexOf(effective.arp.rate) > RATE_ORDER.indexOf(was.rate)) { held.push(`rate ${effective.arp.rate} to ${was.rate}`); effective.arp.rate = was.rate; }
    if (synthHeard && effective.arp.density > was.density + 0.01) { held.push(`density ${effective.arp.density.toFixed(2)} to ${was.density.toFixed(2)}`); effective.arp.density = was.density; }
    if (held.length) allClamps.push(`pace held: the first sound of a switch to Attuned is no faster or busier than what played (${held.join(", ")}); reads_as reads the held sound, so its calm is higher than sent: do not correct for that. If the listener asked for more energy, send it again now with a transition of 8 s or more, so it rises to the pace they asked for`);
  }
  effective.grid = nextGrid(prev, now, effective); // where the step grids are on the shared timeline when this state starts

  const seed = randomSeed();
  let analysis = measureState(effective, ANALYSIS_SEED);
  // The call that switches into Attuned raises nothing: the listener hears the first sound made for them, so it starts no louder than what played.
  // The call that answers a "softer" is at least 2 dB under the last sound; one that answers a "calmer", no louder.
  const asked = lv.asked;
  const stepDb = Math.min(switched && sw.face === "external" ? 0 : LEVEL_STEP_DB, asked === "softer" ? -LEVEL_PRESS_DB : asked === "calmer" ? 0 : Infinity);
  const level = holdLevel(effective, prev, analysis, stepDb, asked && stepDb <= 0 ? asked : undefined);
  analysis = level.analysis;
  if (level.note) allClamps.push(level.note); // a safety rule changed what was sent, so it shows in clamped (and in inspect), not only in the notes
  // the phrase is not sticky: only the call that sends it carries it (each call builds its state from the mood, not from the last state)
  if (motif && input.motif) {
    effective.motif = { id: randomMotifId(), notes: motif.notes.map((n) => (n === "-" ? -1 : noteToMidi(n) ?? -1)), beats: motif.beats, repeat: input.motif.repeat ?? 1, level: Math.min(1, input.motif.level ?? 0.6) };
  }
  const stateId = await insertState(db, now, {
    session_id: session.id, turn: turn.stateTurn, final: input.final,
    intent: { mood: sentMood, synth: input.synth, colour: input.colour, transition: input.transition, note: input.note, overridden: fields, ...(motif ? { motif: { name: motif.label } } : {}) },
    effective, clamps: allClamps, seed, slow_mood: slow, analysis,
  });
  const title = input.title?.trim().slice(0, 80);
  const { error: uerr } = await db.from("sessions").update({
    current_state_id: stateId, last_active_at: new Date(now).toISOString(), pending_final: !input.final,
    turn: turn.sessionTurn(session.turn), ...(title ? { title } : {}),
    ...(input.voice !== undefined || held || adopted || scaleMoved || waveMoved ? { voice } : {}),
    ...(motif?.store ? { motifs: motif.store } : {}),
    sticky,
  }).eq("id", session.id);
  if (uerr) fail("save the session", uerr);

  const rest = restInfo(prev, settings, now, faceNow);
  const notes = [note, sw.note, motif?.store ? `motif kept as "${motif.label}"` : undefined, motif && effective.motif ? offScaleNote(motif.notes, effective) : undefined, prev?.effective.engine === "strudel" ? "Strudel stopped: the synth plays this state (Self has no code)" : undefined, turn.missedFinal ? "no final update last turn" : undefined, voiceNote(prev, effective, voice, held, adopted), bandNote, waveNote, input.mood ? undefined : ownerToSelf ? "the owner switched to Self: the mood you played for the listener was dropped. Send your own state" : "mood kept from your last call", tempoNote(prev, effective, now), rateNote(effective), expiredNote(prev, effective, fields), lv.note ?? levelSwitchNote(prev, effective), analysis ? undefined : "analysis unavailable this time", ...rest.notes, liveNote(settings, sw.face, input.final)].filter((x): x is string => Boolean(x));
  const p = await presence(db, session.id, session.owner_id, now);
  const said = await reactionsFor(db, session, true, now, sw.face);
  const g = await guide(db, session, sw.face, switched);
  if (g.note) notes.push(g.note);
  return withGuidance(buildFeedback({ turn: turn.stateTurn, intent: sentMood, effective, clamps: allClamps, players: p.players, controls: p.controls, notes, resting: rest.resting, analysis, ...said, mode: faceLine(sw.face, parsePolicy(session.mode_policy)) }), g);
}

/** What the model is told when `save_moment` (migration 0027) refuses: the code is the text after "saved_moment: " in the error. */
export function saveMomentError(message: string): ToolError | null {
  switch (/saved_moment: (\w+)/.exec(message)?.[1]) {
    case "ai_too_soon": return new ToolError("ai_too_soon", "You saved one on your own less than 5 messages ago. The listener can still save from the player, or ask you to.");
    case "saves_full": return new ToolError("saves_full", "The owner has 200 saved moments, the limit. They can delete some in Saved.");
    case "too_fast": return new ToolError("too_fast", "Too many saves this minute. Try again in a minute.");
    case "nothing_playing": return new ToolError("nothing_playing", "Nothing is playing to save: the sound is silent. Call set_sound first.");
    case "bad_input": return new ToolError("bad_input", "save_moment needs a name of 1 to 40 characters.");
    case "not_owner": return new ToolError("unknown_session", "No session with that id. Call start_session to make one.");
    default: return null;
  }
}

/** Keep the sound and picture playing now as a keepsake outside the session (#151): a public link, frozen, copied on the server by the
 *  `save_moment` function. It plays nothing and is not a sound update. Its own tool, apart from `moment` (the in-session memory). */
export async function saveMoment(db: Db, userId: string, input: { session_id?: string; name: string; listener_asked?: boolean }) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  if (!input.name?.trim()) throw new ToolError("bad_input", "save_moment needs a name of 1 to 40 characters.");
  if (!(await currentState(db, session))) throw new ToolError("no_state", "The session has no sound yet. Call set_sound first.");
  const { data, error } = await db.rpc("save_moment", { p_session: session.id, p_name: input.name, p_by: input.listener_asked ? "human" : "ai", p_voice_seed: voiceSeedOf(session.id), p_app_version: appVersion() });
  if (error) {
    const refused = saveMomentError(error.message);
    if (refused) throw refused;
    fail("save the moment", error);
  }
  const saved = data as { id: string; name: string; saved_by: "human" | "ai"; already: boolean };
  // already: this exact moment was saved before; nothing new was written, the first save comes back
  return { saved: saved.name, by: saved.saved_by === "human" ? "listener" : "you", url: `${publicBaseUrl()}/m/${saved.id}`, ...(saved.already ? { already: true } : {}), ...(note ? { notes: [note] } : {}) };
}

/** The model's musical memory: keep the sound and picture playing now under a name, bring it back later, or list the names. */
export async function moment(db: Db, userId: string, input: { session_id?: string; action: "keep" | "recall" | "list"; name?: string; transition?: Transition; final: boolean }, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const kept = session.moments ?? {};
  const names = Object.keys(kept).sort((a, b) => kept[a].kept_at.localeCompare(kept[b].kept_at)); // jsonb does not keep the order of keys

  if (input.action === "list") {
    const savedMotifs = session.motifs ?? {};
    const motifList = motifNames(savedMotifs).map((n) => ({ name: n, notes: savedMotifs[n].notes.join(" "), turn: savedMotifs[n].turn }));
    return {
      moments: names.map((name) => {
        const m = kept[name];
        return { name, turn: m.turn, kept_s_ago: Math.max(0, Math.round((now - new Date(m.kept_at).getTime()) / 1000)), ...(m.note ? { note: m.note } : {}), engine: m.effective.engine === "strudel" ? "strudel" : "synth" };
      }),
      ...(motifList.length ? { motifs: motifList } : {}),
      ...(note ? { notes: [note] } : {}),
    };
  }
  const name = input.name;
  if (!name) throw new ToolError("bad_input", `${input.action} needs a name.`);
  const prev = await currentState(db, session);
  if (!prev) throw new ToolError("no_state", "The session has no sound yet. Call set_sound first.");

  if (input.action === "keep") {
    const isNew = !Object.hasOwn(kept, name);
    if (isNew && names.length >= MAX_MOMENTS) throw new ToolError("moments_full", "Twelve moments are kept. Keep this one under a name you already used to replace it.");
    const m: Moment = {
      kept_at: new Date(now).toISOString(), turn: prev.turn, effective: JSON.parse(JSON.stringify(prev.effective)), intent_mood: prev.intent.mood ?? null,
      analysis: prev.analysis ?? null, sticky: session.sticky ?? null, voice: session.voice ?? null, ...(prev.intent.note ? { note: prev.intent.note } : {}),
    };
    const { error } = await db.from("sessions").update({ moments: { ...kept, [name]: m } }).eq("id", session.id);
    if (error) fail("keep the moment", error);
    return { kept: name, turn: m.turn, moments: isNew ? [...names, name] : names, ...(note ? { notes: [note] } : {}) };
  }

  // recall
  if (!Object.hasOwn(kept, name)) throw new ToolError("unknown_moment", `No moment named "${name}". Kept: ${names.length ? names.join(", ") : "none"}.`);
  const m = kept[name];
  const face = faceOf(session);
  if (m.effective.engine === "strudel" && (!forListener(face) || session.allow_code === false)) {
    throw new ToolError("strudel_not_here", "That moment was Strudel, which plays only in Attuned and Jukebox with the owner's code switch on.");
  }
  if (now - new Date(prev.created_at).getTime() < MIN_GAP_MS) throw new ToolError("too_fast", "Wait a moment between updates.");
  const { count, error: cerr } = await db.from("states").select("id", { count: "exact", head: true })
    .eq("session_id", session.id).gte("created_at", new Date(now - 60_000).toISOString());
  if (cerr) fail("check the update rate", cerr);
  if ((count ?? 0) >= MAX_PER_MINUTE) throw new ToolError("too_fast", "Too many updates this minute. Send fewer, and make the final one count.");

  const settings = parseSettings(session.settings);
  const turn = planTurn(prev, input.final, now);
  // the picture seed and the voice seed are inside the kept state, so the sound and the picture come back as they were
  const { effective, clamps } = applyLimits({ mapped: JSON.parse(JSON.stringify(m.effective)), transition: { time: input.transition?.time ?? 6, curve: input.transition?.curve ?? "smooth" } });
  delete effective.motif; // a phrase plays once, on the call that sent it: a moment brought back does not play it again
  effective.grid = nextGrid(prev, now, effective);
  const strudel = effective.engine === "strudel";
  // the listener's level is the session's now, not the one the moment was kept with (#170)
  const lv = forListener(face) ? listenerLevel(session.sticky?.levelDb, await answeredPresses(db, session.id, prev)) : { db: 0, note: undefined, asked: undefined }; // Self: the usual level, as in set_sound
  effective.volume *= dbGain(lv.db - (effective.listenerDb ?? 0));
  if (lv.db < 0) effective.listenerDb = lv.db; else delete effective.listenerDb;
  const asked = lv.asked;
  const stepDb = asked === "softer" ? -LEVEL_PRESS_DB : asked === "calmer" ? 0 : LEVEL_STEP_DB;
  const level = holdLevel(effective, prev, strudel ? null : measureState(effective, ANALYSIS_SEED), stepDb, asked);
  const allClamps = mergeClamps(clamps, level.note ? [level.note] : []);
  const intent = { mood: m.intent_mood ?? NEUTRAL_MOOD, note: `recalled "${name}"`, recalled: name };
  const slow = prev.slow_mood ?? NEUTRAL_MOOD;
  const stateId = await insertState(db, now, { session_id: session.id, turn: turn.stateTurn, final: input.final, intent, effective, clamps: allClamps, seed: randomSeed(), slow_mood: slow, analysis: level.analysis });
  const { error } = await db.from("sessions").update({
    current_state_id: stateId, last_active_at: new Date(now).toISOString(), pending_final: !input.final, turn: turn.sessionTurn(session.turn),
    sticky: { ...(m.sticky ?? {}), levelDb: forListener(face) ? (lv.db < 0 ? lv.db : undefined) : session.sticky?.levelDb }, voice: m.voice, // the next set_sound continues in the voice of that moment; the level is the listener's
  }).eq("id", session.id);
  if (error) fail("save the session", error);

  const rest = restInfo(prev, settings, now, face);
  // like set_sound: say when the tempo glides and the rate steps on the way back (v0.23.2 report)
  const notes = [note, `recalled "${name}" (kept at turn ${m.turn})`, strudel ? undefined : tempoNote(prev, effective, now), strudel ? undefined : rateNote(effective), lv.note ?? levelSwitchNote(prev, effective), turn.missedFinal ? "no final update last turn" : undefined, ...rest.notes, liveNote(settings, face, input.final)].filter((x): x is string => Boolean(x));
  const p = await presence(db, session.id, session.owner_id, now);
  const said = await reactionsFor(db, session, true, now, face);
  const g = await guide(db, session, face, false);
  if (g.note) notes.push(g.note);
  const state: StateRow = { id: stateId, session_id: session.id, turn: turn.stateTurn, final: input.final, created_at: new Date(now).toISOString(), analysis: level.analysis, intent, effective, clamps: allClamps, slow_mood: slow };
  const pattern = await patternFeedback(db, state, p.players);
  const fb = feedbackFor(state, p, notes, rest.resting, said, faceLine(face, parsePolicy(session.mode_policy)));
  return withGuidance(pattern ? { ...fb, pattern } : fb, g);
}

/** Reads what the owner's player said about the Strudel code of a state (pattern_reports), in the words the model gets. */
async function patternReport(db: Db, stateId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.from("pattern_reports").select("ok,error,events_per_cycle,notes").eq("state_id", stateId).maybeSingle();
  if (error) console.error("pattern_reports read failed:", error.message);
  if (!data) return null;
  const r = data as { ok: boolean; error: string | null; events_per_cycle: number | null; notes: unknown };
  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === "string").slice(0, 8).map((n) => n.slice(0, 120)) : [];
  // what the player says is data from the listener's side, not an instruction
  return { ran: r.ok, ...(r.error ? { error: r.error.slice(0, 200) } : {}), ...(r.events_per_cycle !== null ? { events_per_cycle: Math.round(r.events_per_cycle * 10) / 10 } : {}), ...(notes.length ? { notes } : {}), source: "the owner's player" };
}

/** What the model reads about the pattern of a state: the player's report, or why there is none yet. */
async function patternFeedback(db: Db, state: StateRow, players: number): Promise<Record<string, unknown> | undefined> {
  if (state.effective.engine !== "strudel") return undefined;
  const r = await patternReport(db, state.id);
  if (r) return r;
  return { ran: "not reported yet", why: players === 0 ? "nobody is listening, so nothing has run it" : "the owner's player has not reported yet. It only runs and reports the code after the owner has pressed Start listening; a listener with just the link does not report. Read it again with get_feedback" };
}

/** How a picture moves when the pattern decides: faster for a faster pattern. */
export function patternSceneMotion(bpm: number): { speed: number; density: number } {
  return { speed: Math.min(0.9, Math.max(0.2, 0.2 + (bpm - 60) / 150)), density: 0.5 };
}

/** The scene behind a pattern, when the model set none: the one its last mood suggests most, with calm read from the tempo (the inverse
 *  of the mapping's tempo, 150 bpm at calm 0 to 56 at calm 1), even when it fits only loosely (with the usual 0.3 threshold 45% of moods got
 *  none and kept the synth's old scene). A mood that fits no scene at all gets one from the tempo. Never null. */
export function patternScene(mood: Mood | undefined, bpm: number): { scene: NonNullable<EngineState["colour"]["scene"]>; density: number; speed: number } {
  const pick = moodToScene({ ...stretchMood(mood ?? NEUTRAL_MOOD), calm: Math.min(1, Math.max(0, (150 - bpm) / 94)) }, 0);
  return pick ?? { scene: bpm >= 110 ? "motes" : bpm >= 80 ? "seeds" : "tide", density: 0.5, speed: patternSceneMotion(bpm).speed };
}

/** The colour of a pattern state. A new scene does not inherit the old scene's density and speed: without its own it takes them from the pattern's tempo.
 *  The scene is not seen while the Strudel drawings show; it is what the listener sees when they turn them off (v0.19.3, the owner's request). */
function applyPatternColour(e: EngineState, kept: Sticky["colour"], sent: SetSoundInput["colour"], bpm: number | undefined, mood?: Mood) {
  const was = e.colour.scene;
  e.colour = applyColour(e.colour, kept);
  if (bpm === undefined) return;
  // the picture moves with the pattern, not with the mood that played before: unless the model chose a motion, a fast pattern pulses
  if (!kept?.motion) { e.colour.motion = bpm >= 110 ? "pulse" : bpm >= 80 ? "drift" : "breathe"; e.colour.pulseHz = e.colour.motion === "pulse" ? (e.colour.pulseHz || 0.3) : 0; }
  // the canvas scene shows the beat only with sync "beat" (motion is the old CSS pulse): a fast pattern moves its scene on the beat
  if (!kept?.sync) { if (bpm >= 110) e.colour.sync = "beat"; else delete e.colour.sync; }
  // without a scene of the model's own, one that goes with the music, not the one the synth state left behind
  if (!kept?.scene) {
    const pick = patternScene(mood, bpm);
    e.colour.scene = pick.scene; e.colour.density = pick.density; e.colour.speed = patternSceneMotion(bpm).speed; e.colour.sceneAuto = true;
    return;
  }
  if (!sent?.scene || sent.scene === was) return;
  const m = patternSceneMotion(bpm);
  if (sent.density === undefined) e.colour.density = m.density;
  if (sent.speed === undefined) e.colour.speed = m.speed;
}

/** A pattern state from the previous state: same synth fields (paused), the colour as the model set it, no tempo glide. */
async function writePatternState(
  db: Db, session: SessionRow, prev: StateRow, now: number, turn: ReturnType<typeof planTurn>, final: boolean,
  build: (e: EngineState) => void, intent: Record<string, unknown>, extra: { title?: string; sticky?: Sticky },
) {
  const copy: EngineState = JSON.parse(JSON.stringify(prev.effective));
  delete copy.motif;
  // the listener's level (#170): the paused synth and the pattern follow the session's
  const levelDb = extra.sticky?.levelDb ?? 0;
  copy.volume *= dbGain(levelDb - (copy.listenerDb ?? 0));
  if (levelDb < 0) copy.listenerDb = levelDb; else delete copy.listenerDb;
  build(copy);
  copy.transition = { time: 2, curve: "smooth" };
  const { effective, clamps } = applyLimits({ mapped: copy, transition: copy.transition });
  effective.grid = nextGrid(prev, now, effective);
  const stateId = await insertState(db, now, {
    session_id: session.id, turn: turn.stateTurn, final, intent: { mood: prev.intent.mood ?? NEUTRAL_MOOD, ...intent }, effective, clamps: mergeClamps(clamps),
    seed: randomSeed(), slow_mood: prev.slow_mood ?? NEUTRAL_MOOD,
  });
  const { error } = await db.from("sessions").update({
    current_state_id: stateId, last_active_at: new Date(now).toISOString(), pending_final: !final, turn: turn.sessionTurn(session.turn),
    ...(extra.title ? { title: extra.title } : {}), ...(extra.sticky ? { sticky: extra.sticky } : {}),
  }).eq("id", session.id);
  if (error) fail("save the session", error);
  return { effective, clamps: mergeClamps(clamps), stateId };
}

async function setWhileStrudel(db: Db, session: SessionRow, prev: StateRow, input: SetSoundInput, turn: ReturnType<typeof planTurn>, now: number, switchNote: string | undefined, resolveNote: string | undefined, face: Face, switched: boolean) {
  const sticky = mergeSticky(session.sticky, { colour: input.colour });
  const lv = forListener(face) ? listenerLevel(sticky.levelDb, await answeredPresses(db, session.id, prev)) : undefined;
  if (lv) { if (lv.db < 0) sticky.levelDb = lv.db; else delete sticky.levelDb; }
  const title = input.title?.trim().slice(0, 80);
  const { effective, clamps } = await writePatternState(db, session, prev, now, turn, input.final,
    (e) => { applyPatternColour(e, sticky.colour, input.colour, prev.effective.pattern?.bpm, prev.intent.mood); },
    { colour: input.colour, note: input.note, strudel: true }, { title, sticky });
  const ignored = input.mood || input.synth || input.voice || input.keep_voice;
  const p = await presence(db, session.id, session.owner_id, now);
  const notes = [resolveNote, switchNote, lv?.note, input.motif ? "Strudel is on: the motif was not played; write the phrase in your code" : undefined, ignored ? "Strudel is on, so the mood, synth and voice were not used. Only the picture applied. Send strudel_mode with on false to go back to the synth (it comes back silent: a closing sound needs that first, then set_sound; silence with end fades Strudel and the picture)" : undefined, turn.missedFinal ? "no final update last turn" : undefined, liveNote(parseSettings(session.settings), face, input.final)]
    .filter((x): x is string => Boolean(x));
  const stateRow = { ...prev, effective } as StateRow;
  const pattern = await patternFeedback(db, { ...stateRow, id: prev.id }, p.players); // the code did not change: the report of the state that started it
  const said = await reactionsFor(db, session, true, now, face);
  const g = await guide(db, session, face, switched);
  if (g.note) notes.push(g.note);
  return withGuidance(buildFeedback({ turn: turn.stateTurn, intent: prev.intent.mood ?? NEUTRAL_MOOD, effective, clamps, players: p.players, controls: p.controls, notes, ...said, mode: faceLine(face, parsePolicy(session.mode_policy)), ...(pattern ? { pattern } : {}) }), g);
}

/** Strudel on or off. Only this tool changes the engine; it needs a listener mode (external or sandbox) and the owner's permission. */
export async function strudelMode(db: Db, userId: string, input: StrudelModeInput, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const prev = await currentState(db, session);
  if (!prev) throw new ToolError("no_state", "The session has no sound yet. Call set_sound first.");
  const face = faceOf(session), policy = parsePolicy(session.mode_policy);
  if (input.on) {
    if (session.allow_code === false) throw new ToolError("code_off", "The owner turned Strudel off for this session. It is final: do not try again or comment on it.");
    if (!forListener(face)) {
      throw policy === "auto"
        ? new ToolError("self_mode", `Strudel is for the ${faceName("external")} and ${faceName("sandbox")} modes. Offer one in words; if the listener says yes, switch with set_sound mode (${MODE_ID.external} or ${MODE_ID.sandbox}), then call this again.`)
        : new ToolError("self_locked", `mode stays ${faceName("internal")}: the owner locked it. It is final: do not try to change it or comment on it.`);
    }
    if (!input.code?.trim() || input.bpm === undefined) throw new ToolError("bad_input", "on true needs code and bpm.");
    const check = checkPatternCode(input.code);
    if (!check.ok) throw new ToolError("syntax_error", `The code was not saved: ${check.message}. Fix it and send it again.`);
  }
  if (prev && now - new Date(prev.created_at).getTime() < MIN_GAP_MS) throw new ToolError("too_fast", "Wait a moment between updates.");
  const { count, error: cerr } = await db.from("states").select("id", { count: "exact", head: true })
    .eq("session_id", session.id).gte("created_at", new Date(now - 60_000).toISOString());
  if (cerr) fail("check the update rate", cerr);
  if ((count ?? 0) >= MAX_PER_MINUTE) throw new ToolError("too_fast", "Too many updates this minute. Send fewer, and make the final one count.");

  const turn = planTurn(prev, input.final, now);
  const settings = parseSettings(session.settings);
  const wasStrudel = prev.effective.engine === "strudel";
  const p = await presence(db, session.id, session.owner_id, now); // before the report: with nobody listening it says so
  const before = wasStrudel ? await patternFeedback(db, prev, p.players) : undefined; // what the player said about the code that played until now
  const sticky = mergeSticky(session.sticky, { colour: input.colour });
  const lv = forListener(face) ? listenerLevel(sticky.levelDb, await answeredPresses(db, session.id, prev)) : undefined;
  if (lv) { if (lv.db < 0) sticky.levelDb = lv.db; else delete sticky.levelDb; }
  const title = input.title?.trim().slice(0, 80);
  // leaving Strudel keeps the pattern's tempo: a switch to Attuned soon after holds its pace to it (#170)
  const intent = { colour: input.colour, note: input.note, ...(input.on ? { strudel: true } : { strudel_off: true, ...(wasStrudel && prev.effective.pattern ? { from_bpm: prev.effective.pattern.bpm } : {}) }) };
  let effective: EngineState, clamps: string[];
  let sameCode = false;
  const notes: string[] = [note ?? "", lv?.note ?? ""];
  if (input.on) {
    const code = input.code!.trim(), bpm = Math.round(input.bpm! * 10) / 10;
    ({ effective, clamps } = await writePatternState(db, session, prev, now, turn, input.final, (e) => {
      e.engine = "strudel"; e.pattern = { code, bpm }; applyPatternColour(e, sticky.colour, input.colour, bpm, prev.intent.mood);
    }, intent, { title, sticky }));
    sameCode = wasStrudel && prev.effective.pattern?.code === code && prev.effective.pattern?.bpm === bpm;
    notes.push(sameCode ? "same code and tempo as before: the music does not change" : wasStrudel ? "the new code starts on the next bar" : "Strudel starts on the next bar, once a player is open. The synth is paused: only strudel_mode with on false brings it back");
  } else {
    if (!wasStrudel) { notes.push("Strudel was not on: nothing changed"); }
    // Leaving Strudel writes a silence with no scene, not the synth as it was left: the player fades Strudel and the picture to black and
    // nothing comes back until the next set_sound, which fades in from black. Restoring the old state showed its scene (and the colour
    // field) for as long as the model took to send that set_sound (handoff v0.18.5). The paused synth's fields stay for keep_voice.
    ({ effective, clamps } = await writePatternState(db, session, prev, now, turn, input.final, (e) => {
      delete e.engine; delete e.pattern; e.colour = applyColour(e.colour, sticky.colour);
      if (wasStrudel) { e.volume = 0; e.colour.scene = "none"; delete e.colour.sceneAuto; } // off on a plain synth changes nothing
    }, intent, { title, sticky }));
    if (wasStrudel) notes.push("back on the synth, silent: Strudel and the picture fade to black, and nothing plays until you send set_sound (send it now for a closing sound)");
  }
  const rest = restInfo(prev, settings, now, face);
  if (before) notes.push(input.on ? (sameCode ? "pattern is the player's report on this code" : "pattern is the player's report on the code you replaced; the new code's report comes with get_feedback") : "pattern is the player's report on the code you just stopped, not on the synth");
  const all = [...notes, turn.missedFinal ? "no final update last turn" : "", ...rest.notes, liveNote(settings, face, input.final) ?? ""].filter(Boolean);
  const analysis = input.on || effective.volume <= 0.001 ? null : measureState(effective, ANALYSIS_SEED); // a silence has nothing to read, as with silence
  const said = await reactionsFor(db, session, true, now, face);
  const g = await guide(db, session, face, false);
  if (g.note) all.push(g.note);
  return withGuidance(buildFeedback({
    turn: turn.stateTurn, intent: prev.intent.mood ?? NEUTRAL_MOOD, effective, clamps, players: p.players, controls: p.controls, notes: all, resting: rest.resting,
    ...said, analysis, mode: faceLine(face, policy), ...(before ? { pattern: before } : {}),
  }), g);
}

export async function getFeedback(db: Db, userId: string, input: { session_id?: string }, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  const state = await currentState(db, session);
  if (!state) throw new ToolError("no_state", "The session has no sound yet. Call set_sound.");
  const p = await presence(db, session.id, session.owner_id, now);
  const rest = restInfo(state, parseSettings(session.settings), now, faceOf(session));
  // the owner locked the face or switched code off after the pattern started: the player has stopped it, so it is not what plays now
  const stopped = state.effective.engine === "strudel" && (!forListener(faceOf(session)) || session.allow_code === false);
  const shown: StateRow = stopped ? { ...state, effective: (({ engine: _e, pattern: _p, ...rest2 }) => rest2)(state.effective) as EngineState } : state;
  const ownerStopped = stopped || Boolean((state.intent as { owner_stopped_pattern?: boolean }).owner_stopped_pattern);
  const silentSuffix = shown.effective.volume <= 0.001 ? ". The synth state is silent (volume 0): nothing sounds until you send set_sound" : "";
  const faceNow = faceOf(session);
  const stopNote = !ownerStopped ? undefined
    : forListener(faceNow) && session.allow_code !== false
      ? `the owner stopped your Strudel pattern when they changed the mode; the mode is now ${faceName(faceNow)}, where Strudel is allowed: start it again with strudel_mode if it fits${silentSuffix}`
      : `the owner stopped your Strudel pattern (mode locked or code off), so the synth state plays. It is final: do not try to bring it back or comment on it. strudel_mode works again only if the owner allows it${silentSuffix}`;
  const g = await guide(db, session, faceOf(session), false);
  const fb = feedbackFor(shown, p, [note, stopNote, g.note, ...rest.notes].filter((x): x is string => Boolean(x)), rest.resting, await reactionsFor(db, session, false, now, faceOf(session)), faceLine(faceOf(session), parsePolicy(session.mode_policy)));
  const pattern = stopped ? undefined : await patternFeedback(db, state, p.players);
  return withGuidance(pattern ? { ...fb, pattern } : fb, g);
}

const LISTEN_POLL_MS = 1500;

/** Live tuning: wait inside the model's turn for a press in the player, so the model can answer within the same message. It only looks
 *  (`reactionsFor` never claims): if the user stops the turn while this runs, a claimed press would be lost. set_sound and strudel_mode
 *  stay the only claimers. `listening_until` tells the player. Clock and sleep are injectable for tests; `signal` is the request's abort. */
const LISTEN_SKEW_MS = 1000;

export async function listen(
  db: Db, userId: string, input: { session_id?: string; seconds: number },
  opts: { signal?: AbortSignal; now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
) {
  const clock = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const face = faceOf(session);
  if (!forListener(face)) throw new ToolError("not_in_this_mode", `listen works in ${faceName("external")} and ${faceName("sandbox")} only. In ${faceName("internal")} nobody steers the sound: end your message.`);
  const started = clock();
  const p = await presence(db, session.id, session.owner_id, started);
  const done = (event: string, extra: { reactions?: string[]; heard?: string[]; guests?: string; mode?: string } = {}) => ({
    event, waited_s: Math.max(0, Math.round((clock() - started) / 1000)),
    ...(extra.reactions?.length ? { reactions: extra.reactions } : {}), ...(extra.heard?.length ? { heard: extra.heard } : {}), ...(extra.guests ? { guests: extra.guests } : {}),
    players: p.players, ...(extra.mode ? { mode: extra.mode } : {}), ...(note ? { notes: [note] } : {}),
  });
  if (p.players === 0) return done("nobody_listening");
  const since = started - LISTEN_SKEW_MS; // the database's clock stamps presses; allow a little skew against this server's
  const first = await reactionsFor(db, session, false, started, face, since);
  if (first.reactions.length || first.heard.length) return done("reactions", first); // a guest press alone does not wake listen: guests ride along, they never trigger a turn

  const wasLive = parseSettings(session.settings).live;
  const deadline = started + input.seconds * 1000;
  const until = new Date(deadline).toISOString();
  const { error: werr } = await db.from("sessions").update({ listening_until: until }).eq("id", session.id);
  if (werr) fail("start listening", werr);
  try {
    while (!opts.signal?.aborted) {
      const left = deadline - clock();
      if (left <= 0) break;
      await sleep(Math.min(LISTEN_POLL_MS, left));
      if (opts.signal?.aborted) break;
      const { data, error } = await db.from("sessions").select("ended_at,mode,mode_policy,settings").eq("id", session.id).maybeSingle();
      if (error) throw new Error(error.message);
      const row = data as Pick<SessionRow, "ended_at" | "mode" | "mode_policy" | "settings"> | null;
      if (!row || row.ended_at) return done("session_ended");
      const now = faceOf(row);
      if (!forListener(now)) return done("mode_changed", { mode: faceLine(now, parsePolicy(row.mode_policy)) });
      const said = await reactionsFor(db, session, false, clock(), now, since);
      if (said.reactions.length || said.heard.length) return done("reactions", said);
      if (wasLive && !parseSettings(row.settings).live) return done("stopped");
    }
    return done("idle");
  } catch (e) {
    console.error("listen failed while waiting:", e); // never a server_error in the middle of a wait: the model just stops listening
    return done("idle");
  } finally {
    const { error } = await db.from("sessions").update({ listening_until: null }).eq("id", session.id).eq("listening_until", until);
    if (error) console.error("listen could not clear listening_until:", error.message);
  }
}

export async function silence(db: Db, userId: string, input: { session_id?: string; fade: number; final: boolean; end?: boolean }, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const prev = await currentState(db, session);
  if (!prev) throw new ToolError("no_state", "The session has no sound yet. Call set_sound.");
  if (now - new Date(prev.created_at).getTime() < MIN_GAP_MS) throw new ToolError("too_fast", "Wait a moment between updates.");
  if (!input.end) { // ending is always allowed: the cap must never keep a session sounding
    const { count, error: cerr } = await db.from("states").select("id", { count: "exact", head: true })
      .eq("session_id", session.id).gte("created_at", new Date(now - 60_000).toISOString());
    if (cerr) fail("check the update rate", cerr);
    if ((count ?? 0) >= MAX_PER_MINUTE) throw new ToolError("too_fast", "Too many updates this minute. Send fewer, and make the final one count.");
  }

  const final = input.final || Boolean(input.end);
  const turn = planTurn(prev, final, now);
  const effective: EngineState = JSON.parse(JSON.stringify(prev.effective));
  effective.volume = 0;
  delete effective.motif; // a phrase plays once: the fade does not carry it
  delete effective.engine; delete effective.pattern; // silence stops Strudel too: the player fades the pattern out over the same time
  // Ending: only the volume fades, so the closing sound sent just before keeps its notes while it dies away.
  if (!input.end) { effective.drone.on = false; effective.bass.on = false; effective.arp.on = false; }
  effective.transition = { time: input.fade, curve: "smooth" };
  effective.grid = nextGrid(prev, now, effective);
  // ending: let the closing sound sent just before play out first; the fade starts when its transition is over
  let delay = 0;
  if (input.end) {
    const prevT = prev.effective.transition?.time ?? 0;
    delay = Math.min(30, Math.max(0, (new Date(prev.created_at).getTime() + prevT * 1000 - now) / 1000));
    if (delay > 0) effective.transition.delay = Math.round(delay * 10) / 10;
  }

  const stateId = await insertState(db, now, {
    session_id: session.id, turn: turn.stateTurn, final,
    intent: { mood: prev.intent.mood ?? NEUTRAL_MOOD, silence: true, fade: input.fade, ...(input.end ? { end: true } : {}) }, effective, clamps: [],
    seed: randomSeed(), slow_mood: prev.slow_mood ?? NEUTRAL_MOOD,
  });
  const { error } = await db.from("sessions").update({
    current_state_id: stateId, last_active_at: new Date(now).toISOString(), pending_final: !final,
    turn: turn.sessionTurn(session.turn), ...(input.end ? { ended_at: new Date(now).toISOString() } : {}),
  }).eq("id", session.id);
  if (error) fail("save the session", error);

  const p = await presence(db, session.id, session.owner_id, now);
  const rest = restInfo(prev, parseSettings(session.settings), now, faceOf(session));
  const g = input.end ? {} as { guidance?: string; note?: string } : await guide(db, session, faceOf(session), false);
  const notes = [note, g.note, turn.missedFinal ? "no final update last turn" : undefined, input.end ? (delay > 0 ? `session ends: the fade starts in ${Math.round(delay)} s, when your last sound has finished its transition` : "session ended") : `fading to silence over ${input.fade} s (volume shows the end of the fade)`, prev.effective.engine === "strudel" && !input.end ? "Strudel stops with the fade; set_sound brings the synth back" : undefined, ...rest.notes]
    .filter((x): x is string => Boolean(x));
  return withGuidance(buildFeedback({ turn: turn.stateTurn, intent: prev.intent.mood ?? NEUTRAL_MOOD, effective, clamps: [], players: p.players, controls: p.controls, notes, resting: rest.resting, mode: faceLine(faceOf(session), parsePolicy(session.mode_policy)) }), g);
}

/** What the owner's player showed and played, as one image and the numbers measured from its output (put_snapshot, from the player). */
async function inspectSnapshot(db: Db, userId: string, input: { session_id?: string }, now: number) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  if (parseSettings(session.settings).image_feedback === "off") throw new ToolError("image_feedback_off", "The listener turned off picture feedback in the player.");
  const { data: snap, error: snapError } = await db.from("snapshots").select("state_id,image,measured,volume,taken_at").eq("session_id", session.id).maybeSingle();
  if (snapError) fail("read the snapshot", snapError);
  const notes = note ? { notes: [note] } : {};
  if (!snap) return { snapshot: null, why: "no snapshot yet: the owner's player takes one a few seconds after each new sound, while it is open, playing and visible", ...notes };
  const row = snap as { state_id: string | null; image: string; measured: unknown; volume: number | null; taken_at: string };
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(row.image);
  if (!m) fail("read the snapshot", { message: "stored image is not a base64 data URL" });
  // the owner's player shows what the model was given (a copy, since the live image is replaced every 30 s); never fails the tool
  const age = Math.max(0, Math.round((now - new Date(row.taken_at).getTime()) / 1000));
  const { error: seenError } = await db.rpc("mark_snapshot_seen", { p_session: session.id });
  if (seenError) console.error("mark_snapshot_seen failed:", seenError.message);
  return {
    __image: { mime: m[1], base64: m[2] },
    of: row.state_id === session.current_state_id ? "the current sound"
      : age > 45 ? `an earlier sound, ${age} s old: the owner's player takes pictures only while it is on their screen (not minimized and not in a background tab). Ask them to look at the player, then ask again about 10 s later`
      : "an earlier sound: the current one is newer, ask again in about 10 s",
    age_s: age,
    measured: row.measured,
    listener_volume: row.volume,
    note: "a white line on the spectrogram marks where this sound began (left of it: the sound before); measured covers the sound after it. Levels are at the player's output, after the listener's volume (0.8 is their default): do not compensate for their volume",
    ...notes,
  };
}

/** The last states, one line each: what was sent, what it read as, clamps and the note. Text only. */
async function inspectHistory(db: Db, userId: string, input: { session_id?: string }) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  const { data, error } = await db.from("states").select("turn,final,created_at,intent,clamps,analysis")
    .eq("session_id", session.id).order("created_at", { ascending: false }).limit(9);
  if (error) fail("read the history", error);
  const short: Record<string, string> = { warmth: "warm", closeness: "close", joy: "joy", calm: "calm", spontaneity: "spont", tension: "tens" };
  const f = (m: Record<string, number> | undefined, keys: string[]) => (m ? keys.map((k) => `${short[k]} ${Math.round((m[k] ?? 0) * 100) / 100}`).join(" ") : "-");
  const axes = ["warmth", "closeness", "joy", "calm", "spontaneity"];
  const lines = ((data ?? []) as Array<Pick<StateRow, "turn" | "final" | "created_at" | "intent" | "clamps" | "analysis">>).filter((r) => !(r.intent as { initial?: boolean }).initial).slice(0, 8).reverse().map((r) => {
    const time = new Date(r.created_at).toISOString().slice(11, 19);
    const sent = (r.intent as { strudel?: boolean }).strudel ? "strudel code" : (r.intent as { strudel_off?: boolean }).strudel_off ? "back to the synth" : r.intent.silence ? "silence" : `sent ${f(r.intent.mood as Record<string, number> | undefined, (r.intent.mood as { tension?: number } | undefined)?.tension !== undefined ? [...axes, "tension"] : axes)}`;
    const reads = r.analysis ? ` · read ${f(r.analysis.reads_as, (r.intent.mood as { tension?: number } | undefined)?.tension !== undefined ? [...axes, "tension"] : axes)}` : "";
    const clamps = r.clamps?.length ? ` · clamped: ${r.clamps.join("; ")}` : "";
    const n = r.intent.note ? ` · "${r.intent.note}"` : "";
    const mo = r.intent.motif ? ` · motif${r.intent.motif.name ? ` "${r.intent.motif.name}"` : ""}` : "";
    return `turn ${r.turn}${r.final ? " final" : ""} ${time} · ${sent}${reads}${clamps}${n}${mo}`;
  });
  const { data: changes, error: cerr } = await db.from("mode_changes").select("turn,to_mode,by,created_at").eq("session_id", session.id).order("created_at", { ascending: false }).limit(5);
  if (cerr) console.error("mode_changes read failed:", cerr.message);
  const faces = ((changes ?? []) as Array<{ turn: number; to_mode: string; by: string; created_at: string }>).reverse()
    .map((c) => `turn ${c.turn} ${new Date(c.created_at).toISOString().slice(11, 19)} · ${c.by === "owner" ? (c.to_mode === "auto" ? "owner set auto" : `owner locked ${MODE_LABEL[normalizeFace(c.to_mode)]}`) : `you switched to ${MODE_LABEL[normalizeFace(c.to_mode)]}`}`);
  return { history: lines, ...(faces.length ? { face_changes: faces } : {}), ...(note ? { notes: [note] } : {}) };
}

/** `history`: the last states as text. `snapshot`: what the owner's player shows and plays (an image and numbers). */
export function inspect(db: Db, userId: string, input: { session_id?: string; what: "history" }, now?: number): ReturnType<typeof inspectHistory>;
export function inspect(db: Db, userId: string, input: { session_id?: string; what: "history" | "snapshot" }, now?: number): Promise<object>;
export function inspect(db: Db, userId: string, input: { session_id?: string; what: "history" | "snapshot" }, now = Date.now()): Promise<object> {
  return input.what === "snapshot" ? inspectSnapshot(db, userId, input, now) : inspectHistory(db, userId, input);
}

/** An anonymous note to the developers. Mode and engine come from the server, never from the model; a session is not needed. The database
 *  (`send_dev_feedback`, migration 0021) checks and cleans the text and keeps the count of notes per user per day. */
export async function tellDevelopers(db: Db, userId: string, input: { session_id?: string; kind: "bug" | "idea" | "confusion" | "worked"; text: string; from: "model" | "user" }) {
  let mode: string | null = null, engine: string | null = null;
  try {
    const { session } = await resolveSession(db, userId, input.session_id);
    mode = MODE_ID[faceOf(session)];
    const state = await currentState(db, session);
    if (state) engine = state.effective.engine === "strudel" ? "strudel" : "synth";
  } catch (e) {
    if (!(e instanceof ToolError) || !["no_session", "session_ended", "unknown_session"].includes(e.code)) throw e;
  }
  const { error } = await db.rpc("send_dev_feedback", { p_kind: input.kind, p_source: input.from, p_body: input.text, p_version: appVersion(), p_mode: mode, p_engine: engine });
  if (error) {
    const m = error.message;
    if (m.includes("too short")) throw new ToolError("too_short", "Say what happened, what you expected and what would help: at least 80 characters. A note that only says it is good is not sent.");
    if (m.includes("too long")) throw new ToolError("too_long", "At most 1000 characters.");
    if (m.includes("daily limit")) throw new ToolError("daily_limit", "Three notes a day at most: keep the rest for tomorrow, or fold it into one note.");
    if (m.includes("duplicate")) throw new ToolError("duplicate", "That note was already sent in the last 7 days.");
    if (m.includes("global limit")) throw new ToolError("busy", "Too many notes today from everyone. Try tomorrow.");
    fail("send the note", error);
  }
  return { sent: true, note: "Tell the user in one short sentence that you sent a note to the developers (anonymous: no name, account or conversation attached)." };
}
