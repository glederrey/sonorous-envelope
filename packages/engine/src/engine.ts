import { Biquad } from "./filter";
import { PingPongDelay, Reverb } from "./fx";
import { Layer, type LayerParams } from "./layer";
import { Lfo } from "./lfo";
import { midiToHz } from "./music";
import { oscSample } from "./oscillator";
import { mulberry32 } from "./prng";
import type { EngineState, NoteEvent, Rate, Wave } from "./types";

const BLOCK = 32;
const RATE_BEATS: Record<Rate, number> = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 };

/** The continuous parameters that glide between states. */
interface P {
  tempo: number; cutoff: number; resonance: number; volume: number;
  droneLevel: number; bassLevel: number;
  delayTime: number; delayFb: number; delayMix: number; revSize: number; revMix: number;
  width: number; detune: number; drive: number;
  lfo0Rate: number; lfo0Depth: number; lfo1Rate: number; lfo1Depth: number;
  gate: number; swing: number; density: number; jitterMs: number;
  attack: number; decay: number; sustain: number; release: number;
  bassStep: number;
}
const KEYS = [
  "tempo", "cutoff", "resonance", "volume", "droneLevel", "bassLevel", "delayTime", "delayFb", "delayMix",
  "revSize", "revMix", "width", "detune", "drive", "lfo0Rate", "lfo0Depth", "lfo1Rate", "lfo1Depth",
  "gate", "swing", "density", "jitterMs", "attack", "decay", "sustain", "release", "bassStep",
] as const satisfies readonly (keyof P)[];

