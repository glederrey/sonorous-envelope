import { Biquad } from "./filter";
import { PingPongDelay, Reverb } from "./fx";
import { GestureVoice } from "./gesture";
import { Layer, type LayerParams } from "./layer";
import { Lfo } from "./lfo";
import { midiToHz } from "./music";
import { oscSample } from "./oscillator";
import { mulberry32 } from "./prng";
import { arpRamp, constantRamp, RATE_BEATS, type Ramp } from "./ramp";
import type { EngineState, NoteEvent, Wave } from "./types";

const BLOCK = 32;

/** The continuous parameters that glide between states. */
interface P {
  tempo: number; cutoff: number; resonance: number; volume: number;
  droneLevel: number; bassLevel: number; padLevel: number;
  delayTime: number; delayFb: number; delayMix: number; revSize: number; revMix: number;
  width: number; detune: number; drive: number;
  lfo0Rate: number; lfo0Depth: number; lfo1Rate: number; lfo1Depth: number;
  gate: number; swing: number; density: number; jitterMs: number;
  attack: number; decay: number; sustain: number; release: number;
  bassStep: number;
}
const KEYS = [
  "tempo", "cutoff", "resonance", "volume", "droneLevel", "bassLevel", "padLevel", "delayTime", "delayFb", "delayMix",
  "revSize", "revMix", "width", "detune", "drive", "lfo0Rate", "lfo0Depth", "lfo1Rate", "lfo1Depth",
  "gate", "swing", "density", "jitterMs", "attack", "decay", "sustain", "release", "bassStep",
] as const satisfies readonly (keyof P)[];

function target(s: EngineState): P {
  return {
    tempo: s.arp.tempo, cutoff: s.filter.cutoff, resonance: s.filter.resonance, volume: s.volume,
    droneLevel: s.drone.on ? s.drone.level : 0, bassLevel: s.bass.on ? s.bass.level : 0, padLevel: s.pad.on ? s.pad.level : 0,
    delayTime: s.fx.delay.time, delayFb: s.fx.delay.feedback, delayMix: s.fx.delay.mix,
    revSize: s.fx.reverb.size, revMix: s.fx.reverb.mix, width: s.pan.width,
    detune: s.osc.detune, drive: s.osc.drive,
    lfo0Rate: s.lfo[0]?.rate ?? 0, lfo0Depth: s.lfo[0]?.depth ?? 0,
    lfo1Rate: s.lfo[1]?.rate ?? 0, lfo1Depth: s.lfo[1]?.depth ?? 0,
    gate: s.arp.gate, swing: s.arp.swing, density: s.arp.density, jitterMs: s.arp.jitterMs,
    attack: s.env.attack, decay: s.env.decay, sustain: s.env.sustain, release: s.env.release,
    bassStep: s.bass.stepSeconds,
  };
}

function emptyLayerParams(): LayerParams {
  return { on: false, root: 60, scale: "major", chord: [1], octaves: 1, pattern: "up", stepSeconds: 1, gate: 1, swing: 0,
    density: 1, jitterMs: 0, wave: "sine", voices: 1, detune: 0, stack: [], attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1, level: 1 };
}

interface DroneOsc { midi: number; gain: number; goal: number; ph: [number, number]; wave: Wave }

export class Engine {
  private state: EngineState | null = null;
  private cur!: P; private from!: P; private to!: P;
  private glideT = 1; private glideDur = 1; // seconds
  private t = 0; // samples rendered
  private arp: Layer; private bass: Layer;
  private events: NoteEvent[] | null = null;
  private lfos: Lfo[];
  private filter = new Biquad();
  private delay: PingPongDelay; private reverb: Reverb;
  private drones: DroneOsc[] = [];
  private pads: DroneOsc[] = []; private padAtk = 2; private padRel = 3; private padNorm = 0.3;
  private gesture: GestureVoice; private lastGestureId: string | null = null; private gesturesOn = true;
  private listenerGain = 1; private listenerGainCur = 1;
  private hpZ = 0;
  private tmp: [number, number] = [0, 0];
  private tmp2: [number, number] = [0, 0];

