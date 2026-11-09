import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// The tables are untyped here; generic params are loose so any client (including test clients) fits.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;
import { midiToNoteName, type EngineState } from "@sonorous/engine";
import {
  NEUTRAL_MOOD, applyColour, applyLimits, applyOverride, buildFeedback, isResting, moodToEngineState,
  analyze, callSynth, mergeSticky, nextGrid, nextSlowMood, parseSettings, restingNote, stickyToSynth, stretchMood, voiceSeedOf, voiceToSynth,
  type ListenerSettings, type Sticky, type Mood, type SetSoundInput, type Voice,
} from "@sonorous/shared";
import { publicBaseUrl } from "../env";
import { ENDED_AFTER_S } from "../session-status";
import { MAX_PER_MINUTE, MIN_GAP_MS, planTurn } from "./turn";

/** An error the model can read and recover from. Returned as a tool result, never thrown to the protocol. */
export class ToolError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const MAX_ACTIVE_SESSIONS = 10;
const PRESENCE_WINDOW_MS = 45_000;

interface SessionRow {
  id: string; owner_id: string; title: string | null; settings: unknown; current_state_id: string | null;
  turn: number; pending_final: boolean; ended_at: string | null; voice: Voice | null; sticky: Sticky | null;
}
interface StateRow {
  id: string; session_id: string; turn: number; final: boolean; created_at: string; analysis: Compact | null;
  intent: { mood?: Mood; note?: string; silence?: boolean; end?: boolean }; effective: EngineState; clamps: string[]; slow_mood: Mood | null;
}

function fail(action: string, error: { message: string } | null): never {
  console.error(`mcp ${action} failed:`, error?.message);
  throw new ToolError("server_error", `Could not ${action}. Try again in a moment.`);
}

const randomSeed = () => randomBytes(4).readUInt32BE(0);
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
  if (!s) throw new ToolError("no_session", "Call start_session first.");
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

/** The fade is the owner's setting (shared with Claude): tell the model when a call arrives after it happened. */
function restInfo(prev: StateRow | null, settings: ListenerSettings, now: number): { resting: boolean; notes: string[] } {
  if (!prev || settings.rest_after === null || !isResting(prev.created_at, settings.rest_after, now)) return { resting: false, notes: [] };
  return { resting: true, notes: [restingNote(settings.rest_after)] };
}

type Compact = { sound: Record<string, unknown>; reads_as: Record<string, number> };

/** Measure what the state sounds like. It must never break a call: on any failure the feedback just has no reading. */
function measureState(effective: EngineState, seed: number): Compact | null {
  try {
    if (effective.volume <= 0) return null;
    const a = analyze(effective, seed);
    return { sound: a.sound, reads_as: a.reads_as };
  } catch (e) {
    console.error("analysis failed:", e);
    return null;
  }
}

