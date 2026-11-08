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
    expect((b.playing as { volume: number }).volume).toBeLessThanOrEqual(0.6);
    const c = await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    expect(c.turn).toBe(2);
    expect(sql(`select slow_mood is not null from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("t");
  });

  it("applies the mood floor and reports it", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    const r = await svc.setSound(dbA, A, { session_id, mood: { ...mood, joy: 0, calm: 0 }, final: true } as never, tick());
    expect(r.clamped).toEqual(expect.arrayContaining(["joy 0→0.2 (mood floor)", "calm 0→0.3 (mood floor)"]));
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
    sql(`insert into player_heartbeats (session_id, user_id, device_id, audio, volume, delay) values ('${session_id}', '${A}', 'd1', 'playing', 0.4, 0.7)`);
    // the trigger stamps seen_at from the database clock; switch it off to place the heartbeat on the test clock
    sql(`alter table player_heartbeats disable trigger player_heartbeats_touch; update player_heartbeats set seen_at = to_timestamp(${clock} / 1000.0) where session_id='${session_id}'; alter table player_heartbeats enable trigger player_heartbeats_touch`);
    const f = await svc.getFeedback(dbA, A, { session_id }, clock);
    expect(f.players).toBe(1);
    expect(f.controls).toEqual({ volume: 0.4, delay: 0.7 });
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
    expect(got.state.effective.volume).toBeLessThanOrEqual(0.6);
    expect(got.state.turn).toBe(1);
    expect(await (await rpc("get_player_state", { p_session: "nope" })).json()).toBeNull();
    expect((await rpc("player_heartbeat", { p_session: session_id, p_device: "friend-phone", p_audio: "playing", p_volume: 0.5, p_delay: 0.2 })).status).toBe(204);
    const tables = await fetch(`${REST}/states?select=id`);
    expect(tables.status).toBeGreaterThanOrEqual(400); // the tables are closed to anon (permission denied)
    // a listener with only the link counts as a listener, but their controls are not reported to the model
    let fb = await svc.getFeedback(dbA, A, { session_id }, Date.now());
    expect(fb.players).toBe(1);
    expect(fb).not.toHaveProperty("controls");
    // the owner's own device is the one whose controls the model sees
    expect((await dbA.rpc("player_heartbeat", { p_session: session_id, p_device: "owner-laptop", p_audio: "playing", p_volume: 0.3, p_delay: 0.9 })).error).toBeNull();
    fb = await svc.getFeedback(dbA, A, { session_id }, Date.now());
    expect(fb.players).toBe(2);
    expect(fb.controls).toEqual({ volume: 0.3, delay: 0.9 });
  });

  it("silences with a fade and logs it as a state", async () => {
    const { session_id } = await svc.startSession(dbA, A, {}, tick());
    await svc.setSound(dbA, A, { session_id, mood, final: true } as never, tick());
    const r = await svc.silence(dbA, A, { session_id, fade: 6, final: true }, tick());
    expect((r.playing as { volume: number }).volume).toBe(0);
    expect(sql(`select effective->'transition'->>'time' from states where session_id='${session_id}' order by created_at desc limit 1`)).toBe("6");
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
