// Runs only through scripts/test-api.sh (needs Docker): real Postgres + PostgREST with our migrations.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { voiceSeedOf } from "@sonorous/shared";
import type { supabaseForToken } from "../supabase/bearer";

const REST = process.env.SONOROUS_TEST_REST_URL;
const SECRET = process.env.SONOROUS_TEST_JWT_SECRET ?? "";
const DB = process.env.SONOROUS_TEST_DB_CONTAINER ?? "";

const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
const sql = (q: string) => execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-At", "-c", q]).toString().trim();
// A controlled clock: the WSL/Docker clocks step around, and sleeping would make the tests depend on them.
let clock = Date.now();
const tick = (ms = 1000) => (clock += ms);

async function tokenFor(sub: string) {
  return new SignJWT({ role: "authenticated", sub }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
}

vi.mock("../supabase/bearer", () => ({
  supabaseForToken: (token: string) =>
    createClient(REST ?? "http://localhost", "anon-placeholder", {
      global: {
        headers: { Authorization: `Bearer ${token}` },
        // PostgREST serves at the root, supabase-js adds /rest/v1
        fetch: (url, init) => fetch(String(url).replace("/rest/v1", ""), init),
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
}));

describe.skipIf(!REST)("MCP tool service against Postgres", () => {
  let dbA: ReturnType<typeof supabaseForToken>, dbB: ReturnType<typeof supabaseForToken>;
  let svc: typeof import("./service");
  const mood = { warmth: 0.8, closeness: 0.7, joy: 0.6, calm: 0.75, spontaneity: 0.3 };

  beforeAll(async () => {
    process.env.PUBLIC_BASE_URL = "https://app.example";
    sql(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
    const { supabaseForToken } = await import("../supabase/bearer");
    dbA = supabaseForToken(await tokenFor(A)); dbB = supabaseForToken(await tokenFor(B));
    svc = await import("./service");
  });

  it("starts a session with an owner listener and a first state", async () => {
    const r = await svc.startSession(dbA, A, { title: "test" }, tick());
    expect(r.session_id).toHaveLength(24);
    expect(r.player_url).toBe(`https://app.example/s/${r.session_id}`);
    expect(sql(`select count(*) from listeners where session_id='${r.session_id}' and label='you'`)).toBe("1");
    expect(sql(`select turn||'/'||final from states where session_id='${r.session_id}'`)).toBe("0/true");
    expect(sql(`select (current_state_id is not null) from sessions where id='${r.session_id}'`)).toBe("t");
  });

  it("runs a turn: non-final then final, turn numbers, pending flag, effective state", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const a = await svc.setSound(dbA, A, { session_id, mood, final: false } as never, tick());
    expect(a.turn).toBe(1);
    expect(sql(`select pending_final||'/'||turn from sessions where id='${session_id}'`)).toBe("true/0");
    const b = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(b.turn).toBe(1);
    expect(sql(`select pending_final||'/'||turn from sessions where id='${session_id}'`)).toBe("false/1");
    expect(b.players).toBe(0);
    expect(b.notes).toEqual(["no player open: nobody is hearing this"]);
    expect((b.playing as { volume: number }).volume).toBe(0.5); // a constant: the listener owns the volume
    const c = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(c.turn).toBe(2);
    expect(sql(`select slow_mood is not null from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("t");
  });

  it("lets set_sound name and rename the session", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true, title: "  Notes on a long poem " } as never, tick());
    expect(sql(`select title from sessions where id='${session_id}'`)).toBe("Notes on a long poem");
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(sql(`select title from sessions where id='${session_id}'`)).toBe("Notes on a long poem");
    await svc.setSound(dbA, A, { session_id, mood, final: true, title: "Dinner ideas" } as never, tick());
    expect(sql(`select title from sessions where id='${session_id}'`)).toBe("Dinner ideas");
  });

  it("starts new sessions with no listener limits, and does not clamp extreme choices", async () => {
    const r = await svc.startSession(dbA, A, {}, tick());
    expect(sql(`select settings ? 'consent' from sessions where id='${r.session_id}'`)).toBe("f");
    const out = await svc.setSound(dbA, A, {
      session_id: r.session_id, mood: { warmth: 0, closeness: 0, joy: 0, calm: 0, spontaneity: 1 }, final: true,
      synth: { arp: { tempo: 200, rate: "1/16" }, filter: { resonance: 20 }, osc: { wave: "square" }, fx: { delay: { mix: 1, feedback: 0.85, time: 1.5 } } },
      transition: { time: 0.3, curve: "sudden" },
    } as never, tick());
    expect(out.clamped).toBeUndefined();
    expect(sql(`select concat(effective->'osc'->>'wave', effective->'transition'->>'curve') from states where session_id='${r.session_id}' order by created_at desc limit 1`)).toBe("squaresudden");
  });

  it("applies a colour sent without a mode", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const r = await svc.setSound(dbA, A, { session_id, mood, final: true, colour: { hue: 0, saturation: 1, lightness: 0.5 } } as never, tick());
    expect(r.colour).toMatchObject({ h: 0, s: 1, l: 0.5 });
  });

  it("settings of old sessions that still carry the removed limit keys are read without them", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    sql(`update sessions set settings = '{"consent":"ambient","max_volume":0.2,"max_harshness":0.1}' where id='${session_id}'`);
    const out = await svc.setSound(dbA, A, { session_id, mood: { ...mood, joy: 0, calm: 0 }, final: true } as never, tick());
    expect(out.clamped).toBeUndefined();
    expect((out.playing as { volume: number }).volume).toBe(0.5);
  });

  it("answers too_fast for back-to-back updates", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: false } as never, tick());
    await expect(svc.setSound(dbA, A, { session_id, mood, final: false } as never, tick(100))).rejects.toMatchObject({ code: "too_fast" });
  });

  it("notes a missed final when a new turn starts after a stale non-final update", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: false } as never, tick());
    const r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(200_000));
    expect(r.notes).toEqual(expect.arrayContaining(["no final update last turn"]));
    expect(r.turn).toBe(2);
  });

  it("counts players and reports the listener controls", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    sql(`insert into player_heartbeats (session_id, user_id, device_id, audio, volume, delay) values ('${session_id}', '${A}', 'd1', 'playing', 0.4, null)`);
    // the trigger stamps seen_at from the database clock; switch it off to place the heartbeat on the test clock
    sql(`alter table player_heartbeats disable trigger player_heartbeats_touch; update player_heartbeats set seen_at = to_timestamp(${clock} / 1000.0) where session_id='${session_id}'; alter table player_heartbeats enable trigger player_heartbeats_touch`);
    const f = await svc.getFeedback(dbA, A, { session_id }, clock);
    expect(f.players).toBe(1);
    expect(f.controls).toEqual({ volume: 0.4 });
    expect(f).not.toHaveProperty("notes");
  });

  it("lets anyone with the link listen: read the state and report a heartbeat, with no account", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    const rpc = (fn: string, body: object) => fetch(`${REST}/rpc/${fn}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), // no Authorization: the anon role
    });
    const got = await (await rpc("get_player_state", { p_session: session_id })).json();
    expect(got.ended).toBe(false);
    expect(got.state.effective.volume).toBe(0.5);
    expect(got.state.turn).toBe(1);
    expect(await (await rpc("get_player_state", { p_session: "nope" })).json()).toBeNull();
    expect((await rpc("player_heartbeat", { p_session: session_id, p_device: "friend-phone", p_audio: "playing", p_volume: 0.5, p_delay: null })).status).toBe(204);
    const tables = await fetch(`${REST}/states?select=id`);
    expect(tables.status).toBeGreaterThanOrEqual(400); // the tables are closed to anon (permission denied)
    // a listener with only the link counts as a listener, but their controls are not reported to the model
    let fb = await svc.getFeedback(dbA, A, { session_id }, Date.now());
    expect(fb.players).toBe(1);
    expect(fb).not.toHaveProperty("controls");
    // the owner's own device is the one whose controls the model sees
    expect((await dbA.rpc("player_heartbeat", { p_session: session_id, p_device: "owner-laptop", p_audio: "playing", p_volume: 0.3, p_delay: null })).error).toBeNull();
    fb = await svc.getFeedback(dbA, A, { session_id }, Date.now());
    expect(fb.players).toBe(2);
    expect(fb.controls).toEqual({ volume: 0.3 });
    // the public counter: two numbers and nothing else, readable with no account
    const live = await (await rpc("live_counts", {})).json();
    expect(Object.keys(live).sort()).toEqual(["listeners", "sessions"]);
    expect(live.sessions).toBeGreaterThanOrEqual(1);
    expect(live.listeners).toBeGreaterThanOrEqual(2);
  });

  it("silences with a fade and logs it as a state", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    const r = await svc.silence(dbA, A, { session_id, fade: 6, final: true }, tick());
    expect((r.playing as { volume: number }).volume).toBe(0);
    expect(sql(`select effective->'transition'->>'time' from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("6");
  });

  it("never fades by itself, in Self too, and ignores a rest_after an old client sends (2026-11-21)", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const before = JSON.parse(sql(`select settings::text from sessions where id='${session_id}'`));
    await svc.setSound(dbA, A, { session_id, mood, final: true, rest_after: 600 } as never, tick());
    expect(JSON.parse(sql(`select settings::text from sessions where id='${session_id}'`))).toEqual(before);
    const fb = await svc.getFeedback(dbA, A, { session_id }, clock + 3_600_000);
    expect(fb.resting).toBeUndefined();
    expect(JSON.stringify(fb)).not.toMatch(/faded/);
  });

  it("ends the session with silence end, keeping the layers on while the volume fades", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    const r = await svc.silence(dbA, A, { session_id, fade: 10, final: false, end: true }, tick());
    expect((r.playing as { volume: number }).volume).toBe(0);
    // the closing sound sent a second earlier still has about 3 s of its 4 s transition to play: the fade waits for it
    expect((r.notes as string[]).join(" ")).toMatch(/session ends: the fade starts in \d+ s/);
    const delay = Number(sql(`select effective->'transition'->>'delay' from states where session_id='${session_id}' order by created_at desc limit 1`));
    expect(delay).toBeGreaterThan(2); expect(delay).toBeLessThanOrEqual(4);
    expect(sql(`select (ended_at is not null) from sessions where id='${session_id}'`)).toBe("t");
    expect(sql(`select final from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("t");
    await expect(svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick())).rejects.toMatchObject({ code: "session_ended" });
  });

  it("keeps the voice from turn to turn, and a new voice replaces it with a long transition", async () => {
    const voice = { root: "A2", scale: "dorian", chord: [1, 5, 9], pattern: "as_played", octaves: 2, wave: "square" };
    const { session_id } = await svc.startSession(dbA, A, { voice } as never, tick());
    const arp = () => JSON.parse(sql(`select effective->'arp' from states where session_id='${session_id}' order by created_at desc limit 1`));
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(arp()).toMatchObject({ scale: "dorian", chord: [1, 5, 9], pattern: "as_played", octaves: 2 });
    await svc.setSound(dbA, A, { session_id, mood: { ...mood, joy: 0.2 }, final: true } as never, tick());
    expect(arp()).toMatchObject({ scale: "dorian", chord: [1, 5, 9] }); // the mood moved, the voice stayed
    await svc.setSound(dbA, A, { session_id, mood, final: true, voice: { scale: "lydian", chord: [1, 3, 5] } } as never, tick());
    expect(arp()).toMatchObject({ scale: "lydian", chord: [1, 3, 5] });
    expect(sql(`select effective->'transition'->>'time' from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("8");
    // the fields it left out are adopted from what played, so they stay too
    expect(JSON.parse(sql(`select voice::text from sessions where id='${session_id}'`))).toMatchObject({ scale: "lydian", chord: [1, 3, 5], wave: expect.any(String), root: expect.any(String) });
  });

  it("gives two sessions with the same axes different characters", async () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: { warmth: 0.55, closeness: 0.55, joy: 0.6, calm: 0.6, spontaneity: 0.5 }, final: true } as never, tick());
      shapes.add(sql(`select (effective->'arp'->'root')::text || (effective->'arp'->'chord')::text || (effective->'arp'->'octaves')::text from states where session_id='${session_id}' order by created_at desc limit 1`));
    }
    expect(shapes.size).toBeGreaterThan(2);
  });

  it("keeps colour, stack, pad and LFOs between calls until Claude changes them", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const last = () => JSON.parse(sql(`select effective::text from states where session_id='${session_id}' order by created_at desc limit 1`));
    await svc.setSound(dbA, A, { session_id, mood, final: true, colour: { hue: 0, saturation: 1, lightness: 0.5 },
      synth: { osc: { stack: [7, 12] }, pad: { notes: ["D3", "A3"] }, lfo: [{ target: "amp", rate: 80, depth: 1, shape: "sine" }] } } as never, tick());
    // a later call that sends none of them
    const r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(r.colour).toMatchObject({ h: 0, s: 1 });
    expect(r.playing).toMatchObject({ stack: [7, 12], pad: { notes: ["D3", "A3"] }, lfo: ["amp 80Hz depth 1 sine"] });
    expect(last().pad.on).toBe(true);
    // clearing
    const c = await svc.setSound(dbA, A, { session_id, mood, final: true, colour: { mode: "follow" }, synth: { osc: { stack: [] }, lfo: [], pad: { on: false } } } as never, tick());
    expect(c.playing).not.toHaveProperty("stack"); expect(c.playing).not.toHaveProperty("pad");
    expect((c.playing as { lfo: string[] }).lfo[0]).toMatch(/^cutoff/); // back to the mapped LFO
    expect((c.colour as { h: number }).h).not.toBe(0);
  });

  it("an auto-drawn voice keeps its key and its mode follows joy, with hysteresis; a voice the model sends stays fixed", async () => {
    const m = (joy: number) => ({ warmth: 0.5, closeness: 0.5, joy, calm: 0.6, spontaneity: 0.3 });
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const call = (joy: number, extra: object = {}) => svc.setSound(dbA, A, { session_id, mood: m(joy), final: true, ...extra } as never, tick(25_000));
    const scale = (r: Record<string, unknown>) => (r.playing as { scale: string }).scale;
    const root = () => scale({ playing: JSON.parse(sql(`select effective->'arp' from states where session_id='${session_id}' order by created_at desc limit 1`)) });
    const first = await call(0.5);
    expect(scale(first)).toMatch(/dorian$/); expect((first.notes as string[]).join(" ")).toMatch(/follows your joy/);
    const rootName = (r: Record<string, unknown>) => (r.playing as { scale: string }).scale.split(" ")[0];
    const up = await call(0.95);
    expect(scale(up)).toMatch(/lydian$/); expect(rootName(up)).toBe(rootName(first));
    expect((up.notes as string[]).join(" ")).toMatch(/moved the mode of your voice from dorian to lydian/);
    expect(sql(`select effective->'transition'->>'time' from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("8");
    for (const joy of [0.62, 0.7, 0.62, 0.7]) expect(scale(await call(joy))).toMatch(/lydian$/); // hovering high: no flip
    expect(scale(await call(0.1))).toMatch(/phrygian$/);
    void root;
    // a voice with a scale of its own is never touched
    const minor = { root: "A2", scale: "minor", chord: [1, 3, 5], pattern: "up", octaves: 1, wave: "triangle" };
    const fixed = await svc.startSession(dbA, A, { voice: minor } as never, tick());
    const f1 = await svc.setSound(dbA, A, { session_id: fixed.session_id, mood: m(0.95), final: true } as never, tick(25_000));
    expect(scale(f1)).toMatch(/minor$/);
    const f2 = await svc.setSound(dbA, A, { session_id: fixed.session_id, mood: m(0.95), final: true, voice: { scale: "major" } } as never, tick(25_000));
    expect(scale(f2)).toMatch(/major$/);
    expect(scale(await svc.setSound(dbA, A, { session_id: fixed.session_id, mood: m(0.1), final: true } as never, tick(25_000)))).toMatch(/major$/); // sent voice: stays fixed
  });

  it("keep_voice freezes what plays now as the voice, and says so when the mood redraws it", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const happy = { warmth: 0.9, closeness: 0.8, joy: 0.9, calm: 0.8, spontaneity: 0.2 };
    const sad = { warmth: 0.1, closeness: 0.3, joy: 0.1, calm: 0.2, spontaneity: 0.8 };
    const first = await svc.setSound(dbA, A, { session_id, mood: happy, final: true } as never, tick());
    expect((first.notes as string[]).join(" ")).toMatch(/first sound is now your voice/);
    const moved = await svc.setSound(dbA, A, { session_id, mood: sad, final: true } as never, tick());
    const rootOf = (r: Record<string, unknown>) => (r.playing as { scale: string }).scale.split(" ")[0];
    expect(rootOf(moved)).toBe(rootOf(first)); // the mood moved the mode (joy), not the key
    const kept = await svc.setSound(dbA, A, { session_id, mood: sad, final: true, keep_voice: true } as never, tick());
    expect((kept.notes as string[]).join(" ")).toMatch(/voice kept/);
    const scale = (kept.playing as { scale: string }).scale;
    const after = await svc.setSound(dbA, A, { session_id, mood: happy, final: true } as never, tick());
    expect((after.playing as { scale: string }).scale).toBe(scale);
    expect((after.playing as { wave: string }).wave).toBe((kept.playing as { wave: string }).wave);
  });

  it("holds a big jump in level to a few dB per call, and says so", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const calm = { warmth: 0.6, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 };
    const first = await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
    const db0 = (first.sound as { loudness_db: number }).loudness_db;
    const loud = await svc.setSound(dbA, A, { session_id, mood: { warmth: 0.3, closeness: 0.6, joy: 0.3, calm: 0.05, spontaneity: 0.9, tension: 0.9 }, final: true } as never, tick(25_000));
    const db1 = (loud.sound as { loudness_db: number }).loudness_db;
    expect(db1 - db0).toBeLessThanOrEqual(5); // 4 dB step, the reading is rounded
    expect((loud.clamped as string[]).join(" ")).toMatch(/level held/);
    const calmer = await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
    expect(((calmer.clamped ?? []) as string[]).join(" ")).not.toMatch(/level held/); // going down is never held
  });

  it("tells the model what the owner pressed, once, and get_feedback only looks", async () => {
    const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
    sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'calmer', now()), ('${session_id}', '${A}', 'calmer', now()), ('${session_id}', '${A}', 'more_of_this', now())`);
    const peek = await svc.getFeedback(dbA, A, { session_id }, tick());
    expect((peek.reactions as string[]).join(" ")).toMatch(/calmer x2/);
    const a = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect((a.reactions as string[]).join(" ")).toMatch(/calmer x2.*more of this|more of this.*calmer x2/);
    const b = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect(b).not.toHaveProperty("reactions");
  });

  it("returns what the listener heard in every mode, apart from the reactions, once", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick()); // Self
    sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'heard_tense', now()), ('${session_id}', '${A}', 'heard_tense', now()), ('${session_id}', '${A}', 'calmer', now()), ('${session_id}', '${B}', 'heard_sad', now())`); // B's reading: not the owner's, dropped
    const peek = await svc.getFeedback(dbA, A, { session_id }, tick());
    expect(peek.heard).toEqual([expect.stringMatching(/^tense x2, /)]);
    expect(peek).not.toHaveProperty("reactions");
    const a = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect(a.heard).toEqual([expect.stringMatching(/^tense x2, /)]);
    expect(a).not.toHaveProperty("reactions");
    expect(await svc.setSound(dbA, A, { session_id, final: true } as never, tick())).not.toHaveProperty("heard");
    const ext = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
    sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${ext.session_id}', '${A}', 'heard_reproach', now()), ('${ext.session_id}', '${A}', 'softer', now())`);
    const b = await svc.setSound(dbA, A, { session_id: ext.session_id, final: true } as never, tick());
    expect(b.heard).toEqual([expect.stringMatching(/^blaming, /)]);
    expect(b.reactions).toEqual([expect.stringMatching(/^softer, /)]);
  });

  describe("the listener's level (#170)", () => {
    const quiet = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 };
    const loud = { warmth: 0.5, closeness: 0.5, joy: 0.6, calm: 0.45, spontaneity: 0.4 };
    const lastRow = (sid: string) => JSON.parse(sql(`select json_build_object('db', analysis->'sound'->'loudness_db', 'e', effective) from states where session_id='${sid}' order by created_at desc limit 1`));
    const levelOf = (sid: string) => sql(`select coalesce(sticky->>'levelDb', '0') from sessions where id='${sid}'`);
    const press = (sid: string, kind: string, n = 1) => {
      for (let k = 0; k < n; k++) sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${sid}', '${A}', '${kind}', to_timestamp(${clock - 5_000 + k} / 1000.0))`);
    };
    const notesOf = (r: Record<string, unknown>) => ((r.notes as string[] | undefined) ?? []).join(" ");

    it("lowers the level 3 dB per softer, on the call that delivers it, and keeps it on later calls", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      const was = lastRow(session_id);
      press(session_id, "softer");
      const r = await svc.setSound(dbA, A, { session_id, mood: loud, final: true } as never, tick(25_000));
      expect(r.reactions).toEqual([expect.stringMatching(/^softer, /)]);
      expect(notesOf(r)).toMatch(/level: the listener asked for softer, so everything plays 3 dB lower from now on \(-3 dB in all, -12 at most/);
      expect(lastRow(session_id).db).toBeLessThanOrEqual(was.db - 2);
      expect(lastRow(session_id).e.listenerDb).toBe(-3);
      expect(levelOf(session_id)).toBe("-3");
      // a plain call later keeps it: the same mood as before the press plays 3 dB under its old level
      const later = await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      expect(notesOf(later)).not.toMatch(/level:/);
      expect(lastRow(session_id).db).toBeLessThanOrEqual(was.db - 1); // whole-dB readings
      expect(lastRow(session_id).e.volume).toBeCloseTo(was.e.volume * 10 ** (-3 / 20), 3);
      // harsher brings it back up
      press(session_id, "harsher");
      const up = await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      expect(notesOf(up)).toMatch(/level: the listener's harsher raised the level 3 dB \(back to the usual level\)/);
      expect(levelOf(session_id)).toBe("0");
      expect(lastRow(session_id).e.listenerDb).toBeUndefined();
    });

    it("stops at -12 dB, and a calmer answer is no louder", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      press(session_id, "softer", 6);
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      expect(levelOf(session_id)).toBe("-12");
      press(session_id, "softer");
      const floor = await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      expect(notesOf(floor)).toMatch(/at its lowest \(-12 dB\)/);
      const was = lastRow(session_id).db;
      press(session_id, "calmer");
      await svc.setSound(dbA, A, { session_id, mood: { ...loud, calm: 0.3 }, final: true } as never, tick(25_000));
      expect(lastRow(session_id).db).toBeLessThanOrEqual(was);
    });

    it("plays Self at the usual level, keeps the listener's level for the next listener mode, and reads the sound at the usual level", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      const plain = await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      press(session_id, "softer", 2);
      const low = await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      expect(lastRow(session_id).e.listenerDb).toBe(-6);
      // reads_as does not read the listener's level as calm
      expect((low.reads_as as Record<string, number>).calm).toBeCloseTo((plain.reads_as as Record<string, number>).calm, 1);
      const self = await svc.setSound(dbA, A, { session_id, mode: "self", mood: quiet, final: true } as never, tick(25_000));
      expect(lastRow(session_id).e.listenerDb).toBeUndefined();
      expect(levelOf(session_id)).toBe("-6");
      expect(notesOf(self)).toMatch(/level: Self plays at the usual level; the listener's -6 dB comes back in a listener mode/);
      const back = await svc.setSound(dbA, A, { session_id, mode: "attuned", mood: quiet, final: true } as never, tick(25_000));
      expect(lastRow(session_id).e.listenerDb).toBe(-6);
      expect(notesOf(back)).toMatch(/level: the listener's -6 dB applies again/);
    });

    it("carries the level into a Strudel pattern and through recall", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "jukebox" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: quiet, final: true } as never, tick(25_000));
      await svc.moment(dbA, A, { session_id, action: "keep", name: "plain", final: true }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*2")', bpm: 96, final: true }, tick(25_000));
      press(session_id, "softer");
      const r = await svc.setSound(dbA, A, { session_id, colour: { h: 300 }, final: true } as never, tick(25_000));
      expect(notesOf(r)).toMatch(/level: the listener asked for softer/);
      expect(lastRow(session_id).e).toMatchObject({ engine: "strudel", listenerDb: -3 });
      await svc.strudelMode(dbA, A, { session_id, on: false, final: true }, tick(25_000));
      await svc.moment(dbA, A, { session_id, action: "recall", name: "plain", final: true }, tick(25_000));
      expect(lastRow(session_id).e.listenerDb).toBe(-3); // the moment was kept at 0 dB: it plays at the session's level now
      expect(levelOf(session_id)).toBe("-3");
    });
  });

  it("holds the pace of a switch to Attuned to the pattern that just played", async () => {
    const { session_id } = await svc.startSession(dbA, A, { mode: "jukebox" }, tick());
    await svc.setSound(dbA, A, { session_id, mood: { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 }, final: true } as never, tick(25_000));
    await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*2")', bpm: 80, final: true }, tick(25_000));
    await svc.strudelMode(dbA, A, { session_id, on: false, final: false }, tick(5_000));
    const r = await svc.setSound(dbA, A, { session_id, mode: "attuned", mood: { warmth: 0.5, closeness: 0.5, joy: 0.6, calm: 0.3, spontaneity: 0.4 }, final: true } as never, tick(3_000));
    expect(JSON.parse(sql(`select effective->'arp'->>'tempo' from states where session_id='${session_id}' order by created_at desc limit 1`))).toBe(80);
    expect((r.clamped as string[]).join(" ")).toMatch(/pace held: .*tempo \d+ to 80 bpm, the tempo of the Strudel pattern that just played; .*only the tempo is held/);
    // the next call leaves the hold: a big tempo step glides over 10 s, not the default 4
    const next = await svc.setSound(dbA, A, { session_id, mood: { warmth: 0.5, closeness: 0.5, joy: 0.6, calm: 0.3, spontaneity: 0.4 }, final: true } as never, tick(25_000));
    expect(((next.notes as string[] | undefined) ?? []).join(" ")).toMatch(/tempo 80 to \d+: it glides over 10 s/);
  });

  it("never returns reactions in Self, and drops them so they do not surface after a switch", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'stormier', now())`);
    expect(await svc.getFeedback(dbA, A, { session_id }, tick())).not.toHaveProperty("reactions");
    expect(await svc.setSound(dbA, A, { session_id, final: true } as never, tick())).not.toHaveProperty("reactions");
    const sw = await svc.setSound(dbA, A, { session_id, mode: "attuned", final: true } as never, tick());
    expect(sw).not.toHaveProperty("reactions");
  });

  it("tells the model what guests pressed, as counts, once, in every mode, and only the owner gets it", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick()); // Self: guests are information, so they come back here too
    sql(`select public.send_emoji('${session_id}', 'guest-dev-1', 'heart'), public.send_emoji('${session_id}', 'guest-dev-2', 'heart'), public.send_emoji('${session_id}', 'guest-dev-3', 'crying')`);
    expect((await svc.getFeedback(dbB, B, { session_id }, tick()).catch((e) => e)) instanceof Error).toBe(true); // B has no access to this session
    const peek = await svc.getFeedback(dbA, A, { session_id }, tick());
    expect(peek.guests).toMatch(/^❤️ 2 · 😭 1, over the last \d+ min$/);
    expect(peek).not.toHaveProperty("heard"); // not confused with the owner's reading
    expect(sql(`select count(*) from emoji_reactions where session_id='${session_id}' and delivered_at is null`)).toBe("3"); // get_feedback never claims
    const a = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect(a.guests).toMatch(/^❤️ 2 · 😭 1/);
    expect(await svc.setSound(dbA, A, { session_id, final: true } as never, tick())).not.toHaveProperty("guests");
    expect(sql(`select count(*) from reactions where session_id='${session_id}'`)).toBe("0");
  });

  describe("live tuning: listen", () => {
    // a listener who is playing right now, placed on the test clock (as in "counts players" above)
    const beat = (session_id: string) => {
      sql(`insert into player_heartbeats (session_id, user_id, device_id, audio, volume, delay) values ('${session_id}', '${A}', 'd1', 'playing', 0.4, null)`);
      sql(`alter table player_heartbeats disable trigger player_heartbeats_touch; update player_heartbeats set seen_at = to_timestamp(${clock} / 1000.0) where session_id='${session_id}'; alter table player_heartbeats enable trigger player_heartbeats_touch`);
    };
    const listeningUntil = (id: string) => sql(`select coalesce(listening_until::text, 'null') from sessions where id='${id}'`);
    // a clock the sleeps move, so no test waits for real
    const fake = (onSleep: (n: number) => void = () => {}) => {
      let t = clock, n = 0;
      return { now: () => t, sleep: async (ms: number) => { t += ms; onSleep(++n); } };
    };

    it("refuses in Self", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await expect(svc.listen(dbA, A, { session_id, seconds: 10 })).rejects.toMatchObject({ code: "not_in_this_mode" });
    });

    it("returns at once when nobody listens", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      const r = await svc.listen(dbA, A, { session_id, seconds: 10 }, fake());
      expect(r).toEqual({ event: "nobody_listening", waited_s: 0, players: 0 });
      expect(listeningUntil(session_id)).toBe("null");
    });

    it("returns the presses as soon as they come, marks the wait while it lasts, and leaves the presses for set_sound", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      beat(session_id);
      const seen: string[] = [];
      const f = fake((n) => {
        seen.push(listeningUntil(session_id));
        if (n === 2) sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'calmer', now())`);
      });
      const r = await svc.listen(dbA, A, { session_id, seconds: 40 }, f);
      expect(r.event).toBe("reactions");
      expect(r.reactions?.join(" ")).toMatch(/calmer/);
      expect(r.players).toBe(1);
      expect(r.waited_s).toBe(3); // two sleeps of 1.5 s
      expect(seen.length).toBe(2); expect(seen.every((x) => x !== "null")).toBe(true); // set during the wait
      expect(listeningUntil(session_id)).toBe("null"); // cleared after it
      expect(sql(`select count(*) from reactions where session_id='${session_id}' and delivered_at is null`)).toBe("1"); // listen never claims
      const a = await svc.setSound(dbA, A, { session_id, final: true } as never, tick(5000));
      expect((a.reactions as string[]).join(" ")).toMatch(/calmer/);
    });

    it("does not end the wait on a guest emoji alone, and leaves it for set_sound to claim", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      beat(session_id);
      const r = await svc.listen(dbA, A, { session_id, seconds: 40 }, fake((n) => { if (n === 2) sql(`select public.send_emoji('${session_id}', 'guest-dev-1', 'happy')`); }));
      expect(r.event).toBe("idle"); // guests ride along with the owner's presses; they never trigger a turn
      expect(sql(`select count(*) from emoji_reactions where session_id='${session_id}' and delivered_at is null`)).toBe("1");
      expect((await svc.setSound(dbA, A, { session_id, final: true } as never, tick(5000))).guests).toMatch(/^😊 1/);
    });

    it("returns a press made during the wait even when a call sent in the same batch already marked it read", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      beat(session_id);
      // an old press set_sound delivered before the wait: never returned again
      sql(`insert into reactions (session_id, user_id, kind, created_at, delivered_at) values ('${session_id}', '${A}', 'darker', to_timestamp(${clock - 60_000} / 1000.0), now())`);
      const f = fake((n) => {
        if (n === 1) sql(`insert into reactions (session_id, user_id, kind, created_at, delivered_at) values ('${session_id}', '${A}', 'calmer', to_timestamp(${clock + 1500} / 1000.0), now())`);
      });
      const r = await svc.listen(dbA, A, { session_id, seconds: 20 }, f);
      expect(r.event).toBe("reactions");
      expect(r.reactions).toEqual([expect.stringMatching(/^calmer, /)]);
    });

    it("returns presses that are already waiting without a wait", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      beat(session_id);
      sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'softer', now())`);
      const r = await svc.listen(dbA, A, { session_id, seconds: 10 }, fake());
      expect(r).toMatchObject({ event: "reactions", waited_s: 0 });
      expect(listeningUntil(session_id)).toBe("null");
    });

    it("goes idle at the deadline", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      beat(session_id);
      const r = await svc.listen(dbA, A, { session_id, seconds: 6 }, fake());
      expect(r).toMatchObject({ event: "idle", waited_s: 6, players: 1 });
      expect(r).not.toHaveProperty("reactions");
      expect(listeningUntil(session_id)).toBe("null");
    });

    it("stops when the owner turns live tuning off, the mode changes, or the session ends", async () => {
      const mk = async () => { const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick()); beat(session_id); return session_id; };
      const a = await mk(); sql(`update sessions set settings = settings || '{"live": true}' where id='${a}'`);
      expect(await svc.listen(dbA, A, { session_id: a, seconds: 20 }, fake((n) => { if (n === 1) sql(`update sessions set settings = settings || '{"live": false}' where id='${a}'`); }))).toMatchObject({ event: "stopped" });
      const b = await mk();
      expect(await svc.listen(dbA, A, { session_id: b, seconds: 20 }, fake((n) => { if (n === 1) sql(`update sessions set mode='internal' where id='${b}'`); }))).toMatchObject({ event: "mode_changed", mode: expect.stringMatching(/Self/) });
      const c = await mk();
      expect(await svc.listen(dbA, A, { session_id: c, seconds: 20 }, fake((n) => { if (n === 1) sql(`update sessions set ended_at=now() where id='${c}'`); }))).toMatchObject({ event: "session_ended" });
      for (const id of [a, b, c]) expect(listeningUntil(id)).toBe("null");
    });

    it("returns idle at once when the request is aborted", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      beat(session_id);
      const ctl = new AbortController();
      const r = await svc.listen(dbA, A, { session_id, seconds: 40 }, { ...fake((n) => { if (n === 1) ctl.abort(); }), signal: ctl.signal });
      expect(r.event).toBe("idle");
      expect(listeningUntil(session_id)).toBe("null");
    });

    it("tells a running session about live tuning on a final call in Attuned, never in Self or on a non-final call", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "attuned" }, tick());
      sql(`update sessions set settings = settings || '{"live": true}' where id='${session_id}'`);
      const non = await svc.setSound(dbA, A, { session_id, mood, final: false } as never, tick(5000));
      expect(JSON.stringify(non.notes ?? [])).not.toMatch(/live tuning/);
      const fin = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000));
      expect((fin.notes as string[]).join(" ")).toMatch(/live tuning is on/);
      const off = await svc.startSession(dbA, A, {}, tick());
      sql(`update sessions set settings = settings || '{"live": true}' where id='${off.session_id}'`);
      const self = await svc.setSound(dbA, A, { session_id: off.session_id, mood, final: true } as never, tick(5000));
      expect(JSON.stringify(self.notes ?? [])).not.toMatch(/live tuning/);
    });
  });

  it("starts on auto and the internal face by default, or on the external face when asked (old names still work)", async () => {
    const int = await svc.startSession(dbA, A, {}, tick());
    expect(int.mode).toBe("Self"); expect(int.guidance).toMatch(/^Mode Self/); expect(int.guidance).toMatch(/on auto/);
    const ext = await svc.startSession(dbA, A, { mode: "outer" }, tick());
    expect(ext.mode).toBe("Attuned"); expect(ext.guidance).toMatch(/^Mode Attuned/);
    expect(sql(`select mode || '/' || mode_policy from sessions where id = '${ext.session_id}'`)).toBe("external/auto");
    expect(sql(`select mode from sessions where id = '${int.session_id}'`)).toBe("internal");
  });

  it("does not list the start state as a turn, and reads the same sound the same way twice", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const call = () => svc.setSound(dbA, A, { session_id, mood, final: false, synth: { arp: { pattern: "random" } } } as never, tick());
    await call(); // the first one still glides in from the start state
    const b = await call(), c = await call();
    expect(c.reads_as).toEqual(b.reads_as);
    const seen = await svc.inspect(dbA, A, { session_id, what: "history" }) as { history: string[] };
    expect(seen.history.join("\n")).not.toMatch(/turn 0/);
  });

  it("sends the rules of a mode once, when the mode differs from the one last guided", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick()) as { session_id: string };
    expect(sql(`select guided_mode from sessions where id = '${session_id}'`)).toBe("internal");
    let r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000)) as Record<string, unknown>;
    expect(r).not.toHaveProperty("guidance");
    r = await svc.setSound(dbA, A, { session_id, mood, mode: "sandbox", final: true } as never, tick(5000)) as Record<string, unknown>;
    expect(r.guidance).toMatch(/^Mode Jukebox/); expect(r.mode).toBe("Jukebox");
    expect(sql(`select guided_mode from sessions where id = '${session_id}'`)).toBe("sandbox");
    r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000)) as Record<string, unknown>;
    expect(r).not.toHaveProperty("guidance");
  });

  it("switches the face at once on auto, logs it, and an owner lock is final", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const call = (extra: object, ms = 1000) => svc.setSound(dbA, A, { session_id, mood, final: true, ...extra } as never, tick(ms));
    let r = await call({ mode: "attuned" });
    expect(r.mode).toBe("Attuned"); expect((r.notes as string[]).join(" ")).toMatch(/switched to Attuned/);
    r = await call({ mode: "self" });
    expect(r.mode).toBe("Self");
    r = await call({ mode: "attuned" }); // no timer: straight back
    expect(r.mode).toBe("Attuned");
    // the owner locks the face: the model cannot move it
    expect((await dbA.rpc("set_mode_policy", { p_session: session_id, p_policy: "internal" })).error).toBeNull();
    r = await call({ mode: "attuned" });
    expect(r.mode).toBe("Self, locked by the owner"); expect((r.notes as string[]).join(" ")).toMatch(/locked/);
    expect((await dbB.rpc("set_mode_policy", { p_session: session_id, p_policy: "auto" })).error).not.toBeNull(); // not the owner
    const seen = await svc.inspect(dbA, A, { session_id, what: "history" }) as { face_changes: string[] };
    const log = seen.face_changes.join("|");
    expect(log).toMatch(/you switched to Attuned/); expect(log).toMatch(/you switched to Self/); expect(log).toMatch(/owner locked Self/);
    expect(seen.face_changes).toHaveLength(4);
  });

  it("the first sound becomes the voice: a different mood later keeps the root, and the wave follows warmth", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const sad = { warmth: 0.2, closeness: 0.3, joy: 0.1, calm: 0.3, spontaneity: 0.4 };
    const glad = { warmth: 0.9, closeness: 0.8, joy: 0.95, calm: 0.7, spontaneity: 0.6 };
    const a = await svc.setSound(dbA, A, { session_id, mood: sad, final: true } as never, tick(25_000));
    expect((a.notes as string[]).join(" ")).toMatch(/first sound is now your voice/);
    const b = await svc.setSound(dbA, A, { session_id, mood: glad, final: true } as never, tick(25_000));
    const key = (r: Record<string, unknown>) => (r.playing as { scale: string }).scale.split(" ")[0]; // the root
    expect(key(b)).toBe(key(a));
    expect((a.playing as { wave: string }).wave).toBe("square"); expect((b.playing as { wave: string }).wave).toBe("sine"); // warmth 0.2 (stretched below 0.2: square) then 0.9
    expect((b.notes as string[] | undefined ?? []).join(" ")).not.toMatch(/first sound is now/);
  });

  it("says when the tempo changed (it glides), and keeps the last mood when none is sent", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const slow = { warmth: 0.6, closeness: 0.6, joy: 0.6, calm: 0.95, spontaneity: 0.2 };
    const fast = { warmth: 0.6, closeness: 0.6, joy: 0.6, calm: 0.05, spontaneity: 0.2 };
    const a = await svc.setSound(dbA, A, { session_id, mood: slow, final: true } as never, tick());
    const b = await svc.setSound(dbA, A, { session_id, mood: fast, final: true } as never, tick());
    expect((b.notes as string[]).join(" ")).toMatch(/tempo \d+ to \d+: it glides over/);
    const c = await svc.setSound(dbA, A, { session_id, final: true, synth: { filter: { cutoff: 900 } } } as never, tick());
    expect(c.intent).toEqual(b.intent);
    expect((c.playing as { scale: string }).scale).toBe((b.playing as { scale: string }).scale);
    expect((c.notes as string[]).join(" ")).toMatch(/mood kept from your last call/);
    expect(a.notes ?? []).not.toContain("mood kept from your last call");
  });

  it("ends sessions that had no sound for a week when a new one starts, and leaves recent ones alone", async () => {
    const old = await svc.startSession(dbA, A, {}, tick());
    const recent = await svc.startSession(dbA, A, {}, tick());
    sql(`update sessions set last_active_at = now() - interval '8 days' where id='${old.session_id}'`);
    sql(`update sessions set last_active_at = now() - interval '2 days' where id='${recent.session_id}'`);
    await svc.startSession(dbA, A, {}, Date.now());
    expect(sql(`select (ended_at is not null) from sessions where id='${old.session_id}'`)).toBe("t");
    expect(sql(`select (ended_at is not null) from sessions where id='${recent.session_id}'`)).toBe("f");
  });

  it("stores an analysis with every state and returns sound and reads_as", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(r.sound).toMatchObject({ brightness: expect.any(String), density: expect.any(String) });
    expect(Object.keys(r.reads_as as object).sort()).toEqual(["calm", "closeness", "joy", "spontaneity", "tension", "warmth"]);
    expect(sql(`select (analysis is not null) from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("t");
    const g = await svc.getFeedback(dbA, A, { session_id }, tick());
    expect(g.reads_as).toEqual(r.reads_as);
  });

  it("inspect lists the last states as text, oldest first, with the note and the reading", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    for (let i = 0; i < 3; i++) await svc.setSound(dbA, A, { session_id, mood, final: true, note: `n${i}` } as never, tick(25_000));
    const h = await svc.inspect(dbA, A, { session_id, what: "history" }, clock);
    expect(h.history).toHaveLength(3); // the start state is not a turn
    expect(h.history[2]).toMatch(/final .* · sent warm 0\.8 close 0\.7 joy 0\.6 calm 0\.75 spont 0\.3 · read warm [\d.]+ .* · "n2"$/);
    await expect(svc.inspect(dbB, B, { session_id, what: "history" })).rejects.toMatchObject({ code: "unknown_session" });
  });

  describe("inspect snapshot", () => {
    const jpeg = "data:image/jpeg;base64,QUJDRA==";
    const stateOf = (id: string) => sql(`select current_state_id from sessions where id='${id}'`);
    const measured = { seconds: 7.9, loudness_db: -24.1, brightness: "mid" };

    it("returns the owner's picture as an image part and says it is of the current sound", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      const put = await dbA.rpc("put_snapshot", { p_session: session_id, p_state: stateOf(session_id), p_image: jpeg, p_measured: measured, p_volume: 0.6 });
      expect(put.error).toBeNull();
      const r = await svc.inspect(dbA, A, { session_id, what: "snapshot" }) as { __image: { mime: string; base64: string }; of: string; measured: unknown; listener_volume: number };
      expect(r.__image).toEqual({ mime: "image/jpeg", base64: "QUJDRA==" });
      expect(r.of).toBe("the current sound");
      expect(r.measured).toEqual(measured);
      expect(r.listener_volume).toBeCloseTo(0.6);
      await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
      expect((await svc.inspect(dbA, A, { session_id, what: "snapshot" }) as { of: string }).of).toMatch(/^an earlier sound: the current one is newer/);
      // a picture that is old as well: the player is probably hidden, and the model is told so
      expect((await svc.inspect(dbA, A, { session_id, what: "snapshot" }, Date.now() + 120_000) as { of: string }).of).toMatch(/on their screen \(not minimized/);
    });

    it("marks the snapshot seen with a copy of the image, and only the owner can", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await dbA.rpc("put_snapshot", { p_session: session_id, p_state: null, p_image: jpeg, p_measured: {}, p_volume: 0.6 });
      expect(sql(`select seen_at is null and seen_image is null from snapshots where session_id='${session_id}'`)).toBe("t");
      await svc.inspect(dbA, A, { session_id, what: "snapshot" });
      expect(sql(`select seen_at is not null and seen_image = image from snapshots where session_id='${session_id}'`)).toBe("t");
      const other = await dbB.rpc("mark_snapshot_seen", { p_session: session_id });
      expect(other.error?.message).toMatch(/only the session owner/);
    });

    it("is refused to another user, and put_snapshot raises for them", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      const put = await dbB.rpc("put_snapshot", { p_session: session_id, p_state: null, p_image: jpeg, p_measured: {}, p_volume: 0.5 });
      expect(put.error?.message).toMatch(/only the session owner/);
      await expect(svc.inspect(dbB, B, { session_id, what: "snapshot" })).rejects.toMatchObject({ code: "unknown_session" });
    });

    it("says so when the owner turned picture feedback off", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      sql(`update sessions set settings = settings || '{"image_feedback":"off"}'::jsonb where id='${session_id}'`);
      await expect(svc.inspect(dbA, A, { session_id, what: "snapshot" })).rejects.toMatchObject({ code: "image_feedback_off" });
    });

    it("returns snapshot null while the player has taken none", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      expect(await svc.inspect(dbA, A, { session_id, what: "snapshot" })).toMatchObject({ snapshot: null, why: expect.stringMatching(/no snapshot yet/) });
    });

    it("refuses an image that is not a JPEG data URL", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      const put = await dbA.rpc("put_snapshot", { p_session: session_id, p_state: null, p_image: "data:image/png;base64,QUJDRA==", p_measured: {}, p_volume: 0.5 });
      expect(put.error?.message).toMatch(/small JPEG/);
      expect(sql(`select count(*) from snapshots where session_id='${session_id}'`)).toBe("0");
    });
  });

  it("writes the shared timeline into every state: the step counters keep counting from one state to the next", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const grid = () => JSON.parse(sql(`select effective->'grid' from states where session_id='${session_id}' order by created_at desc limit 1`));
    expect(grid()).toEqual({ arp: 0, bass: 0, beat: 0 });
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(10_000));
    const g1 = grid();
    expect(g1.arp).toBeGreaterThan(5); expect(g1.bass).toBeGreaterThan(1); // 10 s of the neutral state's steps
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(10_000));
    expect(grid().arp).toBeGreaterThan(g1.arp + 10);
  });

  it("falls back to the latest session when none is given, and refuses other people's sessions", async () => {
    const mine = await svc.startSession(dbA, A, {}, tick());
    const f = await svc.getFeedback(dbA, A, {}, clock);
    expect(f.notes).toEqual(expect.arrayContaining([`session_id missing: used ${mine.session_id}`]));
    await expect(svc.getFeedback(dbB, B, { session_id: mine.session_id }, clock)).rejects.toMatchObject({ code: "unknown_session" });
    await expect(svc.getFeedback(dbB, B, {}, clock)).rejects.toMatchObject({ code: "no_session" });
  });

  it("rejects updates to an ended session", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    sql(`update sessions set ended_at = now() where id='${session_id}'`);
    await expect(svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick())).rejects.toMatchObject({ code: "session_ended" });
  });

  it("keeps at most 10 active sessions", async () => {
    for (let i = 0; i < 11; i++) await svc.startSession(dbA, A, {}, tick());
    expect(Number(sql(`select count(*) from sessions where owner_id='${A}' and ended_at is null`))).toBeLessThanOrEqual(10);
  });

  describe("strudel_mode", () => {
    const code = 'note("c3 e3 g3 b3").s("sawtooth").gain(0.5)';
    const state = (sid: string) => JSON.parse(sql(`select effective from states where session_id='${sid}' order by created_at desc limit 1`));

    it("is for the external face, and the owner's lock and code switch are final", async () => {
      const internal = await svc.startSession(dbA, A, {}, tick());
      await expect(svc.strudelMode(dbA, A, { session_id: internal.session_id, on: true, code, bpm: 120, final: true }, tick(5000))).rejects.toMatchObject({ code: "self_mode", message: expect.stringMatching(/Attuned.*Jukebox.*set_sound mode/) });
      const ext = await svc.startSession(dbA, A, { mode: "external" }, tick());
      expect((await dbA.rpc("set_mode_policy", { p_session: ext.session_id, p_policy: "internal" })).error).toBeNull();
      await expect(svc.strudelMode(dbA, A, { session_id: ext.session_id, on: true, code, bpm: 120, final: true }, tick(5000))).rejects.toMatchObject({ code: "self_locked", message: expect.stringMatching(/mode stays Self: the owner locked it\. It is final/) });
      expect((await dbA.rpc("set_mode_policy", { p_session: ext.session_id, p_policy: "external" })).error).toBeNull();
      expect((await dbB.rpc("set_allow_code", { p_session: ext.session_id, p_allow: false })).error).not.toBeNull(); // not the owner
      expect((await dbA.rpc("set_allow_code", { p_session: ext.session_id, p_allow: false })).error).toBeNull();
      await expect(svc.strudelMode(dbA, A, { session_id: ext.session_id, on: true, code, bpm: 120, final: true }, tick(5000))).rejects.toMatchObject({ code: "code_off" });
    });

    it("parses the code and says where a syntax error is; needs code and bpm", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await expect(svc.strudelMode(dbA, A, { session_id, on: true, code: 'note("c3".s(', bpm: 100, final: true }, tick(5000))).rejects.toMatchObject({ code: "syntax_error", message: expect.stringMatching(/line 1/) });
      await expect(svc.strudelMode(dbA, A, { session_id, on: true, bpm: 100, final: true }, tick(5000))).rejects.toMatchObject({ code: "bad_input" });
      expect(Number(sql(`select count(*) from states where session_id='${session_id}'`))).toBe(1); // nothing was saved
    });

    it("switches the engine on and off, keeps the beat running, and only strudel_mode changes the engine", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000));
      const synth = state(session_id);
      const on = await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 140, final: true, colour: { scene: "rain", sync: "beat" } }, tick(10_000));
      expect(on.playing).toMatchObject({ engine: "strudel", bpm: 140 });
      expect(on).not.toHaveProperty("reads_as"); // no reading for Strudel
      const e = state(session_id);
      expect(e.engine).toBe("strudel"); expect(e.pattern).toEqual({ code, bpm: 140 });
      expect(e.arp.root).toBe(synth.arp.root); // the paused synth is kept, to come back to
      expect(e.colour.scene).toBe("rain");
      expect(e.grid.beat).toBeGreaterThan(synth.grid.beat + 10); // the beat kept counting through the switch
      // set_sound cannot change the engine: only the picture applies
      const s2 = await svc.setSound(dbA, A, { session_id, mood: { ...mood, joy: 0.1 }, colour: { hue: 20 }, final: true } as never, tick(5000));
      expect(state(session_id).engine).toBe("strudel");
      expect((s2.notes as string[]).join(" ")).toMatch(/Strudel is on/);
      expect(s2.playing).toMatchObject({ engine: "strudel" });
      expect(state(session_id).colour.h).toBe(20);
      // new code replaces it, the same tempo continues the beat
      await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*4")', bpm: 140, final: true }, tick(5000));
      expect(state(session_id).pattern.code).toBe('s("bd*4")');
      // back to the synth
      const off = await svc.strudelMode(dbA, A, { session_id, on: false, final: true }, tick(5000));
      const back = state(session_id);
      expect(back.engine).toBeUndefined();
      // it comes back silent and with no scene: the picture goes to black and the next set_sound fades in from it
      expect(back.volume).toBe(0); expect(back.colour.scene).toBe("none");
      expect(off.playing).toHaveProperty("scale"); expect(off).not.toHaveProperty("reads_as");
      expect((off.notes as string[]).join(" ")).toMatch(/silent/);
      expect(back.arp.root).toBe(synth.arp.root); // the paused synth's fields stay
      await svc.setSound(dbA, A, { session_id, mood, colour: { scene: "stars" }, final: true } as never, tick(5000));
      expect(state(session_id).volume).toBeGreaterThan(0); expect(state(session_id).colour.scene).toBe("stars");
      const log = (await svc.inspect(dbA, A, { session_id, what: "history" })).history.join("\n");
      expect(log).toMatch(/strudel code/); expect(log).toMatch(/back to the synth/);
    });

    it("strudel_mode off on a plain synth changes nothing", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood, colour: { scene: "stars" }, final: true } as never, tick(5000));
      const before = state(session_id);
      const off = await svc.strudelMode(dbA, A, { session_id, on: false, final: true }, tick(5000));
      expect((off.notes as string[]).join(" ")).toMatch(/Strudel was not on/);
      expect(state(session_id).volume).toBe(before.volume); expect(state(session_id).colour.scene).toBe("stars");
    });

    it("silence stops Strudel too (the pattern fades out in the player)", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      await svc.silence(dbA, A, { session_id, fade: 6, final: true }, tick(5000));
      const e = state(session_id);
      expect(e.engine).toBeUndefined(); expect(e.pattern).toBeUndefined(); expect(e.volume).toBe(0); expect(e.transition.time).toBe(6);
    });

    it("switching to the internal face writes the synth back", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      await svc.setSound(dbA, A, { session_id, mood, mode: "internal", final: true } as never, tick(5000));
      expect(state(session_id).engine).toBeUndefined();
    });

    it("get_feedback does not call a pattern the owner stopped 'playing'", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      expect((await svc.getFeedback(dbA, A, { session_id }, clock)).playing).toMatchObject({ engine: "strudel" });
      expect((await dbA.rpc("set_allow_code", { p_session: session_id, p_allow: false })).error).toBeNull();
      const fb = await svc.getFeedback(dbA, A, { session_id }, clock);
      expect((fb.playing as { engine?: string }).engine).not.toBe("strudel");
      expect(fb.pattern).toBeUndefined();
      expect(state(session_id).volume).toBe(0); // the owner turned it off: sound and picture end, no leftover synth state
      // allowing it again on the same state brings the pattern back, as the player does (0029, v0.23.3 report): no "stopped" note
      expect((await dbA.rpc("set_allow_code", { p_session: session_id, p_allow: true })).error).toBeNull();
      expect(state(session_id).engine).toBe("strudel"); expect(state(session_id).volume).toBeGreaterThan(0);
      const again = await svc.getFeedback(dbA, A, { session_id }, clock);
      expect((again.playing as { engine?: string }).engine).toBe("strudel");
      expect(JSON.stringify(again.notes ?? [])).not.toMatch(/owner stopped your Strudel pattern/);
      // a face lock is final
      expect(state(session_id).engine).toBe("strudel");
      expect((await dbA.rpc("set_mode_policy", { p_session: session_id, p_policy: "internal" })).error).toBeNull();
      expect(state(session_id).engine).toBeUndefined();
      expect(state(session_id).volume).toBe(0); // the internal lock ends the sound too: the faces are different voices
    });

    it("the player's poll answers `same` while nothing changed, and the full state when the model or the owner changes something", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000));
      const first = (await dbA.rpc("player_poll", { p_session: session_id, p_known: null })).data as { v: string; same?: boolean; state: unknown };
      expect(first.state).toBeTruthy(); expect(first.same).toBeUndefined(); expect(typeof first.v).toBe("string");
      const again = (await dbA.rpc("player_poll", { p_session: session_id, p_known: first.v })).data as Record<string, unknown>;
      expect(again).toMatchObject({ same: true, v: first.v }); expect(again.state).toBeUndefined(); expect(JSON.stringify(again).length).toBeLessThan(200);
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      const next = (await dbA.rpc("player_poll", { p_session: session_id, p_known: first.v })).data as { v: string; same?: boolean };
      expect(next.same).toBeUndefined(); expect(next.v).not.toBe(first.v);
      expect((await dbA.rpc("set_allow_code", { p_session: session_id, p_allow: false })).error).toBeNull();
      const after = (await dbA.rpc("player_poll", { p_session: session_id, p_known: next.v })).data as { same?: boolean };
      expect(after.same).toBeUndefined(); // the owner's switch and the stopped pattern are part of the version
    });

    it("says so when the same code is sent again, and when on false leaves a silent synth", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      const again = await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      expect(JSON.stringify(again.notes)).toMatch(/same code and tempo as before/);
      expect(JSON.stringify(again.notes)).not.toMatch(/code you replaced/);
      await svc.silence(dbA, A, { session_id, fade: 3, final: true }, tick(5000));
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000)); // Strudel after a silence: the synth under it stays at volume 0
      expect(state(session_id).volume).toBe(0);
      const off = await svc.strudelMode(dbA, A, { session_id, on: false, final: true }, tick(5000));
      expect(JSON.stringify(off.notes)).toMatch(/back on the synth, silent/);
    });

    it("a call after the session ended says session_ended", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000));
      await svc.silence(dbA, A, { session_id, fade: 3, final: true, end: true }, tick(5000));
      await expect(svc.getFeedback(dbA, A, { session_id }, clock)).resolves.toBeDefined(); // reading an ended session is allowed
      await expect(svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(5000))).rejects.toMatchObject({ code: "session_ended" });
      // without the id: the owner has no open session left, the last one ended
      sql(`update sessions set ended_at = now() where owner_id='${A}' and ended_at is null`);
      await expect(svc.setSound(dbA, A, { mood, final: true } as never, tick(5000))).rejects.toMatchObject({ code: "session_ended" });
    });

    it("the owner's player reports what the code did: owner only, first report wins, the model reads it as data", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      const stateId = sql(`select id from states where session_id='${session_id}' order by created_at desc limit 1`);
      const before = await svc.getFeedback(dbA, A, { session_id }, clock);
      expect(before.pattern).toMatchObject({ ran: "not reported yet" });
      expect((await dbB.rpc("report_pattern", { p_state: stateId, p_ok: true, p_error: null, p_events: 4, p_notes: [] })).error).not.toBeNull();
      expect((await dbA.rpc("report_pattern", { p_state: stateId, p_ok: false, p_error: "x".repeat(500), p_events: 2.5, p_notes: ["sounds: sawtooth"] })).error).toBeNull();
      expect((await dbA.rpc("report_pattern", { p_state: stateId, p_ok: true, p_error: null, p_events: 9, p_notes: [] })).error).toBeNull(); // ignored: the first wins
      const after = await svc.getFeedback(dbA, A, { session_id }, clock);
      expect(after.pattern).toMatchObject({ ran: false, events_per_cycle: 2.5, notes: ["sounds: sawtooth"], source: "the owner's player" });
      expect(String((after.pattern as { error: string }).error).length).toBe(200);
      // the next call shows what the player said about the code that played until then
      const next = await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*2")', bpm: 100, final: true }, tick(5000));
      expect(next.pattern).toMatchObject({ ran: false });
    });

    it("says nobody is listening when the replaced code was never run because no player was open", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
      const next = await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*2")', bpm: 100, final: true }, tick(5000));
      expect(next.players).toBe(0);
      expect(next.pattern).toMatchObject({ ran: "not reported yet", why: expect.stringMatching(/nobody is listening/) });
    });
  });
  describe("arp rate", () => {
    const calm = { warmth: 0.6, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 };
    const last = (sid: string) => JSON.parse(sql(`select effective from states where session_id='${sid}' order by created_at desc limit 1`));

    it("says when the rate steps over a glide, and keeps a rate sent in synth for that call only", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      expect(last(session_id).arp.rate).toBe("1/4"); // calm 0.9 maps to quarter notes
      const r = await svc.setSound(dbA, A, { session_id, mood: calm, synth: { arp: { rate: "1/16" } }, transition: { time: 12, curve: "smooth" }, final: true } as never, tick(25_000));
      expect(last(session_id).arp.rate).toBe("1/16");
      expect((r.notes as string[]).join(" ")).toMatch(/rate 1\/4 to 1\/16: it steps through 1\/8 over 12 s/);
      // the next call without synth maps the rate from its own mood again: the rate is not sticky
      const next = await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      expect(last(session_id).arp.rate).toBe("1/4");
      expect(((next.notes as string[] | undefined) ?? []).join(" ")).not.toMatch(/rate 1\/4 to 1\/16/);
      // the rate sent in synth lasted one call: the note says so
      expect(((next.notes as string[] | undefined) ?? []).join(" ")).toMatch(/your last synth settings lasted one call, so the mood's values are back: arp\.rate 1\/16 to 1\/4/);
      // a tempo is whole, like the tempo note
      await svc.setSound(dbA, A, { session_id, mood: calm, synth: { arp: { tempo: 120 } }, final: true } as never, tick(25_000));
      const back = await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      expect(((back.notes as string[] | undefined) ?? []).join(" ")).toMatch(/arp\.tempo 120 to \d+(,|\.\s|$)/);
    });
  });
  describe("motif", () => {
    const calm = { warmth: 0.6, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 };
    const last = (sid: string) => JSON.parse(sql(`select effective from states where session_id='${sid}' order by created_at desc limit 1`));
    const send = (session_id: string, motif: unknown, extra: object = {}) => svc.setSound(dbA, A, { session_id, mood: calm, final: true, motif, ...extra } as never, tick(25_000));

    it("plays notes as midi with default beats, reports them in playing, and is not sticky", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      const r = await send(session_id, { notes: ["E4", "-", "G4"], repeat: 2, level: 0.6 });
      const m = last(session_id).motif;
      expect(m).toMatchObject({ notes: [64, -1, 67], beats: [1, 1, 1], repeat: 2, level: 0.6 });
      expect(Number.isInteger(m.id) && m.id >= 0 && m.id < 2 ** 31).toBe(true);
      expect((r.playing as { motif: string }).motif).toBe("E4 - G4 · beats 1 1 1 · ×2");
      const next = await send(session_id, undefined);
      expect(last(session_id).motif).toBeUndefined(); expect((next.playing as Record<string, unknown>).motif).toBeUndefined();
      const log = (await svc.inspect(dbA, A, { session_id, what: "history" })).history;
      expect(log[0]).toMatch(/ · motif$/); expect(log[1]).not.toMatch(/motif/);
    });

    it("names a motif, quotes its first notes, and lists names in moment list", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      expect((await send(session_id, { notes: ["E4", "G4", "A4", "C5"], beats: [1, 1, 2, 1], name: "hello", repeat: 1, level: 0.6 })).notes).toContain('motif kept as "hello"');
      const q = await send(session_id, { recall: "hello", first: 3, repeat: 1, level: 0.5 });
      expect(last(session_id).motif).toMatchObject({ notes: [64, 67, 69], beats: [1, 1, 2], level: 0.5 });
      expect((q.playing as { motif: string }).motif).toBe("E4 G4 A4 · beats 1 1 2 · ×1");
      const all = await send(session_id, { recall: "hello", repeat: 1, level: 0.6 });
      expect((all.playing as { motif: string }).motif).toMatch(/^E4 G4 A4 C5/);
      const l = await svc.moment(dbA, A, { session_id, action: "list", final: false }, tick());
      expect(l.motifs).toEqual([{ name: "hello", notes: "E4 G4 A4 C5", turn: 1 }]);
      const none = await svc.startSession(dbA, A, {}, tick());
      expect((await svc.moment(dbA, A, { session_id: none.session_id, action: "list", final: false }, tick())).motifs).toBeUndefined();
    });

    it("an unknown recall says which names exist; the thirteenth name is refused, a used name is replaced", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await expect(send(session_id, { recall: "nope", repeat: 1, level: 0.6 })).rejects.toMatchObject({ code: "unknown_motif", message: expect.stringContaining("Named: none.") });
      for (let i = 0; i < 12; i++) await send(session_id, { notes: ["C4"], name: `m${i}`, repeat: 1, level: 0.6 });
      await expect(send(session_id, { recall: "constructor", repeat: 1, level: 0.6 })).rejects.toMatchObject({ code: "unknown_motif", message: expect.stringContaining("Named: m0, m1") });
      await expect(send(session_id, { notes: ["D4"], name: "m12", repeat: 1, level: 0.6 })).rejects.toMatchObject({ code: "motifs_full" });
      await send(session_id, { notes: ["D4"], name: "m3", repeat: 1, level: 0.6 });
      expect(sql(`select count(*) from jsonb_object_keys((select motifs from sessions where id='${session_id}'))`)).toBe("12");
      expect(sql(`select motifs->'m3'->>'notes' from sessions where id='${session_id}'`)).toBe('["D4"]');
    });

    it("is allowed in Self; with Strudel on it is ignored with a note", async () => {
      const self = await svc.startSession(dbA, A, { mode: "self" }, tick());
      await send(self.session_id, { notes: ["C4"], repeat: 1, level: 0.6 });
      expect(last(self.session_id).motif).toBeDefined();
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await svc.strudelMode(dbA, A, { session_id, on: true, code: 'note("c3 e3 g3").s("sawtooth")', bpm: 100, final: true }, tick(25_000));
      const r = await send(session_id, { notes: ["C4"], repeat: 1, level: 0.6 });
      expect(last(session_id).motif).toBeUndefined();
      expect((r.notes as string[]).join(" ")).toMatch(/Strudel is on: the motif was not played/);
    });

    it("a fade or a recalled moment does not carry the phrase", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await send(session_id, { notes: ["C4"], repeat: 1, level: 0.6 });
      await svc.moment(dbA, A, { session_id, action: "keep", name: "with", final: true, transition: undefined }, tick());
      await svc.moment(dbA, A, { session_id, action: "recall", name: "with", final: true }, tick(25_000));
      expect(last(session_id).motif).toBeUndefined();
      await send(session_id, { notes: ["C4"], repeat: 1, level: 0.6 });
      await svc.silence(dbA, A, { session_id, fade: 3, final: true }, tick(25_000));
      expect(last(session_id).motif).toBeUndefined();
    });
  });
  describe("moment", () => {
    const calm = { warmth: 0.6, closeness: 0.5, joy: 0.5, calm: 0.9, spontaneity: 0.2 };
    const loudMood = { warmth: 0.3, closeness: 0.6, joy: 0.3, calm: 0.05, spontaneity: 0.9, tension: 0.9 };
    const last = (sid: string) => JSON.parse(sql(`select effective from states where session_id='${sid}' order by created_at desc limit 1`));
    const ref = { transition: undefined, final: true } as const;
    const voiceA = { root: "D3", scale: "dorian", wave: "triangle" } as never;

    it("keeps a moment, and recall brings back the same state, the voice and the sticky settings", async () => {
      const { session_id } = await svc.startSession(dbA, A, { voice: voiceA }, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, colour: { scene: "tide" }, note: "the quiet part", final: true } as never, tick(25_000));
      const kept = last(session_id);
      const sticky = sql(`select sticky from sessions where id='${session_id}'`);
      const k = await svc.moment(dbA, A, { session_id, action: "keep", name: "quiet", ...ref }, tick());
      expect(k).toMatchObject({ kept: "quiet", moments: ["quiet"] });
      await svc.setSound(dbA, A, { session_id, mood: { ...calm, joy: 0.2 }, voice: { root: "A2", scale: "phrygian", wave: "square" }, colour: { scene: "stars" }, final: true } as never, tick(25_000));
      expect(last(session_id).colour.scene).toBe("stars");
      const before = Math.round(last(session_id).arp.tempo);
      const r = await svc.moment(dbA, A, { session_id, action: "recall", name: "quiet", transition: { time: 3, curve: "smooth" }, final: true }, tick(25_000));
      // the way back glides, and the result says so, like set_sound
      expect(before).not.toBe(Math.round(kept.arp.tempo));
      expect((r.notes as string[]).join(" ")).toMatch(new RegExp(`tempo ${before} to ${Math.round(kept.arp.tempo)}: it glides over 3 s`));
      const now = last(session_id);
      const { transition: t1, grid: g1, ...keptRest } = kept, { transition: t2, grid: g2, ...nowRest } = now;
      expect(nowRest).toEqual(keptRest); // sound, voice and picture exactly as kept
      expect(t2).toEqual({ time: 3, curve: "smooth" }); expect(t1).toBeDefined(); expect(g1).toBeDefined(); expect(g2).toBeDefined();
      expect(sql(`select voice->>'scale' from sessions where id='${session_id}'`)).toBe("dorian");
      expect(sql(`select sticky from sessions where id='${session_id}'`)).toBe(sticky);
      expect(sql(`select pending_final from sessions where id='${session_id}'`)).toBe("f");
      expect((r.notes as string[]).join(" ")).toMatch(/recalled "quiet" \(kept at turn 1\)/);
      expect(sql(`select intent->>'recalled' from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("quiet");
      const log = (await svc.inspect(dbA, A, { session_id, what: "history" })).history.join("\n");
      expect(log).toMatch(/"recalled \"quiet\""/);
      // the next set_sound moves on in the restored voice
      const next = await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      expect((next.playing as { scale: string }).scale).toBe("D dorian");
    });

    it("recall without a transition uses 6 s smooth", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await svc.moment(dbA, A, { session_id, action: "keep", name: "a", ...ref }, tick());
      await svc.moment(dbA, A, { session_id, action: "recall", name: "a", final: true }, tick(25_000));
      expect(last(session_id).transition).toEqual({ time: 6, curve: "smooth" });
    });

    it("lists names in the order they were kept, and an unknown name says which exist", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, note: "first one", final: true } as never, tick(25_000));
      expect((await svc.moment(dbA, A, { session_id, action: "list", final: false }, tick())).moments).toEqual([]);
      await svc.moment(dbA, A, { session_id, action: "keep", name: "zeta", ...ref }, tick());
      await svc.moment(dbA, A, { session_id, action: "keep", name: "alpha", ...ref }, tick());
      const l = (await svc.moment(dbA, A, { session_id, action: "list", final: false }, tick(5000))).moments as Array<Record<string, unknown>>;
      expect(l.map((m) => m.name)).toEqual(["zeta", "alpha"]);
      expect(l[0]).toMatchObject({ turn: 1, note: "first one", engine: "synth" }); expect(l[0].kept_s_ago).toBeGreaterThanOrEqual(5);
      await expect(svc.moment(dbA, A, { session_id, action: "recall", name: "nope", final: true }, tick(25_000))).rejects.toMatchObject({ code: "unknown_moment", message: expect.stringContaining("Kept: zeta, alpha.") });
      await expect(svc.moment(dbA, A, { session_id, action: "recall", name: "constructor", final: true }, tick(25_000))).rejects.toMatchObject({ code: "unknown_moment" });
    });

    it("stops at twelve names; a name already used is replaced", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      for (let i = 0; i < 12; i++) await svc.moment(dbA, A, { session_id, action: "keep", name: `m${i}`, ...ref }, tick());
      await expect(svc.moment(dbA, A, { session_id, action: "keep", name: "m12", ...ref }, tick())).rejects.toMatchObject({ code: "moments_full" });
      const again = await svc.moment(dbA, A, { session_id, action: "keep", name: "m3", ...ref }, tick());
      expect(again.moments).toHaveLength(12);
      expect(sql(`select count(*) from jsonb_object_keys((select moments from sessions where id='${session_id}'))`)).toBe("12");
    });

    it("keep needs a state, and a name", async () => {
      const u = "00000000-0000-0000-0000-0000000000c1";
      sql(`insert into auth.users (id, email) values ('${u}', 'c@example.com')`);
      const { supabaseForToken } = await import("../supabase/bearer");
      const db = supabaseForToken(await tokenFor(u));
      const { session_id } = await svc.startSession(db, u, {}, tick());
      sql(`update sessions set current_state_id = null where id='${session_id}'`);
      await expect(svc.moment(db, u, { session_id, action: "keep", name: "x", ...ref }, tick())).rejects.toMatchObject({ code: "no_state" });
      await expect(svc.moment(db, u, { session_id, action: "keep", ...ref }, tick())).rejects.toMatchObject({ code: "bad_input" });
    });

    it("saves a moment as a keepsake: the state is copied on the server, human or ai, the same moment once, the AI spaced by turns", async () => {
      const { session_id } = await svc.startSession(dbA, A, { voice: voiceA }, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await svc.silence(dbA, A, { session_id, fade: 3, final: true }, tick(25_000));
      await expect(svc.saveMoment(dbA, A, { session_id, name: "silent", ...ref })).rejects.toMatchObject({ code: "nothing_playing" });
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      const playing = last(session_id);
      const states = sql(`select count(*) from states where session_id='${session_id}'`);
      const r = await svc.saveMoment(dbA, A, { session_id, name: "  First light ", ...ref });
      expect(r).toMatchObject({ saved: "First light", by: "you", url: expect.stringMatching(/^https:\/\/app\.example\/m\/[A-Za-z0-9_-]{22}$/) });
      expect(Object.keys(r).sort()).toEqual(["by", "saved", "url"]);
      const id = String(r.url).split("/m/")[1];
      expect(sql(`select saved_by from saved_moments where id='${id}'`)).toBe("ai");
      expect(sql(`select owner_id from saved_moments where id='${id}'`)).toBe(A);
      expect(sql(`select voice_seed from saved_moments where id='${id}'`)).toBe(String(voiceSeedOf(session_id)));
      const saved = JSON.parse(sql(`select effective from saved_moments where id='${id}'`));
      expect(saved.volume).toBe(playing.volume);
      expect(saved.transition.delay).toBeUndefined();
      expect(sql(`select count(*) from states where session_id='${session_id}'`)).toBe(states); // nothing was written to the session
      // the same state again: nothing new is written, the first save comes back, even when the listener asks (its author stays "you")
      const count = sql(`select count(*) from saved_moments where owner_id='${A}'`);
      const dup = await svc.saveMoment(dbA, A, { session_id, name: "Asked for", listener_asked: true, ...ref });
      expect(dup).toMatchObject({ saved: "First light", by: "you", url: r.url, already: true });
      expect(sql(`select count(*) from saved_moments where owner_id='${A}'`)).toBe(count);
      // the next turn is under 5 turns after the AI's own save: the AI is refused, the listener's ask passes
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await expect(svc.saveMoment(dbA, A, { session_id, name: "Two", ...ref })).rejects.toMatchObject({ code: "ai_too_soon", message: expect.stringContaining("less than 5 messages ago") });
      const asked = await svc.saveMoment(dbA, A, { session_id, name: "Asked for", listener_asked: true, ...ref });
      expect(asked.by).toBe("listener");
      expect(asked.already).toBeUndefined();
      expect(sql(`select saved_by from saved_moments where id='${String(asked.url).split("/m/")[1]}'`)).toBe("human");
      // another account cannot save into this session, and a name is needed
      await expect(svc.saveMoment(dbB, B, { session_id, name: "mine", ...ref })).rejects.toMatchObject({ code: "unknown_session" });
      await expect(svc.saveMoment(dbA, A, { session_id, ...ref } as never)).rejects.toMatchObject({ code: "bad_input" });
    });

    it("a Strudel moment does not come back in Self", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await svc.strudelMode(dbA, A, { session_id, on: true, code: 'note("c3 e3 g3").s("sawtooth")', bpm: 100, final: true }, tick(25_000));
      expect((await svc.moment(dbA, A, { session_id, action: "list", final: false }, tick())).moments).toEqual([]);
      await svc.moment(dbA, A, { session_id, action: "keep", name: "pattern", ...ref }, tick());
      expect((await svc.moment(dbA, A, { session_id, action: "list", final: false }, tick())).moments).toMatchObject([{ name: "pattern", engine: "strudel" }]);
      // in a listener mode it plays again, with the code
      await svc.strudelMode(dbA, A, { session_id, on: false, final: true }, tick(25_000));
      const back = await svc.moment(dbA, A, { session_id, action: "recall", name: "pattern", final: true }, tick(25_000));
      expect(back.playing).toMatchObject({ engine: "strudel" });
      expect(back.pattern).toBeDefined();
      expect(last(session_id).pattern.bpm).toBe(100);
      // the owner locks Self: Strudel does not play there
      expect((await dbA.rpc("set_mode_policy", { p_session: session_id, p_policy: "internal" })).error).toBeNull();
      await expect(svc.moment(dbA, A, { session_id, action: "recall", name: "pattern", final: true }, tick(25_000))).rejects.toMatchObject({ code: "strudel_not_here" });
    });

    it("a synth moment recalled while Strudel plays replaces it", async () => {
      const { session_id } = await svc.startSession(dbA, A, { mode: "external" }, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      await svc.moment(dbA, A, { session_id, action: "keep", name: "synth", ...ref }, tick());
      await svc.strudelMode(dbA, A, { session_id, on: true, code: 's("bd*4")', bpm: 120, final: true }, tick(25_000));
      const r = await svc.moment(dbA, A, { session_id, action: "recall", name: "synth", final: true }, tick(25_000));
      expect(last(session_id).engine).toBeUndefined();
      expect(r.playing).not.toMatchObject({ engine: "strudel" });
    });

    it("holds a loud moment recalled after a quiet state to +4 dB", async () => {
      const { session_id } = await svc.startSession(dbA, A, {}, tick());
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      for (let i = 0; i < 4; i++) await svc.setSound(dbA, A, { session_id, mood: loudMood, final: true } as never, tick(25_000));
      await svc.moment(dbA, A, { session_id, action: "keep", name: "loud", ...ref }, tick());
      const loudDb = (await svc.getFeedback(dbA, A, { session_id }, clock)).sound as { loudness_db: number };
      await svc.setSound(dbA, A, { session_id, mood: calm, final: true } as never, tick(25_000));
      const quietDb = ((await svc.getFeedback(dbA, A, { session_id }, clock)).sound as { loudness_db: number }).loudness_db;
      const r = await svc.moment(dbA, A, { session_id, action: "recall", name: "loud", final: true }, tick(25_000));
      expect((r.clamped as string[]).join(" ")).toMatch(/level held/);
      expect((r.sound as { loudness_db: number }).loudness_db - quietDb).toBeLessThanOrEqual(5);
      expect(loudDb.loudness_db - quietDb).toBeGreaterThan(5);
    });
  });

  describe("tell_developers", () => {
    const text = (extra = "") => `The listen tool returned idle at once while a player was open, so I could not wait for presses. I expected it to wait. ${extra}`.padEnd(100, ".");
    let seq = 0; // every note differs: the same text within 7 days is refused as a duplicate (migration 0023)
    const note = (over: Record<string, unknown> = {}) => ({ kind: "bug" as const, text: text(`note ${++seq}`), from: "model" as const, ...over });
    // one fresh user per test: the daily count is per user
    let n = 0;
    async function fresh() {
      const id = `00000000-0000-0000-0000-0000000d${String(++n).padStart(4, "0")}`;
      sql(`insert into auth.users (id, email) values ('${id}', 'dev${n}@example.com')`);
      const { supabaseForToken } = await import("../supabase/bearer");
      return { id, db: supabaseForToken(await tokenFor(id)) };
    }
    const count = () => Number(sql("select count(*) from dev_feedback"));

    it("stores a note with the server's mode, engine and version, and nothing that links it to the user", async () => {
      const u = await fresh();
      await svc.startSession(u.db, u.id, {}, tick());
      const before = count();
      expect(await svc.tellDevelopers(u.db, u.id, note({ kind: "idea", from: "user" }))).toMatchObject({ sent: true });
      expect(count()).toBe(before + 1);
      expect(sql("select source||'/'||kind||'/'||mode||'/'||engine||'/'||status from dev_feedback order by id desc limit 1")).toBe("user/idea/self/synth/new");
      expect(sql("select app_version is not null and app_version <> '' from dev_feedback order by id desc limit 1")).toBe("t");
      expect(sql("select created_at = date_trunc('day', created_at) from dev_feedback order by id desc limit 1")).toBe("t");
      const cols = sql("select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='dev_feedback'");
      expect(cols).not.toMatch(/user|session|owner/);
    });

    it("takes the mode from the session and the engine from its current state", async () => {
      const u = await fresh();
      await svc.startSession(u.db, u.id, { mode: "external" }, tick());
      await svc.tellDevelopers(u.db, u.id, note());
      expect(sql("select mode||'/'||engine from dev_feedback order by id desc limit 1")).toBe("attuned/synth");
    });

    it("keeps notes out of reach of the API: no select, insert or update, for the user or anyone", async () => {
      const u = await fresh();
      await svc.tellDevelopers(u.db, u.id, note());
      for (const t of ["dev_feedback", "dev_feedback_quota"]) {
        const r = await u.db.from(t).select("*");
        expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
      }
      const ins = await u.db.from("dev_feedback").insert({ kind: "bug", source: "model", body: text() });
      expect(ins.error).not.toBeNull();
      const before = count();
      const upd = await u.db.from("dev_feedback").update({ status: "done" }).eq("status", "new");
      expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
      expect(sql("select count(*) from dev_feedback where status <> 'new'")).toBe("0");
      expect(count()).toBe(before);
    });

    it("refuses a note under 80 characters", async () => {
      const u = await fresh();
      const before = count();
      await expect(svc.tellDevelopers(u.db, u.id, note({ text: "x".repeat(79) }))).rejects.toMatchObject({ code: "too_short" });
      expect(count()).toBe(before);
    });

    it("stops at three notes a day and does not store the fourth", async () => {
      const u = await fresh();
      const before = count();
      for (let i = 0; i < 3; i++) await svc.tellDevelopers(u.db, u.id, note({ text: text(`number ${i}`) }));
      await expect(svc.tellDevelopers(u.db, u.id, note({ text: text("number 3") }))).rejects.toMatchObject({ code: "daily_limit" });
      expect(count()).toBe(before + 3);
      expect(sql(`select n from dev_feedback_quota where user_id='${u.id}'`)).toBe("3");
    });

    it("refuses a note sent in the last 7 days, whoever sends it, ignoring case and spaces at the ends", async () => {
      const a = await fresh(), b = await fresh();
      const body = text("a repeated note");
      await svc.tellDevelopers(a.db, a.id, note({ text: body }));
      const before = count();
      await expect(svc.tellDevelopers(b.db, b.id, note({ text: `  ${body.toUpperCase()}  ` }))).rejects.toMatchObject({ code: "duplicate" });
      expect(count()).toBe(before);
      expect(sql(`select coalesce(sum(n), 0) from dev_feedback_quota where user_id='${b.id}'`)).toBe("0"); // a refused note costs nothing
    });

    it("forgets the daily counts from before today on every send", async () => {
      const u = await fresh(), v = await fresh();
      sql(`insert into dev_feedback_quota (user_id, day, n) values ('${u.id}', current_date - 1, 2)`);
      await svc.tellDevelopers(v.db, v.id, note());
      expect(sql("select count(*) from dev_feedback_quota where day < current_date")).toBe("0");
    });

    it("strips control characters, keeps newlines", async () => {
      const u = await fresh();
      await svc.tellDevelopers(u.db, u.id, note({ text: text("a\u0007b\u001b[31mred\nnext line") }));
      const body = sql("select replace(body, E'\\n', '<nl>') from dev_feedback order by id desc limit 1");
      expect(body).toContain("ab[31mred<nl>next line");
      expect(body).not.toMatch(/[\u0007\u001b]/);
    });

    it("works without a session, with no mode", async () => {
      const u = await fresh();
      await expect(svc.getFeedback(u.db, u.id, {}, clock)).rejects.toMatchObject({ code: "no_session" });
      await svc.tellDevelopers(u.db, u.id, note());
      expect(sql("select mode is null and engine is null from dev_feedback order by id desc limit 1")).toBe("t");
    });

    it("stores SQL-looking text verbatim as text", async () => {
      const u = await fresh();
      const evil = "'); drop table public.sessions; --".padEnd(90, " x");
      await svc.tellDevelopers(u.db, u.id, note({ text: evil }));
      expect(sql("select body from dev_feedback order by id desc limit 1")).toBe(evil.trim());
      expect(sql("select to_regclass('public.sessions') is not null")).toBe("t");
    });
  });
});
