// Runs only through scripts/test-api.sh (needs Docker): real Postgres + PostgREST with our migrations.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
    expect(r.settings).toEqual({ rest_after: 900 });
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

  it("tells the model the sound faded, only when rest_after is on", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    const late = clock + 901_000;
    const fb = await svc.getFeedback(dbA, A, { session_id }, late);
    expect(fb.resting).toBe(true);
    expect(fb.notes).toEqual(expect.arrayContaining(["the sound faded after 15 min without an update from you"]));
    // Claude turns it off: nothing is said any more
    clock = late;
    await svc.setSound(dbA, A, { session_id, mood, final: true, rest_after: null } as never, tick());
    const fb2 = await svc.getFeedback(dbA, A, { session_id }, clock + 3_600_000);
    expect(fb2.resting).toBeUndefined();
  });

  it("lets Claude change rest_after and nothing else in the settings", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const before = JSON.parse(sql(`select settings::text from sessions where id='${session_id}'`));
    await svc.setSound(dbA, A, { session_id, mood, final: true, rest_after: 600 } as never, tick());
    const after = JSON.parse(sql(`select settings::text from sessions where id='${session_id}'`));
    expect(after).toEqual({ ...before, rest_after: 600 });
    // leaving it out keeps the value
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(JSON.parse(sql(`select settings::text from sessions where id='${session_id}'`)).rest_after).toBe(600);
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
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    sql(`insert into reactions (session_id, user_id, kind, created_at) values ('${session_id}', '${A}', 'calmer', now()), ('${session_id}', '${A}', 'calmer', now()), ('${session_id}', '${A}', 'more_of_this', now())`);
    const peek = await svc.getFeedback(dbA, A, { session_id }, tick());
    expect((peek.reactions as string[]).join(" ")).toMatch(/calmer x2/);
    const a = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect((a.reactions as string[]).join(" ")).toMatch(/calmer x2.*more of this|more of this.*calmer x2/);
    const b = await svc.setSound(dbA, A, { session_id, final: true } as never, tick());
    expect(b).not.toHaveProperty("reactions");
  });

  it("starts on auto and the internal face by default, or on the external face when asked (old names still work)", async () => {
    const int = await svc.startSession(dbA, A, {}, tick()) as { mode: string; guidance: string; settings: { rest_after: number | null }; session_id: string };
    expect(int.mode).toBe("internal"); expect(int.guidance).toMatch(/^Internal face/); expect(int.guidance).toMatch(/on auto/); expect(int.settings.rest_after).toBe(900);
    const ext = await svc.startSession(dbA, A, { mode: "outer" }, tick()) as { mode: string; guidance: string; session_id: string; settings: { rest_after: number | null } };
    expect(ext.mode).toBe("external"); expect(ext.guidance).toMatch(/^External face/); expect(ext.settings.rest_after).toBeNull();
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

  it("switches the face at once on auto, logs it, and an owner lock is final", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const call = (extra: object, ms = 1000) => svc.setSound(dbA, A, { session_id, mood, final: true, ...extra } as never, tick(ms));
    let r = await call({ mode: "external" });
    expect(r.mode).toBe("external"); expect((r.notes as string[]).join(" ")).toMatch(/switched to the external face/);
    r = await call({ mode: "internal" });
    expect(r.mode).toBe("internal");
    r = await call({ mode: "external" }); // no timer: straight back
    expect(r.mode).toBe("external");
    // the owner locks the face: the model cannot move it
    expect((await dbA.rpc("set_mode_policy", { p_session: session_id, p_policy: "internal" })).error).toBeNull();
    r = await call({ mode: "external" });
    expect(r.mode).toBe("internal, locked by the owner"); expect((r.notes as string[]).join(" ")).toMatch(/locked/);
    expect((await dbB.rpc("set_mode_policy", { p_session: session_id, p_policy: "auto" })).error).not.toBeNull(); // not the owner
    const seen = await svc.inspect(dbA, A, { session_id, what: "history" }) as { face_changes: string[] };
    const log = seen.face_changes.join("|");
    expect(log).toMatch(/you switched to external/); expect(log).toMatch(/you switched to internal/); expect(log).toMatch(/owner locked internal/);
    expect(seen.face_changes).toHaveLength(4);
  });

  it("the first sound becomes the voice: a different mood later keeps the root and the wave", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const sad = { warmth: 0.2, closeness: 0.3, joy: 0.1, calm: 0.3, spontaneity: 0.4 };
    const glad = { warmth: 0.9, closeness: 0.8, joy: 0.95, calm: 0.7, spontaneity: 0.6 };
    const a = await svc.setSound(dbA, A, { session_id, mood: sad, final: true } as never, tick(25_000));
    expect((a.notes as string[]).join(" ")).toMatch(/first sound is now your voice/);
    const b = await svc.setSound(dbA, A, { session_id, mood: glad, final: true } as never, tick(25_000));
    const key = (r: Record<string, unknown>) => { const p = r.playing as { scale: string; wave: string }; return `${p.scale.split(" ")[0]}/${p.wave}`; }; // root and wave
    expect(key(b)).toBe(key(a));
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
      await expect(svc.strudelMode(dbA, A, { session_id: internal.session_id, on: true, code, bpm: 120, final: true }, tick(5000))).rejects.toMatchObject({ code: "internal_face" });
      const ext = await svc.startSession(dbA, A, { mode: "external" }, tick());
      expect((await dbA.rpc("set_mode_policy", { p_session: ext.session_id, p_policy: "internal" })).error).toBeNull();
      await expect(svc.strudelMode(dbA, A, { session_id: ext.session_id, on: true, code, bpm: 120, final: true }, tick(5000))).rejects.toMatchObject({ code: "internal_face", message: expect.stringMatching(/locked it\. It is final/) });
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
      expect(state(session_id).engine).toBeUndefined();
      expect(off.playing).toHaveProperty("scale"); expect(off).toHaveProperty("reads_as");
      expect(state(session_id).arp.root).toBe(synth.arp.root);
      const log = (await svc.inspect(dbA, A, { session_id, what: "history" })).history.join("\n");
      expect(log).toMatch(/strudel code/); expect(log).toMatch(/back to the synth/);
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
      // allowing it again does not bring the old pattern back: the playing state is the synth until the model sends Strudel again
      expect((await dbA.rpc("set_allow_code", { p_session: session_id, p_allow: true })).error).toBeNull();
      expect(state(session_id).engine).toBeUndefined(); expect(state(session_id).pattern).toBeUndefined();
      const again = await svc.getFeedback(dbA, A, { session_id }, clock);
      expect((again.playing as { engine?: string }).engine).not.toBe("strudel");
      expect(JSON.stringify(again.notes)).toMatch(/owner stopped your Strudel pattern/); // still said after the owner allows it again
      // the same for the face lock
      await svc.strudelMode(dbA, A, { session_id, on: true, code, bpm: 100, final: true }, tick(5000));
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
      expect(JSON.stringify(off.notes)).toMatch(/its state is silent/);
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
  });
});
