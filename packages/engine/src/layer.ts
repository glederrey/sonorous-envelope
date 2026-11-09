import { buildCycle, midiToHz } from "./music";
import { mulberry32 } from "./prng";
import { oscSample } from "./oscillator";
import type { NoteEvent, Pattern, ScaleName, Wave } from "./types";

const MAX_VOICES = 16; // 6 notes in flight, each up to 4 voices with a stack
const MAX_PENDING = 8;

export interface LayerParams {
  on: boolean;
  root: number; scale: ScaleName; chord: number[]; octaves: number; pattern: Pattern;
  stepSeconds: number; gate: number; swing: number; density: number; jitterMs: number;
  wave: Wave; voices: number; detune: number; stack: number[];
  attack: number; decay: number; sustain: number; release: number;
  level: number;
}

class Voice {
  active = false;
  midi = 0; dt = 0;
  phases = [0, 0, 0]; detuneMul = [1, 1, 1]; n = 1;
  stage = 0; env = 0; held = 0; velocity = 1;
  atk = 0; decC = 0; sus = 0; relC = 0; wave: Wave = "sine";
  age = 0;
}

const ENV_FLOOR = 1e-4;

/** A step-sequenced voice pool. Used twice: the foreground arpeggio and the slow bass arpeggio. */
export class Layer {
  private voices: Voice[] = Array.from({ length: MAX_VOICES }, () => new Voice());
  private pendAt = new Float64Array(MAX_PENDING);
  private pendMidi = new Int16Array(MAX_PENDING);
  private pendLen = new Float64Array(MAX_PENDING);
  private pendCount = 0;
  private cycle: number[] = [60];
  private seen = { root: -1, scale: "" as string, octaves: -1, pattern: "" as string, chord: [] as number[] };
  private step = 0; // the shared step counter: step k happens at the same moment on every device (see `align`)
  private nextStep = 0;
  private gridSeed = 1;
  private p!: LayerParams;

  constructor(private sr: number, private rand: () => number, private name: "arp" | "bass",
              private events: NoteEvent[] | null) {}

  reseed(rand: () => number) { this.rand = rand; }
  setGridSeed(seed: number) { this.gridSeed = seed >>> 0; }

