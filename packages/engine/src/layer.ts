import { buildCycle, midiToHz } from "./music";
import { oscSample } from "./oscillator";
import type { NoteEvent, Pattern, ScaleName, Wave } from "./types";

const MAX_VOICES = 6;
const MAX_PENDING = 8;

export interface LayerParams {
  on: boolean;
  root: number; scale: ScaleName; chord: number[]; octaves: number; pattern: Pattern;
  stepSeconds: number; gate: number; swing: number; density: number; jitterMs: number;
  wave: Wave; voices: number; detune: number;
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
  private idx = 0; private step = 0;
  private nextStep = 0;
  private p!: LayerParams;

  constructor(private sr: number, private rand: () => number, private name: "arp" | "bass",
              private events: NoteEvent[] | null) {}

  reseed(rand: () => number) { this.rand = rand; }
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
    if (this.idx >= this.cycle.length) this.idx = 0;
  }

  /** One sample of the layer (mono, before level). `t` = sample counter, `pitchMul` = vibrato multiplier. */
  process(t: number, pitchMul: number): number {
    const p = this.p;
    if (p.on && t >= this.nextStep) this.runStep(t);
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

  private runStep(t: number) {
    const p = this.p, sr = this.sr;
    const stepS = p.stepSeconds * sr;
    const i = this.step++;
    this.nextStep = t + stepS;
    if (this.rand() > p.density) return;
    let midi: number;
    if (p.pattern === "random") midi = this.cycle[Math.floor(this.rand() * this.cycle.length)];
    else { midi = this.cycle[this.idx % this.cycle.length]; this.idx = (this.idx + 1) % this.cycle.length; }
    let delay = (i % 2 === 1 ? p.swing * 0.33 * stepS : 0);
    if (p.jitterMs > 0) delay += (p.jitterMs / 1000) * sr * (1 + (this.rand() * 2 - 1));
    if (this.pendCount < MAX_PENDING) {
      this.pendAt[this.pendCount] = t + delay;
      this.pendMidi[this.pendCount] = midi;
      this.pendLen[this.pendCount] = Math.max(1, p.gate * stepS);
      this.pendCount++;
    }
  }

  private trigger(midi: number, lenSamples: number, t: number) {
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
    v.wave = p.wave; v.velocity = 0.8; v.stage = 0; v.env = 0; v.age = t;
    v.atk = 1 / Math.max(1, p.attack * sr);
    v.sus = Math.min(1, Math.max(0, p.sustain));
    v.decC = Math.exp(-1 / Math.max(1, (p.decay / 5) * sr));
    v.relC = Math.exp(-1 / Math.max(1, (p.release / 5) * sr));
    v.held = Math.max(1, Math.round(lenSamples));
    this.events?.push({ time: t / sr, midi, velocity: v.velocity, layer: this.name });
  }
}
