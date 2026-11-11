// The messages between the player page (trusted), the sandboxed frame and the worker that runs the model's Strudel code (untrusted).
// The code never makes sound or touches the network: it only produces events (haps), and the page turns them into audio.

export const FRAME_URL = "/strudel/frame.html";
export const WORKER_URL = "/strudel/worker.js";

/** A control value Strudel passes to superdough: numbers, short strings, booleans, and short arrays of those. */
export type Prim = number | string | boolean;
export type HapValue = Record<string, Prim | Prim[]>;
export interface Hap { v: HapValue; /** audio-context time the event starts */ t: number; /** seconds */ d: number; cps: number; cycle: number }

/** page -> frame */
export type ToFrame =
  | { kind: "init"; token: string; worker: string }
  | { kind: "play"; code: string; bpm: number; seed: number; /** counts the plays: reports carry it back */ seq?: number; /** audio time and epoch ms at the moment of sending, and the cycle then */ ctxTime: number; epochMs: number; cycle: number }
  | { kind: "clock"; ctxTime: number; epochMs: number; cycle: number }
  | { kind: "stop" };

export interface Report { ok: boolean; error?: string; eventsPerCycle?: number; notes: string[] }
/** frame -> page, always carrying the frame's token (the code in the worker cannot read it) */
export type FromFrame =
  | { kind: "ready" }
  | { kind: "hap"; hap: unknown }
  | { kind: "report"; report: Report }
  | { kind: "banks"; names: string[] }
  | { kind: "alive" };

export const MAX_KEYS = 64, MAX_STR = 96, MAX_ARR = 16, MAX_HAPS_PER_SECOND = 600, MAX_NOTES = 8;

const isFiniteNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Structural check of a hap from the frame: known shape, finite numbers, short strings. This is not a limit on how loud or harsh the
 *  music is (Strudel has none on sonorous): it keeps a malformed message from crashing superdough or the page. */
export function validateHap(raw: unknown): Hap | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  if (!isFiniteNum(h.t) || !isFiniteNum(h.d) || !isFiniteNum(h.cps) || !isFiniteNum(h.cycle)) return null;
  if (h.d < 0 || h.d > 600 || h.cps <= 0 || h.cps > 20) return null;
  if (!h.v || typeof h.v !== "object" || Array.isArray(h.v)) return null;
  const v: HapValue = {};
  const entries = Object.entries(h.v as Record<string, unknown>);
  if (entries.length > MAX_KEYS) return null;
  const prim = (x: unknown): Prim | undefined => (isFiniteNum(x) ? x : typeof x === "boolean" ? x : typeof x === "string" && x.length <= MAX_STR ? x : undefined);
  for (const [k, x] of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k) || k === "__proto__") return null;
    if (Array.isArray(x)) {
      if (x.length > MAX_ARR) return null;
      const a = x.map(prim);
      if (a.some((y) => y === undefined)) return null;
      v[k] = a as Prim[];
    } else {
      const p = prim(x);
      if (p === undefined) return null;
      v[k] = p;
    }
  }
  return { v, t: h.t, d: h.d, cps: h.cps, cycle: h.cycle };
}

export function validateReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ok !== "boolean") return null;
  const notes = Array.isArray(r.notes) ? r.notes.filter((n): n is string => typeof n === "string").slice(0, MAX_NOTES).map((n) => n.slice(0, 120)) : [];
  return {
    ok: r.ok, notes,
    ...(typeof r.error === "string" ? { error: r.error.slice(0, 200) } : {}),
    ...(isFiniteNum(r.eventsPerCycle) ? { eventsPerCycle: Math.round(r.eventsPerCycle * 10) / 10 } : {}),
  };
}