  constructor(private sampleRate: number, seed: number) {
    this.lfos = [new Lfo(mulberry32(seed ^ 0x1f)), new Lfo(mulberry32(seed ^ 0x2f))];
    this.arp = new Layer(sampleRate, mulberry32(seed ^ 0xa1), "arp", null);
    this.bass = new Layer(sampleRate, mulberry32(seed ^ 0xb2), "bass", null);
    this.gesture = new GestureVoice(sampleRate, mulberry32(seed ^ 0x6e57));
    this.delay = new PingPongDelay(sampleRate);
    this.reverb = new Reverb(sampleRate);
    this.setGridSeed(seed);
  }

  /** Start recording note events (for offline analysis). */
  recordEvents(into: NoteEvent[]) { this.events = into; this.arp.setEvents(into); this.bass.setEvents(into); }

  /** The listener's switch for gestures (this device only). */
  setGesturesEnabled(on: boolean) { this.gesturesOn = on; if (!on) this.gesture.stop(); }

  /** Local volume. 1 is the sound as mapped; up to 8 (+18 dB) boosts it, and the soft limiter below keeps it from clipping. */
  setListenerGain(gain: number) { this.listenerGain = Math.min(8, Math.max(0, gain)); }

  /** Snapshot of the currently gliding continuous parameters (for tests and debugging). */
  params(): Readonly<P> { return this.cur; }

  /** Play `incoming` now, or after `delaySec` seconds (a closing fade that waits for the sound before it to play out).
   *  A newer state replaces one that is still waiting. */
  setState(incoming: EngineState, seed: number, delaySec = 0, elapsedSec?: number) {
    if (delaySec > 0 && this.state !== null) { this.pending = { state: incoming, seed, at: this.t + Math.round(delaySec * this.sampleRate), elapsed: elapsedSec }; return; }
    this.pending = null;
    this.applyState(incoming, seed, elapsedSec);
  }
  private pending: { state: EngineState; seed: number; at: number; elapsed: number | undefined } | null = null;

  /** Sessions share one seed for the choices of each arpeggio step, so every device plays the same notes (roadmap #34). */
  setGridSeed(seed: number) { this.arp.setGridSeed(seed); this.bass.setGridSeed(seed); }

  /** The step length of each layer for a state, in seconds. Follows the state's own tempo, with no glide, so that every
   *  device lands on the same grid. */
  private rampsOf(s: EngineState): { arp: Ramp; bass: Ramp } {
    return { arp: arpRamp(s), bass: constantRamp(Math.max(0.2, s.bass.stepSeconds)) };
  }

  /** Re-align the step grids to the shared timeline: `elapsedSec` is the time since the current state was written, by the
   *  server's clock. Called now and then by the player; only moves the grid when it has drifted. */
  syncGrid(elapsedSec: number) {
    const s = this.state;
    if (!s || this.pending) return; // a delayed state is waiting: the sound that plays now keeps its own grid
    const g = s.grid ?? { arp: 0, bass: 0 }, d = this.rampsOf(s);
    this.arp.sync(this.t, g.arp, elapsedSec, d.arp, 0.04); this.bass.sync(this.t, g.bass, elapsedSec, d.bass, 0.04);
  }

