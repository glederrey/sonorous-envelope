// The data and the pure helpers behind the Strudel picture (docs/implementation/strudel.md, "The picture"): what the code asked to draw,
// the events to draw, which spans of the code are sounding now, how the code is cut into coloured runs, and how big it is set.
// Nothing here touches the DOM or the canvas, so tests can run it.
import type { DrawHap, Loc, VizSpec } from "./protocol";

/** An event as the code view needs it: the spans of the code it came from, when it starts and how long it lasts (cycles), its own colour. */
export interface Mark { c: number; l: number; loc: Loc[]; colour?: string }

const MAX_DRAW = 3000, MAX_MARKS = 2000;

/** What the player holds for the picture: the drawings the code asked for, the events to draw, and the marks for the code view.
 *  It is reset with every new code, so an old pattern never shows over a new one. */
export class VizStore {
  code = "";
  bpm = 120;
  specs: VizSpec[] = [];
  draws: DrawHap[] = [];
  marks: Mark[] = [];
  /** the newest colour an event of each drawing carried (the scopes take their colour from it) */
  colours = new Map<number, string>();
  /** bumps when the code or the drawings change, so the view knows to lay out again */
  version = 0;

  /** new code is evaluated and has not reported its drawings yet: the old drawings stay until it does (see `swap`) */
  swapping = false;
  /** bumps when new code's drawings replace the old ones: the view crossfades from its last frame of the old drawings */
  swaps = 0;

  /** bumps when a pattern starts from nothing (not on new code over a playing one): the code view waits for its first sound */
  resets = 0;

  reset(code: string, bpm: number) { this.resets++; this.code = code; this.bpm = bpm; this.specs = []; this.draws = []; this.marks = []; this.colours.clear(); this.swapping = false; this.version++; }
  /** New code on a pattern that plays: the code text changes at once, the lit parts go out, but the drawings keep running until the new code
   *  reports its own (`setSpecs`), so nothing blinks. */
  swap(code: string, bpm: number) { this.code = code; this.bpm = bpm; this.marks = []; this.swapping = true; this.version++; }
  setSpecs(specs: VizSpec[]) {
    if (this.swapping) { this.draws = []; this.colours.clear(); this.swapping = false; this.swaps++; }
    this.specs = specs; this.version++;
  }
  addDraw(h: DrawHap) {
    this.draws.push(h);
    const colour = h.v.color;
    if (typeof colour === "string") for (const id of h.viz) this.colours.set(id, colour);
    if (this.draws.length > MAX_DRAW) this.draws.splice(0, this.draws.length - MAX_DRAW);
  }
  addMark(m: Mark) { this.marks.push(m); if (this.marks.length > MAX_MARKS) this.marks.splice(0, this.marks.length - MAX_MARKS); }
  /** Drop what is long past: events older than `keep` cycles behind `cycle`. */
  prune(cycle: number, keepDraw = 12, keepMarks = 2) {
    if (this.draws.length && this.draws[0].c + this.draws[0].l < cycle - keepDraw) this.draws = this.draws.filter((h) => h.c + h.l >= cycle - keepDraw);
    if (this.marks.length && this.marks[0].c + this.marks[0].l < cycle - keepMarks) this.marks = this.marks.filter((m) => m.c + m.l >= cycle - keepMarks);
  }
  clear() { this.reset("", this.bpm); }
}

/** A span of the code that is sounding (level 1) or just stopped (level falling to 0 over `tail` cycles). */
export interface Lit { start: number; end: number; level: number; colour?: string }

/** The spans lit at `cycle`: those of events that are on now, plus a short fade after they end. Of two events on one span the newest wins. */
export function litSpans(marks: Mark[], cycle: number, tail: number): Lit[] {
  const best = new Map<string, Lit & { c: number }>();
  for (const m of marks) {
    if (m.c > cycle) continue; // not yet
    const over = cycle - (m.c + m.l);
    const level = over < 0 ? 1 : over < tail ? 1 - over / tail : 0;
    if (level <= 0) continue;
    for (const [start, end] of m.loc) {
      const key = `${start}:${end}`, old = best.get(key);
      if (!old || level > old.level || (level === old.level && m.c > old.c)) best.set(key, { start, end, level, colour: m.colour, c: m.c });
    }
  }
  return [...best.values()].map(({ start, end, level, colour }) => ({ start, end, level, colour }));
}

