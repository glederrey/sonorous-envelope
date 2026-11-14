/* eslint-disable @typescript-eslint/no-explicit-any */
// The worker that runs the model's Strudel code. It lives in a sandboxed frame (no storage, no network, no sound of its own) and
// only sends events (haps) out. Built to public/strudel/worker.js (apps/web/package.json, build:strudel).
// Strudel is AGPL-3.0-or-later; see docs/licensing.md. This bundle includes @strudel/core, mini, tonal and transpiler unmodified.
import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import { transpiler } from "@strudel/transpiler";

const post = (m: unknown) => (self as any).postMessage(m);
const g = globalThis as any;

// Defence in depth: the frame's CSP already blocks the network, and the frame has an opaque origin. The code gets none of these APIs anyway.
for (const name of ["indexedDB", "caches", "Worker", "SharedWorker", "XMLHttpRequest", "WebSocket", "EventSource", "fetch", "importScripts", "BroadcastChannel", "WebTransport"]) {
  try { Object.defineProperty(g, name, { value: undefined, writable: false, configurable: false }); } catch { /* not there, or not changeable: the CSP still holds */ }
}

// the clock: audio-context time of "now", from the page's last sync
let clock = { ctxTime: 0, epochMs: Date.now(), cycle: 0 };
let seq = 0;
let cps = 0.5, loop: ReturnType<typeof setInterval> | null = null, run = 0;

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const notes: string[] = [];
const note = (n: string) => { if (notes.length < 8 && !notes.includes(n)) notes.push(n); };

/** The drawings strudel.cc has and sonorous draws too (the page draws them, from the events this worker sends; the worker only records the call). */
const VIZ = ["pianoroll", "punchcard", "wordfall", "spiral", "scope", "tscope", "fscope", "spectrum"];
/** What strudel.cc has and sonorous does not. Calling them must not break the code. */
const IGNORED = ["pitchwheel", "markcss", "hydra", "_pitchwheel", "_markcss", "onPaint", "draw"];
const MAX_VIZ = 8, MAX_LOC = 16;
const specs: Array<{ id: number; name: string; inline: boolean; opts: Record<string, unknown> }> = [];

/** Options of a drawing call: numbers, booleans, strings, nothing else (the page checks them again). */
function cleanOpts(o: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!o || typeof o !== "object") return out;
  for (const k of Object.keys(o).slice(0, 32)) {
    const x = o[k];
    if (typeof x === "number" || typeof x === "boolean" || (typeof x === "string" && x.length <= 96)) out[k] = x;
  }
  return out;
}

let ready: Promise<void> | null = null;
function setup() {
  if (!ready) ready = (async () => {
    await core.evalScope(core, mini, tonal);
    for (const name of IGNORED) {
      (core.Pattern.prototype as any)[name] = function () { note(`.${name.replace(/^_/, "")}() ignored: not available on sonorous`); return this; };
    }
    // a drawing call records what was asked (with its options) and tags the events of that pattern with the drawing's number
    for (const base of VIZ) {
      for (const name of [base, `_${base}`]) {
        const method = function (this: any, opts?: unknown) {
          const o = cleanOpts(opts), inline = name.startsWith("_");
          let spec = specs.find((s) => s.name === base && s.inline === inline && JSON.stringify(s.opts) === JSON.stringify(o));
          if (!spec && specs.length < MAX_VIZ) { spec = { id: specs.length, name: base, inline, opts: o }; specs.push(spec); }
          else if (!spec) { note(`.${base}(): at most ${MAX_VIZ} drawings, the rest are ignored`); return this; }
          return this.tag(`viz:${spec.id}`);
        };
        (core.Pattern.prototype as any)[name] = method;
        // all(pianoroll), all(scope({ ... })): the function forms
        g[name] = (arg?: any) => (core.isPattern(arg) ? (arg as any)[name]() : (pat: any) => pat[name](arg));
      }
    }
    // the page loads samples, from its own list of banks: the worker only asks
    g.samples = async (a: unknown) => {
      if (typeof a === "string") post({ kind: "banks", names: [a] });
      else note("samples({...}): custom sample maps are not allowed; the usual banks (bd, sd, hh, piano...) are loaded");
    };
    g.initHydra = async () => note("hydra is not available");
    g.hush = g.hush ?? (() => core.silence);
  })();
  return ready;
}