  private applyState(incoming: EngineState, seed: number, elapsedSec?: number) {
    // states stored before the stack and the pad existed lack those keys: fill them in, once, outside the audio loop
    const state: EngineState = {
      ...incoming,
      osc: { ...incoming.osc, stack: incoming.osc.stack ?? [] },
      pad: incoming.pad ?? { on: false, notes: [], wave: "sine", level: 0, attack: 2, release: 3 },
    };
    const to = target(state);
    const first = this.state === null;
    // a gesture plays once, when its state starts, on every device; one that is heard late (or again) does not replay
    const gid = state.gesture?.id ?? null;
    if (gid !== null && gid !== this.lastGestureId) {
      this.lastGestureId = gid;
      this.gesture.reseed(mulberry32(seed ^ 0x6e57));
      if (this.gesturesOn) this.gesture.trigger(state.gesture!.type, state.gesture!.intensity, state.arp.root, elapsedSec ?? 0);
    } else if (gid === null) this.lastGestureId = null;
    this.state = state;
    this.arp.reseed(mulberry32(seed ^ 0xa1)); this.bass.reseed(mulberry32(seed ^ 0xb2));
    if (first) { this.cur = { ...to }; this.from = { ...to }; this.glideT = 1; }
    else {
      this.from = { ...this.cur };
      this.glideDur = state.transition.curve === "sudden" ? 0.03 : Math.max(0.03, state.transition.time);
      this.glideT = 0;
    }
    this.to = to;
    const d0 = this.rampsOf(state);
    // the shared timeline: on the first state, and whenever the caller says how long ago the state was written, put the
    // step grids where the server's clock says they are; otherwise the grids just run on
    if (first || elapsedSec !== undefined || d0.arp.dur > 0) {
      const g = state.grid ?? { arp: 0, bass: 0 }, d = this.rampsOf(state);
      this.arp.align(this.t, g.arp, elapsedSec ?? 0, d.arp); this.bass.align(this.t, g.bass, elapsedSec ?? 0, d.bass);
    } else { this.arp.clearGlide(); this.bass.clearGlide(); } // the grids just run on at the new state's step length
    // drone: fade changed notes in and out over 3 s
    const want = new Map<number, Wave>();
    if (state.drone.on) for (const n of state.drone.notes) want.set(n, state.drone.wave);
    for (const d of this.drones) { d.goal = want.has(d.midi) ? 1 : 0; if (want.has(d.midi)) d.wave = want.get(d.midi)!; want.delete(d.midi); }
    for (const [midi, wave] of want) this.drones.push({ midi, gain: first ? 1 : 0, goal: 1, ph: [0, 0], wave });
    // pad: a chord of its own, each note fades in with the pad's attack and out with its release
    const wantPad = new Map<number, Wave>();
    if (state.pad.on) for (const n of state.pad.notes.slice(0, 5)) wantPad.set(n, state.pad.wave);
    this.padAtk = Math.max(0.05, state.pad.attack); this.padRel = Math.max(0.05, state.pad.release);
    for (const d of this.pads) { d.goal = wantPad.has(d.midi) ? 1 : 0; if (wantPad.has(d.midi)) d.wave = wantPad.get(d.midi)!; wantPad.delete(d.midi); }
    for (const [midi, wave] of wantPad) this.pads.push({ midi, gain: first ? 1 : 0, goal: 1, ph: [0, 0], wave });
  }

  private arpP: LayerParams = emptyLayerParams();
  private bassP: LayerParams = emptyLayerParams();

  /** Fills the two cached layer parameter objects in place (no allocation in the audio loop). */
  private fillLayerParams() {
    const s = this.state!, c = this.cur, a = this.arpP, b = this.bassP;
    const to = this.to; // the grid follows the state's own values, not the glide, so every device has the same one
    const beat = 60 / Math.max(20, to.tempo);
    a.on = s.arp.on; a.root = s.arp.root; a.scale = s.arp.scale; a.chord = s.arp.chord; a.octaves = s.arp.octaves;
    a.stack = s.osc.stack; b.stack = [];
    a.pattern = s.arp.pattern; a.stepSeconds = beat * RATE_BEATS[s.arp.rate]; a.gate = c.gate; a.swing = c.swing;
    a.density = to.density; a.jitterMs = to.jitterMs; a.wave = s.osc.wave; a.voices = s.osc.voices; a.detune = c.detune;
    a.attack = c.attack; a.decay = c.decay; a.sustain = c.sustain; a.release = c.release; a.level = 1;
    b.on = s.bass.on; b.root = s.bass.root; b.scale = s.bass.scale; b.chord = s.bass.chord; b.octaves = 1;
    b.pattern = "up_down"; b.stepSeconds = Math.max(0.2, to.bassStep); b.gate = 1; b.swing = 0; b.density = 1; b.jitterMs = 0;
    b.wave = s.bass.wave; b.voices = 1; b.detune = 0; b.attack = 0.1; b.decay = 0.3; b.sustain = 0.8; b.release = 0.8;
    b.level = c.bassLevel;
  }

