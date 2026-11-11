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

/** What strudel.cc has and the worker does not: drawing and the like. Calling them must not break the code. */
const DRAW = ["pianoroll", "punchcard", "scope", "tscope", "fscope", "spectrum", "spiral", "pitchwheel", "wordfall", "markcss", "hydra", "_pianoroll", "_punchcard", "_scope", "_tscope", "_fscope", "_spectrum", "_spiral", "_pitchwheel", "_wordfall", "onPaint", "draw"];

let ready: Promise<void> | null = null;
function setup() {
  if (!ready) ready = (async () => {
    await core.evalScope(core, mini, tonal);
    for (const name of DRAW) {
      (core.Pattern.prototype as any)[name] = function () { note(`.${name.replace(/^_/, "")}() ignored: no drawing on sonorous`); return this; };
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

    let from = start; // the first cycle boundary we may play (the next bar)
    loop = setInterval(() => {
      if (mine !== run) return;
      post({ kind: "alive" });
      const now = clock.ctxTime + (Date.now() - clock.epochMs) / 1000;
      const nowCycle = clock.cycle + (now - clock.ctxTime) * cps;
      const to = nowCycle + 0.3 * cps; // look 300 ms ahead
      if (to <= from) return;
      try {
        for (const h of pattern.queryArc(from, to, { _cps: cps })) {
          if (!h.hasOnset()) continue;
          h.ensureObjectValue?.();
          const begin = h.whole.begin.valueOf();
          post({ kind: "hap", hap: { v: sanitize(h.value), t: clock.ctxTime + (begin - clock.cycle) / cps, d: h.duration / cps, cps, cycle: begin } });
        }
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