/** Without a voice of its own, scale, root and wave follow the mood and move from call to call: say so when they did. */
function voiceNote(prev: StateRow | null | undefined, now: EngineState, voice: Voice | null | undefined, held: boolean): string | undefined {
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
  const a = applyOverride(mapped, voiceToSynth(voice));
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

function feedbackFor(state: StateRow, p: Awaited<ReturnType<typeof presence>>, notes: string[] = [], resting = false) {
  // states written before the analysis existed have none: measure them now (the engine is deterministic)
  const analysis = state.analysis ?? measureState(state.effective, 1);
  return buildFeedback({
    turn: state.turn, intent: state.intent.mood ?? NEUTRAL_MOOD, effective: state.effective, clamps: state.clamps ?? [],
    players: p.players, controls: p.controls, notes, resting, analysis,
  });
}

export async function startSession(db: Db, userId: string, input: { title?: string; voice?: Voice }, now = Date.now()) {
  // keep at most 10 active sessions: end the oldest
  const { data: active, error: aerr } = await db.from("sessions").select("id").eq("owner_id", userId).is("ended_at", null)
    .order("last_active_at", { ascending: false });
  if (aerr) fail("check your sessions", aerr);
  for (const old of (active ?? []).slice(MAX_ACTIVE_SESSIONS - 1)) {
    await db.from("sessions").update({ ended_at: new Date(now).toISOString() }).eq("id", old.id);
  }
  // a session with no sound for a week is over (roadmap: sessions lifecycle); done here so no scheduled job is needed
  await db.from("sessions").update({ ended_at: new Date(now).toISOString() }).eq("owner_id", userId).is("ended_at", null)
    .lt("last_active_at", new Date(now - ENDED_AFTER_S * 1000).toISOString());

  const { data: profile } = await db.from("profiles").select("default_settings").eq("id", userId).maybeSingle();
  const settings: ListenerSettings = parseSettings(profile?.default_settings ?? {});
  const id = newSessionId();

  const { error: serr } = await db.from("sessions").insert({
    id, owner_id: userId, title: input.title?.slice(0, 80) ?? null, settings, last_active_at: new Date(now).toISOString(),
    voice: input.voice ?? null,
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
    settings: { rest_after: settings.rest_after },
    note: "Give player_url to the user in one short sentence and say nothing more about the sound. Pass session_id in every call.",
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
  // the axes are stretched (instances send 0.4 to 0.7); nothing else limits the mood
  const mood = stretchMood(input.mood);
  const slow = nextSlowMood(prev?.slow_mood, mood, input.final);

  // a new voice replaces the old one for good; it is a big change, so without a transition of its own it gets a long one
  let voice = input.voice !== undefined ? input.voice : session.voice;
  // keep_voice: freeze what plays now as the voice, so the mood stops redrawing it. The notes are the same, so no long transition.
  let held = false;
  if (input.keep_voice && input.voice === undefined && prev) {
    const e = prev.effective.arp;
    voice = { root: midiToNoteName(e.root), scale: e.scale, chord: e.chord.slice(0, 8), pattern: e.pattern, octaves: e.octaves, wave: prev.effective.osc.wave, ...(session.voice ?? {}) };
    held = true;
  }
  const transition = input.voice !== undefined && !input.transition ? { curve: "smooth" as const, time: 8 } : input.transition;

  // colour, stack, pad and LFOs stay until Claude changes them (like the voice); fold this call into what the session keeps
  const sticky = mergeSticky(session.sticky, input);
  const { state: overridden, overridden: fields } = mapSound(session.id, mood, slow, voice, sticky, input.synth);
  overridden.colour = applyColour(overridden.colour, sticky.colour);
  const { effective, clamps } = applyLimits({
    mapped: overridden, transition,
  });
  const allClamps = mergeClamps(clamps);
  effective.grid = nextGrid(prev, now); // where the step grids are on the shared timeline when this state starts

  const seed = randomSeed();
  const analysis = measureState(effective, seed);
  const stateId = await insertState(db, now, {
    session_id: session.id, turn: turn.stateTurn, final: input.final,
    intent: { mood: input.mood, synth: input.synth, colour: input.colour, transition: input.transition, note: input.note, overridden: fields },
    effective, clamps: allClamps, seed, slow_mood: slow, analysis,
  });
  const title = input.title?.trim().slice(0, 80);
  // Claude may change only rest_after here (an expression setting). Merge into the raw row so defaults are not frozen in.
  const rawSettings = session.settings && typeof session.settings === "object" ? (session.settings as Record<string, unknown>) : {};
  const { error: uerr } = await db.from("sessions").update({
    current_state_id: stateId, last_active_at: new Date(now).toISOString(), pending_final: !input.final,
    turn: turn.sessionTurn(session.turn), ...(title ? { title } : {}),
    ...(input.rest_after !== undefined ? { settings: { ...rawSettings, rest_after: input.rest_after } } : {}),
    ...(input.voice !== undefined || held ? { voice } : {}),
    sticky,
  }).eq("id", session.id);
  if (uerr) fail("save the session", uerr);

  const rest = restInfo(prev, settings, now);
  const notes = [note, turn.missedFinal ? "no final update last turn" : undefined, voiceNote(prev, effective, voice, held), analysis ? undefined : "analysis unavailable this time", ...rest.notes].filter((x): x is string => Boolean(x));
  const p = await presence(db, session.id, session.owner_id, now);
  return buildFeedback({ turn: turn.stateTurn, intent: input.mood, effective, clamps: allClamps, players: p.players, controls: p.controls, notes, resting: rest.resting, analysis });
}

export async function getFeedback(db: Db, userId: string, input: { session_id?: string }, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  const state = await currentState(db, session);
  if (!state) throw new ToolError("no_state", "The session has no sound yet. Call set_sound.");
  const p = await presence(db, session.id, session.owner_id, now);
  const rest = restInfo(state, parseSettings(session.settings), now);
  return feedbackFor(state, p, [note, ...rest.notes].filter((x): x is string => Boolean(x)), rest.resting);
}

export async function silence(db: Db, userId: string, input: { session_id?: string; fade: number; final: boolean; end?: boolean }, now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  assertOpen(session);
  const prev = await currentState(db, session);
  if (!prev) throw new ToolError("no_state", "The session has no sound yet. Call set_sound.");
  if (now - new Date(prev.created_at).getTime() < MIN_GAP_MS) throw new ToolError("too_fast", "Wait a moment between updates.");

  const final = input.final || Boolean(input.end);
  const turn = planTurn(prev, final, now);
  const effective: EngineState = JSON.parse(JSON.stringify(prev.effective));
  effective.volume = 0; effective.gesture = null;
  // Ending: only the volume fades, so the closing sound sent just before keeps its notes while it dies away.
  if (!input.end) { effective.drone.on = false; effective.bass.on = false; effective.arp.on = false; }
  effective.transition = { time: input.fade, curve: "smooth" };
  effective.grid = nextGrid(prev, now);
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
  const rest = restInfo(prev, parseSettings(session.settings), now);
  const notes = [note, turn.missedFinal ? "no final update last turn" : undefined, input.end ? (delay > 0 ? `session ends: the fade starts in ${Math.round(delay)} s, when your last sound has finished its transition` : "session ended") : `fading to silence over ${input.fade} s (volume shows the end of the fade)`, ...rest.notes]
    .filter((x): x is string => Boolean(x));
  return buildFeedback({ turn: turn.stateTurn, intent: prev.intent.mood ?? NEUTRAL_MOOD, effective, clamps: [], players: p.players, controls: p.controls, notes, resting: rest.resting });
}

/** The last states, one line each: what was sent, what it read as, clamps and the note. Text only. */
export async function inspect(db: Db, userId: string, input: { session_id?: string; what: "history" }, _now = Date.now()) {
  const { session, note } = await resolveSession(db, userId, input.session_id);
  const { data, error } = await db.from("states").select("turn,final,created_at,intent,clamps,analysis")
    .eq("session_id", session.id).order("created_at", { ascending: false }).limit(8);
  if (error) fail("read the history", error);
  const short: Record<string, string> = { warmth: "warm", closeness: "close", joy: "joy", calm: "calm", spontaneity: "spont" };
  const f = (m: Record<string, number> | undefined, keys: string[]) => (m ? keys.map((k) => `${short[k]} ${Math.round((m[k] ?? 0) * 100) / 100}`).join(" ") : "-");
  const axes = ["warmth", "closeness", "joy", "calm", "spontaneity"];
  const lines = ((data ?? []) as Array<Pick<StateRow, "turn" | "final" | "created_at" | "intent" | "clamps" | "analysis">>).reverse().map((r) => {
    const time = new Date(r.created_at).toISOString().slice(11, 19);
    const sent = r.intent.silence ? "silence" : `sent ${f(r.intent.mood as Record<string, number> | undefined, axes)}`;
    const reads = r.analysis ? ` · read ${f(r.analysis.reads_as, axes)}` : "";
    const clamps = r.clamps?.length ? ` · ${r.clamps.length} clamp${r.clamps.length > 1 ? "s" : ""}` : "";
    const n = r.intent.note ? ` · "${r.intent.note}"` : "";
    return `turn ${r.turn}${r.final ? " final" : ""} ${time} · ${sent}${reads}${clamps}${n}`;
  });
  return { history: lines, ...(note ? { notes: [note] } : {}) };
}
