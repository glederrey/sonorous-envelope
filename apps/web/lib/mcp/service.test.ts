// Unit tests of the tool service on an in-memory database (fake-db.ts). The real Postgres run is service.integration.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "./fake-db";

const U = "user-1";
const mood = (o: object = {}) => ({ warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5, ...o });
type Fb = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let svc: typeof import("./service");

beforeAll(async () => { process.env.PUBLIC_BASE_URL = "https://app.example"; svc = await import("./service"); });

async function session(voice?: object) {
  const { db, tables } = fakeDb();
  let t = 1_700_000_000_000;
  const tick = (ms = 25_000) => (t += ms);
  const { session_id } = await svc.startSession(db, U, voice ? { voice } as never : {}, tick());
  const set = (input: object, ms?: number) => svc.setSound(db, U, { session_id, final: true, ...input } as never, tick(ms)) as Promise<Fb>;
  const last = () => [...tables.states].sort((a, b) => String(a.created_at) < String(b.created_at) ? 1 : -1)[0] as { effective: Fb; intent: Fb };
  return { db, tables, tick, session_id, set, last };
}
const notes = (r: Fb) => ((r.notes ?? []) as string[]).join(" | ");

describe("an adopted voice: the wave follows warmth (finding 1)", () => {
  it("round trip: warmth 0.2, 0.3 and 0.8 read within 0.2, each on its own wave (even bands), with the voice adopted at joy 0.3", async () => {
    for (const [w, band] of [[0.2, "square"], [0.3, "sawtooth"], [0.8, "sine"]] as const) {
      const s = await session();
      await s.set({ mood: mood({ warmth: 0.5, joy: 0.3 }) }); // adopts the voice (triangle)
      const r = await s.set({ mood: mood({ warmth: w, joy: 0.3 }) });
      expect(r.playing.wave).toBe(band);
      expect(Math.abs(r.reads_as.warmth - w)).toBeLessThanOrEqual(0.2); // the key is drawn per session and moves the reading a little: 1 run in 25 reads 0.17 off
      expect(notes(r)).toMatch(/your warmth moved the wave of your voice from triangle to /);
    }
  });
  it("keeps root, scale and note order when the wave moves, and does not flip at an edge", async () => {
    const s = await session();
    const a = await s.set({ mood: mood({ warmth: 0.5 }) });
    const b = await s.set({ mood: mood({ warmth: 0.9 }) }); // sine
    expect(b.playing.scale).toBe(a.playing.scale); expect(b.playing.pattern).toBe(a.playing.pattern);
    for (const w of [0.78, 0.74, 0.78]) expect((await s.set({ mood: mood({ warmth: w }) })).playing.wave).toBe("sine"); // stretched 0.95 to 0.88: still inside the margin (edge 0.9, margin 0.05)
    expect(notes(await s.set({ mood: mood({ warmth: 0.5 }) }))).toMatch(/moved the wave of your voice from sine/);
  });
  it("a voice sent by the model, or kept, fixes the wave", async () => {
    const voice = { root: "A2", scale: "minor", chord: [1, 3, 5], pattern: "up", octaves: 1, wave: "sawtooth" };
    for (const how of ["start", "set"] as const) {
      const s = await session(how === "start" ? voice : undefined);
      if (how === "set") await s.set({ mood: mood(), voice });
      else await s.set({ mood: mood() });
      for (const w of [0.05, 0.95]) { const r = await s.set({ mood: mood({ warmth: w }) }); expect(r.playing.wave).toBe("sawtooth"); expect(notes(r)).not.toMatch(/moved the wave/); }
    }
    const s = await session();
    await s.set({ mood: mood({ warmth: 0.5 }) });
    const kept = await s.set({ mood: mood({ warmth: 0.9 }), keep_voice: true });
    for (const w of [0.05, 0.5]) expect((await s.set({ mood: mood({ warmth: w }) })).playing.wave).toBe(kept.playing.wave);
  });
});

describe("level when switching into Attuned (finding 3)", () => {
  const calm = mood({ warmth: 0.6, joy: 0.5, calm: 0.9, spontaneity: 0.2 });
  const loud = mood({ warmth: 0.3, closeness: 0.6, joy: 0.3, calm: 0.05, spontaneity: 0.9, tension: 0.9 });
  it("the first Attuned sound is no louder than what played; a plain call may rise by 4 dB", async () => {
    const a = await session(), b = await session();
    const was = (await a.set({ mood: calm })).sound.loudness_db, wasB = (await b.set({ mood: calm })).sound.loudness_db; // sessions differ in key, so each has its own baseline
    const plain = await b.set({ mood: loud });
    expect(plain.sound.loudness_db - wasB).toBeGreaterThan(0); // louder, held to the usual +4 step
    const sw = await a.set({ mood: loud, mode: "attuned" });
    expect(notes(sw)).toMatch(/switched to Attuned/);
    expect(sw.sound.loudness_db - was).toBeLessThanOrEqual(0);
    expect((sw.clamped as string[]).join(" ")).toMatch(/level held.*same level/);
    const next = await a.set({ mood: loud }); // the next call may rise again, by the usual step
    expect(next.sound.loudness_db).toBeGreaterThan(sw.sound.loudness_db);
  });
});