  private glide(dtSec: number) {
    if (this.glideT >= 1) return;
    this.glideT = Math.min(1, this.glideT + dtSec / this.glideDur);
    const x = this.glideT, e = x * x * (3 - 2 * x);
    for (const k of KEYS) {
      this.cur[k] = k === "cutoff"
        ? Math.pow(2, Math.log2(this.from.cutoff) * (1 - e) + Math.log2(this.to.cutoff) * e)
        : this.from[k] + (this.to[k] - this.from[k]) * e;
    }
  }

  process(left: Float32Array, right: Float32Array, frames: number) {
    const s = this.state, sr = this.sampleRate;
    if (!s) { left.fill(0, 0, frames); right.fill(0, 0, frames); return; }
    const l0 = s.lfo[0], l1 = s.lfo[1];
    const hpA = Math.exp((-2 * Math.PI * 25) / sr);
    this.fillLayerParams();
    this.arp.configure(this.arpP); this.bass.configure(this.bassP);
    for (let i = 0; i < frames; i++) {
      if (i % BLOCK === 0) {
        if (this.pending && this.t >= this.pending.at) { const p = this.pending; this.pending = null; this.applyState(p.state, p.seed, p.elapsed); }
        this.glide(BLOCK / sr);
        // keep the pad level whatever the number of notes: normalise by the live sum of the note gains (they slew, so no jump)
        let padSum = 0; for (const pd of this.pads) padSum += pd.gain;
        this.padNorm = 0.3 / Math.sqrt(Math.max(1, padSum));
        this.fillLayerParams();
        this.arp.configure(this.arpP); this.bass.configure(this.bassP);
        this.filter.set(s.filter.type, this.cur.cutoff, this.cur.resonance, sr);
      }
      const c = this.cur;
      // LFOs
      let cutMod = 0, pitchCents = 0, amp = 1, pan = 0;
      const v0 = l0 ? this.lfos[0].next(l0.shape, c.lfo0Rate, sr) : 0;
      const v1 = l1 ? this.lfos[1].next(l1.shape, c.lfo1Rate, sr) : 0;
      for (let k = 0; k < 2; k++) {
        const l = k === 0 ? l0 : l1;
        if (!l) continue;
        const v = k === 0 ? v0 : v1, depth = k === 0 ? c.lfo0Depth : c.lfo1Depth;
        if (l.target === "cutoff") cutMod += v * depth * 2;
        else if (l.target === "pitch") pitchCents += v * depth * 50;
        else if (l.target === "amp") amp *= 1 - depth * (0.5 + 0.5 * v);
        else pan += v * depth;
      }
      const pitchMul = pitchCents === 0 ? 1 : Math.pow(2, pitchCents / 1200);
      if (cutMod !== 0 && i % 8 === 0) this.filter.set(s.filter.type, c.cutoff * Math.pow(2, cutMod), c.resonance, sr);

      let x = this.arp.process(this.t, pitchMul) + this.bass.process(this.t, 1) * this.bassP.level;
      // drone
      for (let d = this.drones.length - 1; d >= 0; d--) {
        const dr = this.drones[d];
        dr.gain += Math.sign(dr.goal - dr.gain) * Math.min(Math.abs(dr.goal - dr.gain), 1 / (3 * sr));
        if (dr.gain <= 0 && dr.goal === 0) { this.drones.splice(d, 1); continue; }
        const dt = midiToHz(dr.midi) / sr * pitchMul;
        x += (oscSample(dr.wave, dr.ph[0], dt) + oscSample(dr.wave, dr.ph[1], dt * 1.0012)) * 0.5 * dr.gain * c.droneLevel * 0.3;
        dr.ph[0] += dt; if (dr.ph[0] >= 1) dr.ph[0] -= 1;
        dr.ph[1] += dt * 1.0012; if (dr.ph[1] >= 1) dr.ph[1] -= 1;
      }
      // pad
      for (let d = this.pads.length - 1; d >= 0; d--) {
        const pd = this.pads[d];
        const rate = pd.goal > pd.gain ? 1 / (this.padAtk * sr) : 1 / (this.padRel * sr);
        pd.gain += Math.sign(pd.goal - pd.gain) * Math.min(Math.abs(pd.goal - pd.gain), rate);
        if (pd.gain <= 0 && pd.goal === 0) { this.pads.splice(d, 1); continue; }
        const dt = midiToHz(pd.midi) / sr * pitchMul;
        x += (oscSample(pd.wave, pd.ph[0], dt) + oscSample(pd.wave, pd.ph[1], dt * 1.0012)) * 0.5 * pd.gain * c.padLevel * this.padNorm;
        pd.ph[0] += dt; if (pd.ph[0] >= 1) pd.ph[0] -= 1;
        pd.ph[1] += dt * 1.0012; if (pd.ph[1] >= 1) pd.ph[1] -= 1;
      }
      // roughness: soft saturation before the filter
      if (c.drive > 0.001) { const g = 1 + 4 * c.drive; x = Math.tanh(x * g) / Math.tanh(g) ; }
      x = this.filter.process(x) * amp;
      if (this.gesture.active) x += this.gesture.process(); // after the filter, so it stays audible when the filter is dark

      // echo and reverb
      // the echo is Claude's: mix as sent. Feedback stays below 1 so the echo cannot run away (a stability limit).
      const dMix = c.delayMix;
      this.delay.process(x, c.delayTime, Math.min(c.delayFb, 0.85), this.tmp);
      const dryL = x * (1 - Math.max(0, pan) * 0.5);
      const dryR = x * (1 + Math.min(0, pan) * 0.5);
      const mixL = dryL + this.tmp[0] * dMix, mixR = dryR + this.tmp[1] * dMix;
      this.reverb.process((mixL + mixR) * 0.5, c.revSize, this.tmp2);
      let outL = mixL * (1 - 0.5 * c.revMix) + this.tmp2[0] * c.revMix * 3;
      let outR = mixR * (1 - 0.5 * c.revMix) + this.tmp2[1] * c.revMix * 3;
      // width (mid/side)
      const m = (outL + outR) * 0.5, sd = (outL - outR) * 0.5 * c.width;
      outL = m + sd; outR = m - sd;
      // master: volume, 25 Hz high-pass, soft limiter, listener gain
      this.listenerGainCur += (this.listenerGain - this.listenerGainCur) * (1 - Math.exp(-1 / (0.02 * sr)));
      const g = Math.min(c.volume, 0.9) * this.listenerGainCur;
      // sub high-pass at 25 Hz, applied to the mono component (subtract its low-passed copy)
      this.hpZ = hpA * this.hpZ + (1 - hpA) * ((outL + outR) * 0.5);
      outL = Math.tanh((outL - this.hpZ) * g); outR = Math.tanh((outR - this.hpZ) * g);
      left[i] = Math.max(-0.98, Math.min(0.98, outL));
      right[i] = Math.max(-0.98, Math.min(0.98, outR));
      this.t++;
    }
  }
}