/** Character classes of the code view. */
export const enum Cls { Plain = 0, Comment = 1, String = 2, Number = 3, Method = 4, Func = 5, Mini = 6 }

/** A light tokenizer for Strudel code: comments, strings (with the mini-notation operators marked), numbers, `.method(` and `func(`.
 *  It is for colour only: a wrong guess changes a colour, never the text. */
export function tokenize(code: string): Uint8Array {
  const out = new Uint8Array(code.length);
  const n = code.length;
  let i = 0;
  const isId = (c: string) => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") { let j = i; while (j < n && code[j] !== "\n") j++; out.fill(Cls.Comment, i, j); i = j; continue; }
    if (c === "/" && code[i + 1] === "*") { let j = code.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; out.fill(Cls.Comment, i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && code[j] !== c) { if (code[j] === "\\") j++; j++; }
      j = Math.min(n, j + 1);
      out.fill(Cls.String, i, j);
      if (c !== "'") for (let k = i + 1; k < j - 1; k++) if ("~*/<>[],!@(){}:%?|".includes(code[k])) out[k] = Cls.Mini; // mini-notation operators
      i = j; continue;
    }
    if (/[0-9]/.test(c) && (i === 0 || !isId(code[i - 1]))) { let j = i; while (j < n && /[0-9._]/.test(code[j])) j++; out.fill(Cls.Number, i, j); i = j; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && isId(code[j])) j++;
      let k = j; while (k < n && code[k] === " ") k++;
      if (code[k] === "(") out.fill(code[i - 1] === "." ? Cls.Method : Cls.Func, i, j);
      i = j; continue;
    }
    i++;
  }
  return out;
}

/** One run of the code view: text of one class, lit by one span (or none). */
export interface Run { text: string; cls: number; lit: number }

/** Cut the code into runs: a new run starts where the class or the lighting span changes. `lit` indexes into `spans` (-1: not lit); where
 *  spans overlap the strongest wins. Spans outside the code are ignored. */
export function runs(code: string, cls: Uint8Array, spans: Lit[]): Run[] {
  const n = code.length;
  const hi = new Int16Array(n).fill(-1), strength = new Float32Array(n);
  spans.forEach((s, idx) => {
    for (let k = Math.max(0, s.start); k < Math.min(n, s.end); k++) if (s.level >= strength[k]) { strength[k] = s.level; hi[k] = idx; }
  });
  const out: Run[] = [];
  let from = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || cls[i] !== cls[from] || hi[i] !== hi[from] || code[i - 1] === "\n") {
      out.push({ text: code.slice(from, i), cls: cls[from], lit: hi[from] });
      from = i;
    }
  }
  return n ? out : [];
}

/** A short key of what the code view shows: the levels are rounded to quarters so it changes a few times per note, not on every frame. */
export function litKey(spans: Lit[]): string {
  return spans.map((s) => `${s.start}:${s.end}:${Math.ceil(s.level * 4)}:${s.colour ?? ""}`).sort().join("|");
}

/** The biggest font size (px) at which the whole code fits a box of `width` by `height`, counting the lines that wrap: monospace, a
 *  character 0.6 em wide, a line 1.55 em tall. From 24 px down to a floor that is smaller on narrow screens (phones); code that still
 *  does not fit at the floor is set at the floor, and the view follows the lit part up and down (`scrollFor`). */
export function fitFont(code: string, width: number, height: number): number {
  const lines = code.split("\n"), floor = width < 560 ? 8 : 10;
  for (let size = 24; size > floor; size--) {
    const cols = Math.max(1, Math.floor((width * 0.92) / (size * 0.6)));
    const rows = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cols)), 0);
    if (rows * size * 1.55 <= height * 0.92) return size;
  }
  return floor;
}

/** Where a box whose content is `over` px taller than the box is scrolled at time `t` (seconds): it waits at the top, drifts down at `speed`
 *  px a second, waits at the bottom, drifts back. Code taller than the view is shown by sweeping over it (a stack lights every line at
 *  once, so there is no one lit line to follow), and the page itself never scrolls. 0 when it all fits. */