describe("colour motion under Strudel (finding 4)", () => {
  const code = 'note("c3 e3 g3").s("sawtooth")';
  async function strudel(bpm: number, colour?: object) {
    const s = await session();
    await s.set({ mood: mood({ calm: 0.9 }) }); // a calm mood: motion breathe
    await s.set({ mood: mood({ calm: 0.9 }), mode: "attuned", ...(colour ? { colour } : {}) });
    const r = await svc.strudelMode(s.db, U, { session_id: s.session_id, on: true, code, bpm, final: true } as never, s.tick());
    return { s, r, motion: () => s.last().effective.colour as { motion: string; pulseHz: number } };
  }
  it("sets the motion from the pattern tempo: pulse from 110, drift from 80, else breathe", async () => {
    for (const [bpm, motion] of [[160, "pulse"], [110, "pulse"], [90, "drift"], [70, "breathe"]] as const) {
      const { motion: m } = await strudel(bpm);
      expect(m().motion).toBe(motion);
      if (motion === "pulse") expect(m().pulseHz).toBeGreaterThan(0); else expect(m().pulseHz).toBe(0);
    }
  });
  it("follows the tempo of a later pattern, and in set_sound while Strudel plays", async () => {
    const { s, motion } = await strudel(70);
    expect(motion().motion).toBe("breathe");
    await svc.strudelMode(s.db, U, { session_id: s.session_id, on: true, code: 'note("c2").s("sawtooth")', bpm: 150, final: true } as never, s.tick());
    expect(motion().motion).toBe("pulse");
    await s.set({ colour: { hue: 200 } });
    expect(motion().motion).toBe("pulse");
  });
  it("leaves a motion the model set", async () => {
    const { motion } = await strudel(160, { motion: "still" });
    expect(motion().motion).toBe("still");
  });
});

describe("tempo after a silent state (finding 5)", () => {
  const fast = mood({ calm: 0.1 }), slow = mood({ calm: 0.9 });
  const glide = (s: { last: () => { effective: Fb } }) => s.last().effective.grid as { glide?: number; fromTempo?: number };
  it("a normal change glides from the old tempo and says so", async () => {
    const s = await session();
    await s.set({ mood: fast });
    const r = await s.set({ mood: slow });
    expect(notes(r)).toMatch(/tempo \d+ to \d+: it glides/);
    expect(glide(s).glide).toBeGreaterThan(0);
  });
  it("after silence() has finished fading, the next sound starts at its own tempo: no glide, no tempo note", async () => {
    const s = await session();
    await s.set({ mood: fast });
    await svc.silence(s.db, U, { session_id: s.session_id, fade: 3, final: true } as never, s.tick());
    const r = await s.set({ mood: slow }, 20_000);
    expect(notes(r)).not.toMatch(/tempo \d+ to/);
    expect(glide(s).glide).toBe(0);
  });
  it("while the fade still plays, the old tempo is still heard: it glides", async () => {
    const s = await session();
    await s.set({ mood: fast });
    await svc.silence(s.db, U, { session_id: s.session_id, fade: 30, final: true } as never, s.tick());
    const r = await s.set({ mood: slow }, 5_000);
    expect(notes(r)).toMatch(/tempo \d+ to \d+/);
    expect(glide(s).glide).toBeGreaterThan(0);
  });
  it("after an owner lock to Self (a silent copy, owner_silenced), no glide either", async () => {
    const s = await session();
    await s.set({ mood: fast });
    await s.set({ mood: fast, mode: "attuned" });
    // what set_mode_policy writes: a silent copy of the current state, 3 s fade (migration 0017)
    const cur = s.last();
    s.tables.states.push({ ...cur, id: "lock", intent: { mood: cur.intent.mood, silence: true, owner_silenced: true }, effective: { ...cur.effective, volume: 0, transition: { time: 3, curve: "smooth" } }, created_at: (cur as unknown as { created_at: string }).created_at });
    const sess = s.tables.sessions[0]; sess.current_state_id = "lock"; sess.mode = "internal"; sess.mode_policy = "internal";
    const r = await s.set({ mood: slow }, 60_000_000);
    expect(notes(r)).not.toMatch(/tempo \d+ to/);
    expect(glide(s).glide).toBe(0);
  });
});