  /** The randomness of one step depends only on the session's grid seed and the step number, never on what was played
   *  before, so a device that joins late and a device that has played from the start choose the same notes. */
  private stepRng(k: number) {
    let h = (this.gridSeed ^ Math.imul(k + 1, 0x9e3779b1) ^ (this.name === "arp" ? 0xa1a1a1a1 : 0xb2b2b2b2)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
    return mulberry32(h >>> 0);
  }

  /** Put the step grid on the shared timeline. `gridK` is the (fractional) step count at the moment the state was written,
   *  `elapsed` the seconds since then, `stepSeconds` the state's step length. The next step is the next whole number. */
  align(t: number, gridK: number, elapsed: number, stepSeconds: number) {
    const at = gridK + elapsed / stepSeconds;
    const k = Math.ceil(at - 1e-9);
    this.step = k;
    this.nextStep = t + (k - at) * stepSeconds * this.sr;
  }
  /** Periodic resync against the shared timeline (devices' audio clocks drift apart slowly): pull the grid back only when it
   *  is further off than `toleranceSeconds`, so small network jitter in the clock estimate does not make the beat wobble. */
  sync(t: number, gridK: number, elapsed: number, stepSeconds: number, toleranceSeconds: number) {
    const at = gridK + elapsed / stepSeconds;
    const k = Math.ceil(at - 1e-9);
    const desired = t + (k - at) * stepSeconds * this.sr;
    if (k !== this.step || Math.abs(desired - this.nextStep) > toleranceSeconds * this.sr) { this.step = k; this.nextStep = desired; }
  }
  setEvents(e: NoteEvent[] | null) { this.events = e; }

  configure(p: LayerParams) {
    this.p = p;
    const k = this.seen;
    let same = k.root === p.root && k.scale === p.scale && k.octaves === p.octaves && k.pattern === p.pattern
      && k.chord.length === p.chord.length;
    for (let i = 0; same && i < p.chord.length; i++) same = k.chord[i] === p.chord[i];
    if (same) return;
    k.root = p.root; k.scale = p.scale; k.octaves = p.octaves; k.pattern = p.pattern; k.chord = p.chord.slice();
    this.cycle = buildCycle(p.root, p.scale, p.chord, p.octaves, p.pattern);
  }

  /** One sample of the layer (mono, before level). `t` = sample counter, `pitchMul` = vibrato multiplier. */
  process(t: number, pitchMul: number): number {
    const p = this.p;
    if (t >= this.nextStep) { if (p.on) this.runStep(t); else this.skipStep(t); }
    for (let i = 0; i < this.pendCount; ) {
      if (t >= this.pendAt[i]) {
        this.trigger(this.pendMidi[i], this.pendLen[i], t);
        const last = --this.pendCount;
        this.pendAt[i] = this.pendAt[last]; this.pendMidi[i] = this.pendMidi[last]; this.pendLen[i] = this.pendLen[last];
      } else i++;
    }
    let out = 0;
    for (const v of this.voices) {
      if (!v.active) continue;
      // envelope
      switch (v.stage) {
        case 0: v.env += v.atk; if (v.env >= 1) { v.env = 1; v.stage = 1; } break;
        case 1: v.env = v.sus + (v.env - v.sus) * v.decC; if (v.env - v.sus < 1e-3) v.stage = 2; break;
        case 2: break;
        default: v.env *= v.relC; if (v.env < ENV_FLOOR) { v.active = false; continue; }
      }
      if (v.stage < 3 && --v.held <= 0) v.stage = 3;
      let s = 0;
      for (let k = 0; k < v.n; k++) {
        const dt = v.dt * v.detuneMul[k] * pitchMul;
        s += oscSample(v.wave, v.phases[k], dt);
        v.phases[k] += dt; if (v.phases[k] >= 1) v.phases[k] -= 1;
      }
      out += (s / Math.sqrt(v.n)) * v.env * v.velocity;
    }
    return out * 0.3;
  }

  /** A step with the layer off still counts, so the grid stays the shared one when the layer comes back. */
  private skipStep(t: number) {
    this.step++;
    this.nextStep += this.p.stepSeconds * this.sr;
    if (this.nextStep < t) this.nextStep = t + this.p.stepSeconds * this.sr;
  }

  private runStep(t: number) {
    const p = this.p, sr = this.sr;
    const stepS = p.stepSeconds * sr;
    const i = this.step++;
    this.nextStep += stepS; // stays on the grid: a late or early call does not shift the following steps
    if (this.nextStep < t) this.nextStep = t + stepS; // after a long pause, do not play the missed steps in a burst
    const r = this.stepRng(i);
    if (r() > p.density) return;
    const midi = p.pattern === "random" ? this.cycle[Math.floor(r() * this.cycle.length)] : this.cycle[i % this.cycle.length];
    let delay = (i % 2 === 1 ? p.swing * 0.33 * stepS : 0);
    if (p.jitterMs > 0) delay += (p.jitterMs / 1000) * sr * (1 + (r() * 2 - 1));
    if (this.pendCount < MAX_PENDING) {
      this.pendAt[this.pendCount] = t + delay;
      this.pendMidi[this.pendCount] = midi;
      this.pendLen[this.pendCount] = Math.max(1, p.gate * stepS);
      this.pendCount++;
    }
  }

  private trigger(midi: number, lenSamples: number, t: number) {
    const p = this.p, sr = this.sr;
    // one voice per interval: the note itself, then each stacked interval (a chord), quieter so the sum stays level
    const count = 1 + p.stack.length;
    for (let s = 0; s < count; s++) this.triggerVoice(midi + (s === 0 ? 0 : p.stack[s - 1]), lenSamples, t, 0.8 / Math.sqrt(count));
  }

  private triggerVoice(midi: number, lenSamples: number, t: number, velocity: number) {
    const p = this.p, sr = this.sr;
    let v: Voice | undefined;
    for (let i = 0; i < this.voices.length; i++) if (!this.voices[i].active) { v = this.voices[i]; break; }
    if (!v) { v = this.voices[0]; for (let i = 1; i < this.voices.length; i++) if (this.voices[i].age < v.age) v = this.voices[i]; }
    v.active = true; v.midi = midi; v.dt = midiToHz(midi) / sr;
    v.n = Math.min(3, Math.max(1, Math.round(p.voices)));
    const d = Math.pow(2, p.detune / 1200);
    v.detuneMul[0] = v.n === 1 ? 1 : 1 / d;
    v.detuneMul[1] = v.n === 2 ? d : 1;
    v.detuneMul[2] = d;
    if (v.n === 3) { v.detuneMul[0] = 1 / d; v.detuneMul[1] = 1; v.detuneMul[2] = d; }
    for (let k = 0; k < 3; k++) v.phases[k] = this.rand();
    v.wave = p.wave; v.velocity = velocity; v.stage = 0; v.env = 0; v.age = t;
    v.atk = 1 / Math.max(1, p.attack * sr);
    v.sus = Math.min(1, Math.max(0, p.sustain));
    v.decC = Math.exp(-1 / Math.max(1, (p.decay / 5) * sr));
    v.relC = Math.exp(-1 / Math.max(1, (p.release / 5) * sr));
    v.held = Math.max(1, Math.round(lenSamples));
    this.events?.push({ time: t / sr, midi, velocity: v.velocity, layer: this.name });
  }
}