export function sweepOffset(t: number, over: number, speed = 28, pause = 2): number {
  if (over <= 0) return 0;
  const travel = over / speed, period = 2 * (travel + pause), u = ((t % period) + period) % period;
  if (u < pause) return 0;
  if (u < pause + travel) return (u - pause) * speed;
  if (u < 2 * pause + travel) return over;
  return over - (u - 2 * pause - travel) * speed;
}

/** Rectangles of the drawings in a canvas of w by h: the plain calls (`.pianoroll()`) fill the whole view behind the code; the `_` calls
 *  share a band along the bottom, one lane each. */
export interface Lane { spec: VizSpec; x: number; y: number; w: number; h: number }
export function lanes(specs: VizSpec[], w: number, h: number): Lane[] {
  const back = specs.filter((s) => !s.inline), inline = specs.filter((s) => s.inline);
  const out: Lane[] = back.map((spec) => ({ spec, x: 0, y: 0, w, h }));
  const band = inline.length ? h * Math.min(0.5, 0.2 + 0.1 * inline.length) : 0, laneH = inline.length ? band / inline.length : 0;
  inline.forEach((spec, i) => out.push({ spec, x: 0, y: h - band + i * laneH, w, h: laneH }));
  return out;
}

/** The text a piano roll puts on an event by default (Strudel's own rule: its note, else its sound and index). */
const defaultLabel = (v: DrawHap["v"]): string => String(v.label ?? v.note ?? (v.s !== undefined ? `${v.s}${v.n !== undefined ? `:${v.n}` : ""}` : ""));

/** Labels on a roll are drawn at a size set by the bar (its thickness on a horizontal roll, its length on a vertical one), so on a small
 *  screen or for a short event they come out tiny, or spill out of the bar. This blanks the label of an event whose label would be smaller
 *  than `minPx` or more than twice as wide as its bar (Strudel squeezes it into the bar), instead of drawing it unreadable. `w` and `h` are the lane in canvas pixels. */
export function hideTinyLabels(haps: DrawHap[], o: { vertical: boolean; fold: boolean; minMidi: number; maxMidi: number; timeExtent: number }, w: number, h: number, minPx: number): DrawHap[] {
  const rowKey = (v: DrawHap["v"]) => (typeof v.freq === "number" ? `f${v.freq}` : String(v.note ?? v.n ?? (v.s !== undefined ? `_${v.s}` : "")));
  const rows = o.fold ? Math.max(1, new Set(haps.map((d) => rowKey(d.v))).size) : o.maxMidi - o.minMidi + 1;
  const valueAxis = o.vertical ? w : h, timeAxis = o.vertical ? h : w;
  const thickness = valueAxis / rows;
  return haps.map((d) => {
    const text = defaultLabel(d.v);
    if (!text) return d;
    const lengthPx = (d.l / o.timeExtent) * timeAxis;
    // horizontal: the font is 0.75 of the bar's thickness and the text runs along the bar; vertical: the font is the bar's length and the text runs across it
    const font = o.vertical ? lengthPx : thickness * 0.75;
    // Strudel squeezes a label into its bar (fillText has a max width), so a little too wide still reads; hide it when the squeeze is extreme
    const natural = text.length * 0.6 * font, room = o.vertical ? thickness : lengthPx;
    return font >= minPx && natural <= room * 2 ? d : { ...d, v: { ...d.v, label: "", activeLabel: "" } };
  });
}

/** The part of an event (c to c + l, in cycles) that a spiral shows at `time`: it looks two cycles behind and ahead, so a long event is
 *  cut to that. Null when none of it shows. */
export function spiralSpan(c: number, l: number, time: number, reach = 2.5): [number, number] | null {
  const a = Math.max(c - time, -reach), b = Math.min(c + l - time, reach);
  return b > a ? [a, b] : null;
}
/** How many line segments a spiral piece of `span` cycles gets: 60 a turn, at least 2, at most 240, whatever `stretch` says. */
export const spiralSteps = (span: number, stretch: number): number => Math.min(240, Math.max(2, Math.ceil(span * stretch * 60)));
/** Most events one spiral draws a frame. */
export const SPIRAL_MAX_EVENTS = 400;