/** The code spans of an event and the drawings it belongs to (from its tags). */
function spans(h: any): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const l of h.context?.locations ?? []) {
    if (out.length >= MAX_LOC) break;
    if (l && Number.isInteger(l.start) && Number.isInteger(l.end)) out.push([l.start, l.end]);
  }
  return out;
}
function vizIds(h: any): number[] {
  const out: number[] = [];
  for (const t of h.context?.tags ?? []) { const m = typeof t === "string" && /^viz:(\d+)$/.exec(t); if (m && out.length < MAX_VIZ) out.push(Number(m[1])); }
  return out;
}

function sanitize(v: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v ?? {})) {
    let x = v[k];
    if (x && typeof x === "object" && !Array.isArray(x) && typeof x.valueOf === "function") x = x.valueOf(); // Fraction -> number
    if (Array.isArray(x)) x = x.map((y: any) => (y && typeof y === "object" && typeof y.valueOf === "function" ? y.valueOf() : y));
    if (typeof x === "function" || x === undefined || (x && typeof x === "object" && !Array.isArray(x))) continue;
    out[k] = x;
  }
  return out;
}

/** Plain words for the errors a model is likely to hit and not understand. */
function friendly(msg: string): string {
  if (/unexpected ast format/i.test(msg)) return "the code must end with a pattern (an expression), not a statement such as throw, if or a declaration";
  if (/\[mini\]/i.test(msg)) return `${msg.slice(0, 90)}... Note: double-quoted strings are mini-notation in Strudel; use single quotes for plain text.`;
  return msg;
}

function stopLoop() { if (loop) clearInterval(loop); loop = null; run++; }

