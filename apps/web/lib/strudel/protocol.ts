// The messages between the player page (trusted), the sandboxed frame and the worker that runs the model's Strudel code (untrusted).
// The code never makes sound or touches the network: it only produces events (haps), and the page turns them into audio.

export const FRAME_URL = "/strudel/frame.html";
export const WORKER_URL = "/strudel/worker.js";

/** A control value Strudel passes to superdough: numbers, short strings, booleans, and short arrays of those. */
export type Prim = number | string | boolean;
export type HapValue = Record<string, Prim | Prim[]>;
/** `[start, end]` offsets into the model's code: the mini-notation atoms this event came from (what the code view lights up). */
export type Loc = [number, number];
export interface Hap { v: HapValue; /** audio-context time the event starts */ t: number; /** seconds */ d: number; cps: number; cycle: number; loc?: Loc[] }

/** The drawings the model's code asked for (`.pianoroll()`, `.scope()`...). The worker records the call and its options; the page draws. */
export const VIZ_NAMES = ["pianoroll", "punchcard", "wordfall", "spiral", "pitchwheel", "scope", "tscope", "fscope", "spectrum"] as const;
export type VizName = (typeof VIZ_NAMES)[number];
export interface VizSpec { id: number; name: VizName; /** `_pianoroll()`: drawn in a lane, not as the whole background */ inline: boolean; opts: Record<string, Prim> }
/** An event for the drawings: where it starts and how long it lasts (in cycles), the few keys a drawing reads, the code spans, and the drawings it belongs to. */
export interface DrawHap { c: number; l: number; v: Record<string, Prim>; loc: Loc[]; viz: number[] }

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
  | { kind: "viz"; specs: unknown }
  | { kind: "draw"; haps: unknown }
  | { kind: "alive" };

export const MAX_KEYS = 64, MAX_STR = 96, MAX_ARR = 16, MAX_HAPS_PER_SECOND = 600, MAX_NOTES = 8;
/** Drawing events have their own budget: a pianoroll looks several cycles ahead and behind, so a dense pattern sends more than the sound does. */
export const MAX_DRAW_HAPS_PER_SECOND = 2000, MAX_VIZ = 8, MAX_LOC = 16, MAX_DRAW_BATCH = 400;

const isFiniteNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Structural check of a hap from the frame: known shape, finite numbers, short strings. This is not a limit on how loud or harsh the
 *  music is (Strudel has none on sonorous): it keeps a malformed message from crashing superdough or the page. */
/** A list of code spans: integers, `0 <= start < end <= codeLength`, at most MAX_LOC. Anything else is dropped. */
export function validateLoc(raw: unknown, codeLength: number): Loc[] {
  if (!Array.isArray(raw)) return [];
  const out: Loc[] = [];
  for (const x of raw.slice(0, MAX_LOC)) {
    if (!Array.isArray(x) || x.length !== 2) continue;
    const [a, b] = x as unknown[];
    if (Number.isInteger(a) && Number.isInteger(b) && (a as number) >= 0 && (a as number) < (b as number) && (b as number) <= codeLength) out.push([a as number, b as number]);
  }
  return out;
}

/** A colour the canvas can take: hex, a name, or rgb/hsl/hwb/lab/lch/oklch with plain arguments. No `url(`, no `var(`: a colour is only ever handed to `fillStyle`. */
export function isSafeColour(x: unknown): x is string {
  return typeof x === "string" && x.length <= MAX_STR && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,24}|(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([0-9a-zA-Z .,%/+-]{1,80}\))$/.test(x.trim());
}

export function validateHap(raw: unknown, codeLength = 0): Hap | null {
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
  const loc = codeLength > 0 ? validateLoc(h.loc, codeLength) : [];
  return { v, t: h.t, d: h.d, cps: h.cps, cycle: h.cycle, ...(loc.length ? { loc } : {}) };
}

/** The range of each numeric option of a drawing. The values come from the model's code and drive loops and sizes on the page's own
 *  thread (the watchdog only covers the worker), so nothing is taken as it comes: out-of-range numbers are pulled into range. */
const OPT_RANGE: Record<string, [number, number]> = {
  cycles: [0.25, 16], playhead: [0, 1], overscan: [0, 4], minMidi: [0, 127], maxMidi: [0, 127],
  stretch: [0.1, 8], size: [10, 400], thickness: [0.5, 100], inset: [0, 8], padding: [0, 4], playheadLength: [0, 1], playheadThickness: [0.5, 100], steady: [0, 2],
  speed: [1, 16], edo: [1, 96], root: [16, 4000], hapRadius: [1, 60], margin: [0, 200], scale: [-2, 2], pos: [-1, 2], lean: [0, 1], min: [-200, 100], max: [-200, 100], trigger: [-1, 1],
};
export const clampOpt = (key: string, x: number): number => { const [a, b] = OPT_RANGE[key] ?? [-1e4, 1e4]; return Math.min(b, Math.max(a, x)); };

const VIZ_OPT_KEY = /^[A-Za-z][A-Za-z0-9]{0,23}$/;
/** The drawings the code asked for: a known name, options that are numbers, booleans, short plain strings, colours only where a colour is expected. */
export function validateViz(raw: unknown): VizSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: VizSpec[] = [];
  for (const x of raw.slice(0, MAX_VIZ)) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (!Number.isInteger(r.id) || (r.id as number) < 0 || (r.id as number) >= MAX_VIZ) continue;
    if (!(VIZ_NAMES as readonly string[]).includes(r.name as string)) continue;
    const opts: Record<string, Prim> = {};
    if (r.opts && typeof r.opts === "object" && !Array.isArray(r.opts)) {
      for (const [k, v] of Object.entries(r.opts as Record<string, unknown>).slice(0, 32)) {
        if (!VIZ_OPT_KEY.test(k)) continue;
        if (isFiniteNum(v)) opts[k] = clampOpt(k, v); else if (typeof v === "boolean") opts[k] = v;
        else if (typeof v === "string") { if (/color$/i.test(k) || k === "active" || k === "inactive" || k === "background" || k === "fill") { if (isSafeColour(v)) opts[k] = v.trim(); } else if (/^[A-Za-z0-9 _.-]{0,32}$/.test(v)) opts[k] = v; }
      }
    }
    out.push({ id: r.id as number, name: r.name as VizName, inline: r.inline === true, opts });
  }
  return out;
}

/** The keys a drawing reads from an event. Strings are short and plain; a colour must be a safe colour. */
const DRAW_KEYS = ["note", "n", "freq", "s", "color", "gain", "velocity", "label", "activeLabel"] as const;
export function validateDrawHap(raw: unknown, codeLength: number): DrawHap | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  if (!isFiniteNum(h.c) || !isFiniteNum(h.l) || h.l < 0 || h.l > 600) return null;
  const v: Record<string, Prim> = {};
  if (h.v && typeof h.v === "object" && !Array.isArray(h.v)) {
    const src = h.v as Record<string, unknown>;
    for (const k of DRAW_KEYS) {
      const x = src[k];
      if (x === undefined) continue;
      if (k === "color") { if (isSafeColour(x)) v[k] = x.trim(); }
      else if (isFiniteNum(x)) v[k] = x;
      else if (typeof x === "string" && x.length <= MAX_STR) v[k] = x;
    }
  }
  const viz = Array.isArray(h.viz) ? h.viz.filter((i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < MAX_VIZ).slice(0, MAX_VIZ) : [];
  if (!viz.length) return null;
  return { c: h.c, l: h.l, v, loc: validateLoc(h.loc, codeLength), viz };
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
