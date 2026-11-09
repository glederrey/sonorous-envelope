import type { Colour, SynthOverride } from "./schemas";

/**
 * What stays on the session until Claude changes it, like the voice: the colour, the stacked chord intervals, the pad
 * and the LFOs. The rest of `synth` (tempo, filter, envelope, echo...) is for one call, so the mood keeps driving it.
 * To clear: colour `mode: "follow"`, `osc.stack: []`, `lfo: []` (back to the mapped LFOs). The pad stays but `pad.on: false` silences it.
 */
export interface Sticky {
  colour?: Colour;
  stack?: number[];
  pad?: NonNullable<SynthOverride["pad"]>;
  lfo?: NonNullable<SynthOverride["lfo"]>;
}

const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Fold one set_sound call into what the session already keeps. Pure. */
export function mergeSticky(prev: Sticky | null | undefined, input: { colour?: Colour; synth?: SynthOverride }): Sticky {
  const s: Sticky = { ...(prev ?? {}) };
  const c = input.colour;
  if (c) {
    if (c.mode === "follow") delete s.colour;
    else s.colour = { ...(s.colour ?? {}), ...defined(c) };
  }
  const stack = input.synth?.osc?.stack;
  if (stack !== undefined) { if (stack.length) s.stack = [...stack]; else delete s.stack; }
  const pad = input.synth?.pad;
  // new notes without `on` switch the pad on, also after it was silenced with on false
  if (pad) s.pad = { ...(s.pad ?? {}), ...defined(pad), ...(pad.notes && pad.on === undefined ? { on: true } : {}) };
  const lfo = input.synth?.lfo;
  if (lfo !== undefined) { if (lfo.length) s.lfo = lfo.map((l) => ({ ...l })); else delete s.lfo; }
  return s;
}

/** The synth override the kept settings stand for. Applied before the call's own `synth`. */
export function stickyToSynth(s: Sticky | null | undefined): SynthOverride | undefined {
  if (!s) return undefined;
  const out: SynthOverride = {};
  if (s.stack) out.osc = { stack: s.stack };
  if (s.pad) out.pad = s.pad;
  if (s.lfo) out.lfo = s.lfo;
  return Object.keys(out).length ? out : undefined;
}

/** The call's own synth without an empty `lfo` (which means "back to the mapped LFOs", not "no LFOs"). */
export function callSynth(synth: SynthOverride | undefined): SynthOverride | undefined {
  if (!synth || synth.lfo === undefined || synth.lfo.length > 0) return synth;
  const { lfo: _lfo, ...rest } = synth;
  return Object.keys(rest).length ? rest : undefined;
}
