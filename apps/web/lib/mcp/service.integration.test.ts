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
    expect(r.settings).toEqual({ rest_after: 300 });
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
    const r = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick(60_000));
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
    const late = clock + 301_000;
    const fb = await svc.getFeedback(dbA, A, { session_id }, late);
    expect(fb.resting).toBe(true);
    expect(fb.notes).toEqual(expect.arrayContaining(["the sound faded after 5 min without an update from you"]));
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
    expect(r.notes).toEqual(expect.arrayContaining(["session ended"]));
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
    expect(JSON.parse(sql(`select voice::text from sessions where id='${session_id}'`))).toEqual({ scale: "lydian", chord: [1, 3, 5] });
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
});