describe("v0.19.2 report", () => {
  const glide = (s: { last: () => { effective: Fb } }) => s.last().effective.grid as { glide?: number };
  it("the first sound of a session does not glide from the start_session placeholder (feedback 3)", async () => {
    const s = await session();
    const r = await s.set({ mood: mood({ calm: 0.1 }) }, 2_000);
    expect(notes(r)).not.toMatch(/tempo \d+ to/);
    expect(glide(s).glide).toBe(0);
    const r2 = await s.set({ mood: mood({ calm: 0.9 }) }); // the second one does
    expect(notes(r2)).toMatch(/tempo \d+ to \d+: it glides/);
  });
  it("switching into Attuned holds tempo, rate and density at what played (feedback 4)", async () => {
    const s = await session();
    const before = (await s.set({ mood: mood({ calm: 0.9, spontaneity: 0.2 }) })).playing;
    const was = s.last().effective.arp as { tempo: number; rate: string; density: number };
    const sw = await s.set({ mood: mood({ calm: 0.05, spontaneity: 0.9 }), mode: "attuned" });
    const now = s.last().effective.arp as { tempo: number; rate: string; density: number };
    expect(now.tempo).toBeLessThanOrEqual(was.tempo + 0.5);
    expect(now.rate).toBe(was.rate);
    expect(now.density).toBeLessThanOrEqual(was.density + 0.01);
    expect((sw.clamped as string[]).join(" ")).toMatch(/pace held: .*tempo \d+ to \d+ bpm/);
    expect(before).toBeTruthy();
    await s.set({ mood: mood({ calm: 0.05, spontaneity: 0.9 }) }); // the next call may speed up
    expect((s.last().effective.arp as { tempo: number }).tempo).toBeGreaterThan(was.tempo + 10);
  });
  it("Self is not held", async () => {
    const s = await session();
    await s.set({ mood: mood({ calm: 0.9 }) });
    const was = (s.last().effective.arp as { tempo: number }).tempo;
    await s.set({ mood: mood({ calm: 0.05 }) });
    expect((s.last().effective.arp as { tempo: number }).tempo).toBeGreaterThan(was + 10);
  });
  it("a pattern gets a scene that goes with the music, and the beat sync when fast, unless the model chose them (feedback 6)", async () => {
    const s = await session();
    await s.set({ mood: mood({ joy: 0.8, calm: 0.85, warmth: 0.5, closeness: 0.4 }) });
    await s.set({ mood: mood({ joy: 0.8, calm: 0.85, warmth: 0.5, closeness: 0.4 }), mode: "jukebox" });
    await svc.strudelMode(s.db, U, { session_id: s.session_id, on: true, code: 'note("c3 e3").s("sawtooth")', bpm: 150, final: true } as never, s.tick());
    const c = s.last().effective.colour as { scene?: string; sync?: string; sceneAuto?: boolean };
    expect(c.sync).toBe("beat");
    expect(c.scene).toBe(svc.patternScene(mood({ joy: 0.8, calm: 0.85, warmth: 0.5, closeness: 0.4 }), 150).scene);
    expect(c.sceneAuto).toBe(true);
    await svc.strudelMode(s.db, U, { session_id: s.session_id, on: true, code: 'note("c3").s("sine")', bpm: 70, colour: { scene: "rain", sync: "phrase" }, final: true } as never, s.tick());
    const c2 = s.last().effective.colour as { scene?: string; sync?: string; sceneAuto?: boolean };
    expect(c2.scene).toBe("rain"); expect(c2.sync).toBe("phrase"); expect(c2.sceneAuto).toBeFalsy();
  });
  it("start_session returns the server version (feedback 12)", async () => {
    const { db } = fakeDb();
    const r = await svc.startSession(db, U, {}, 1_700_000_000_000) as Fb;
    expect(typeof r.version).toBe("string");
  });
});

describe("patternScene", () => {
  it("reads calm from the tempo: the same mood at 150 and 60 bpm gives a busier and a calmer scene", () => {
    const m = mood({ joy: 0.85, warmth: 0.5, closeness: 0.4, spontaneity: 0.5 });
    const fast = svc.patternScene(m, 150), slow = svc.patternScene(m, 60);
    expect(fast.scene).not.toBe(slow.scene);
  });
  it("always gives a scene, for any mood and tempo", () => {
    for (const joy of [0, 0.3, 0.5, 0.7, 1]) for (const warmth of [0, 0.5, 1]) for (const bpm of [40, 90, 130, 200]) {
      expect(svc.patternScene(mood({ joy, warmth }), bpm).scene).toBeTruthy();
    }
  });
});