async function play(m: { seq?: number; code: string; bpm: number; seed: number; ctxTime: number; epochMs: number; cycle: number }) {
  stopLoop();
  const mine = run;
  seq = typeof m.seq === "number" ? m.seq : 0;
  const mySeq = seq;
  notes.length = 0;
  specs.length = 0;
  cps = m.bpm / 240; // one cycle is one bar of four beats; the tempo is the tool's bpm, not setcps
  clock = { ctxTime: m.ctxTime, epochMs: m.epochMs, cycle: m.cycle };
  Math.random = mulberry32(m.seed);
  try {
    await setup();
    let pattern: any;
    const r = core.repl({
      defaultOutput: () => {}, getTime: () => 0, transpiler,
      setInterval: () => 0 as any, clearInterval: () => {}, // Cyclist is never started: this worker runs its own scheduler on the page's clock
    } as any);
    (r.scheduler as any).cps = cps;
    (r.scheduler as any).setCps = () => note("setcps/setcpm ignored: the tempo is bpm");
    pattern = await r.evaluate(m.code, false);
    const err = (r.state as any).evalError;
    if (err || !pattern) {
      post({ kind: "report", seq: mySeq, report: { ok: false, error: friendly(String(err?.message ?? err ?? "the code did not make a pattern")).slice(0, 200), notes: [...notes] } });
      return;
    }
    if (mine !== run) return;
    // events per cycle and the sounds used, from a short look ahead (the pattern is pure, so asking costs nothing audible)
    const start = Math.ceil(clock.cycle + 0.05);
    const sample = pattern.queryArc(start, start + 4, { _cps: cps }).filter((h: any) => h.hasOnset());
    const sounds = [...new Set(sample.map((h: any) => (h.value && typeof h.value === "object" ? (h.value.s ?? "(default)") : "(default)")))].slice(0, 8);
    post({ kind: "report", seq: mySeq, report: { ok: true, eventsPerCycle: sample.length / 4, notes: [...notes, ...(sounds.length ? [`sounds: ${sounds.join(", ")}`] : [])].slice(0, 8) } });

    // the drawings the code asked for (the specs are filled while the code runs, and while the first look-ahead queries it)
    const report = () => post({ kind: "viz", specs: specs.map((s) => ({ ...s })) });
    report();
    const reach = (s: { name: string; opts: Record<string, unknown> }) => {
      // how far ahead and behind (in cycles) a drawing looks
      if (s.name === "spiral") return { behind: 2, ahead: 2 };
      if (s.name === "pianoroll" || s.name === "punchcard" || s.name === "wordfall") {
        const cycles = typeof s.opts.cycles === "number" ? Math.min(16, Math.max(1, s.opts.cycles)) : 4;
        const playhead = typeof s.opts.playhead === "number" ? Math.min(1, Math.max(0, s.opts.playhead)) : 0.5;
        const over = typeof s.opts.overscan === "number" ? Math.min(4, Math.max(0, s.opts.overscan)) : 1;
        return { behind: cycles * playhead + over, ahead: cycles * (1 - playhead) + over };
      }
      return { behind: 0, ahead: 0.25 }; // scope, fscope, spectrum read the sound, only the colour of the newest event
    };
    let drawFrom = Math.max(0, clock.cycle), drawSeen = 0, drawAt = 0, sentSpecs = specs.length;
    let from = start; // the first cycle boundary we may play (the next bar)
    loop = setInterval(() => {
      if (mine !== run) return;
      post({ kind: "alive" });
      const now = clock.ctxTime + (Date.now() - clock.epochMs) / 1000;
      const nowCycle = clock.cycle + (now - clock.ctxTime) * cps;
      const to = nowCycle + 0.8 * cps; // look 800 ms ahead: a stalled main thread (a phone while its controls are used) must not run dry
      if (to <= from) return;
      try {
        for (const h of pattern.queryArc(from, to, { _cps: cps })) {
          if (!h.hasOnset()) continue;
          h.ensureObjectValue?.();
          const begin = h.whole.begin.valueOf();
          post({ kind: "hap", hap: { v: sanitize(h.value), t: clock.ctxTime + (begin - clock.cycle) / cps, d: h.duration / cps, cps, cycle: begin, loc: spans(h) } });
        }
        // drawings: the events of the tagged patterns, several cycles ahead, in batches (never to the speakers)
        if (specs.length !== sentSpecs) { sentSpecs = specs.length; report(); }
        const nowMs = Date.now();
        if (specs.length && nowMs - drawAt >= 150) try { // a drawing that fails must not stop the music
          drawAt = nowMs;
          const ahead = Math.max(...specs.map((s) => reach(s).ahead)), behind = Math.max(...specs.map((s) => reach(s).behind));
          const upTo = nowCycle + ahead;
          if (drawSeen === 0) drawFrom = Math.max(0, nowCycle - behind);
          drawSeen++;
          if (upTo > drawFrom) {
            const out: unknown[] = [];
            for (const h of pattern.queryArc(drawFrom, upTo, { _cps: cps })) {
              if (!h.hasOnset()) continue;
              const ids = vizIds(h);
              if (!ids.length) continue;
              h.ensureObjectValue?.();
              const begin = h.whole.begin.valueOf();
              if (begin < drawFrom) continue; // an event that began before this window was sent with the one before
              out.push({ c: begin, l: Number(h.duration), v: sanitize(h.value), loc: spans(h), viz: ids });
              if (out.length >= 400) break;
            }
            if (out.length) post({ kind: "draw", haps: out });
            drawFrom = upTo;
          }
        } catch { drawAt = nowMs + 5000; }
      } catch (e: any) {
        post({ kind: "report", seq: mySeq, report: { ok: false, error: `while playing: ${String(e?.message ?? e).slice(0, 160)}`, notes: [...notes] } });
        stopLoop();
        return;
      }
      from = to;
    }, 40);
  } catch (e: any) {
    post({ kind: "report", seq: mySeq, report: { ok: false, error: friendly(String(e?.message ?? e)).slice(0, 200), notes: [...notes] } });
  }
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (!m || typeof m !== "object") return;
  if (m.kind === "play") void play(m);
  else if (m.kind === "clock") clock = { ctxTime: m.ctxTime, epochMs: m.epochMs, cycle: m.cycle };
  else if (m.kind === "stop") stopLoop();
};