function target(s: EngineState): P {
  return {
    tempo: s.arp.tempo, cutoff: s.filter.cutoff, resonance: s.filter.resonance, volume: s.volume,
    droneLevel: s.drone.on ? s.drone.level : 0, bassLevel: s.bass.on ? s.bass.level : 0,
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
  private listenerGain = 1; private listenerGainCur = 1;
  private listenerDelay = 0.5; private delayCap = 0.6;
  private hpZ = 0;
  private tmp: [number, number] = [0, 0];
  private tmp2: [number, number] = [0, 0];

  constructor(private sampleRate: number, seed: number) {
    this.lfos = [new Lfo(mulberry32(seed ^ 0x1f)), new Lfo(mulberry32(seed ^ 0x2f))];
    this.arp = new Layer(sampleRate, mulberry32(seed ^ 0xa1), "arp", null);
    this.bass = new Layer(sampleRate, mulberry32(seed ^ 0xb2), "bass", null);
    this.delay = new PingPongDelay(sampleRate);
    this.reverb = new Reverb(sampleRate);
  }

  /** Start recording note events (for offline analysis). */
  recordEvents(into: NoteEvent[]) { this.events = into; this.arp.setEvents(into); this.bass.setEvents(into); }

  setListenerGain(gain: number) { this.listenerGain = Math.min(1, Math.max(0, gain)); }
  /** Local echo control 0..1 (0.5 = as mapped). Scales the delay mix, capped at `maxMix`. */
  setListenerDelay(amount: number, maxMix = 0.6) {
    this.listenerDelay = Math.min(1, Math.max(0, amount));
    this.delayCap = maxMix;
  }

  /** Snapshot of the currently gliding continuous parameters (for tests and debugging). */
  params(): Readonly<P> { return this.cur; }

  setState(state: EngineState, seed: number) {
    const to = target(state);
    const first = this.state === null;
    this.state = state;
    this.arp.reseed(mulberry32(seed ^ 0xa1)); this.bass.reseed(mulberry32(seed ^ 0xb2));
    if (first) { this.cur = { ...to }; this.from = { ...to }; this.glideT = 1; }
    else {
      this.from = { ...this.cur };
      this.glideDur = state.transition.curve === "sudden" ? 0.03 : Math.max(0.03, state.transition.time);
      this.glideT = 0;
    }
    this.to = to;
    // drone: fade changed notes in and out over 3 s
    const want = new Map<number, Wave>();
    if (state.drone.on) for (const n of state.drone.notes) want.set(n, state.drone.wave);
    for (const d of this.drones) { d.goal = want.has(d.midi) ? 1 : 0; if (want.has(d.midi)) d.wave = want.get(d.midi)!; want.delete(d.midi); }
    for (const [midi, wave] of want) this.drones.push({ midi, gain: first ? 1 : 0, goal: 1, ph: [0, 0], wave });
  }

  private layerParams(): { arp: LayerParams; bass: LayerParams } {
    const s = this.state!, c = this.cur;
    const beat = 60 / Math.max(20, c.tempo);
    return {
      arp: {
        on: s.arp.on, root: s.arp.root, scale: s.arp.scale, chord: s.arp.chord, octaves: s.arp.octaves,
        pattern: s.arp.pattern, stepSeconds: beat * RATE_BEATS[s.arp.rate], gate: c.gate, swing: c.swing,
        density: c.density, jitterMs: c.jitterMs, wave: s.osc.wave, voices: s.osc.voices, detune: c.detune,
        attack: c.attack, decay: c.decay, sustain: c.sustain, release: c.release, level: 1,
      },
      bass: {
        on: s.bass.on, root: s.bass.root, scale: s.bass.scale, chord: s.bass.chord, octaves: 1,
        pattern: "up_down", stepSeconds: Math.max(0.2, c.bassStep), gate: 1, swing: 0, density: 1, jitterMs: 0,
        wave: s.bass.wave, voices: 1, detune: 0, attack: 0.1, decay: 0.3, sustain: 0.8, release: 0.8,
        level: c.bassLevel,
      },
    };
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
    let lp = this.layerParams();
    this.arp.configure(lp.arp); this.bass.configure(lp.bass);
    for (let i = 0; i < frames; i++) {
      if (i % BLOCK === 0) {
        this.glide(BLOCK / sr);
        lp = this.layerParams();
        this.arp.configure(lp.arp); this.bass.configure(lp.bass);
        this.filter.set(s.filter.type, this.cur.cutoff, this.cur.resonance, sr);
      }
      const c = this.cur;
      // LFOs
      let cutMod = 0, pitchCents = 0, amp = 1, pan = 0;
      const lfoRaw = [
        l0 ? this.lfos[0].next(l0.shape, c.lfo0Rate, sr) : 0,
        l1 ? this.lfos[1].next(l1.shape, c.lfo1Rate, sr) : 0,
      ];
      [l0, l1].forEach((l, k) => {
        if (!l) return;
        const depth = k === 0 ? c.lfo0Depth : c.lfo1Depth;
        if (l.target === "cutoff") cutMod += lfoRaw[k] * depth * 2;
        else if (l.target === "pitch") pitchCents += lfoRaw[k] * depth * 50;
        else if (l.target === "amp") amp *= 1 - depth * (0.5 + 0.5 * lfoRaw[k]);
        else pan += lfoRaw[k] * depth;
      });
      const pitchMul = pitchCents === 0 ? 1 : Math.pow(2, pitchCents / 1200);
      if (cutMod !== 0 && i % 8 === 0) this.filter.set(s.filter.type, c.cutoff * Math.pow(2, cutMod), c.resonance, sr);

      let x = this.arp.process(this.t, pitchMul) + this.bass.process(this.t, 1) * lp.bass.level;
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
      // roughness: soft saturation before the filter
      if (c.drive > 0.001) { const g = 1 + 4 * c.drive; x = Math.tanh(x * g) / Math.tanh(g) ; }
      x = this.filter.process(x) * amp;

      // echo and reverb
      const dMix = Math.min(c.delayMix * 2 * this.listenerDelay, this.delayCap);
      this.delay.process(x, c.delayTime, Math.min(c.delayFb, 0.6), this.tmp);
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
