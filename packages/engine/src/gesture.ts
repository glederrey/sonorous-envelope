import { Biquad } from "./filter";
import { midiToHz } from "./music";
import { oscSample } from "./oscillator";
import type { GestureType } from "./types";

// Gestures (roadmap step 6): short synthesised sounds with their own envelope, played once over the background. One voice,
// so a new gesture replaces one still sounding. The recipes are in docs/implementation/engine.md. Everything random comes
// from the engine's seeded generator, so a state renders the same everywhere.

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

/** Length in seconds of each gesture at the given intensity. All under 2.5 s. */
export function gestureLength(type: GestureType, intensity: number): number {
  switch (type) {
    case "purr": return lerp(0.8, 1.6, intensity);
    case "meow_up": return 0.7; case "meow_down": return 0.8;
    case "chirp": return 0.5; case "laugh": return 1.3;
    case "growl": return lerp(0.8, 1.5, intensity);
    case "sigh": return 1.6; case "hum": return lerp(1, 1.5, intensity);
    case "pluck": return 1.1; case "breath": return 1.6;
  }
}

/** Per-gesture trim so that every gesture peaks below -3 dBFS at full intensity (test). */
const TRIM: Record<GestureType, number> = { purr: 0.8, meow_up: 0.6, meow_down: 0.6, chirp: 0.75, laugh: 0.9, growl: 0.4, sigh: 0.55, hum: 0.9, pluck: 0.8, breath: 0.4 };

export class GestureVoice {
  private type: GestureType | null = null;
  private t = 0; private len = 0; private level = 0; private root = 50;
  private ph = [0, 0, 0]; private rate = 25; private wobble = 0;
  private lp1 = new Biquad(); private lp2 = new Biquad(); private bp = new Biquad();
  private ks = new Float32Array(2048); private ksLen = 0; private ksPos = 0; private ksLp = 0;
  private blips = 0; private bursts = 0;
  private noiseLp = 0;
  private nextFilter = 0;

  constructor(private sr: number, private rand: () => number) {}

  get active() { return this.type !== null; }
  reseed(rand: () => number) { this.rand = rand; }

  /** Start a gesture. `elapsed` seconds in (a device that heard the state late); past the end nothing plays. */
  trigger(type: GestureType, intensity: number, rootMidi: number, elapsed = 0) {
    const len = gestureLength(type, intensity);
    if (elapsed >= len) { this.type = null; return; }
    this.type = type; this.len = len; this.t = Math.max(0, elapsed);
    this.level = 0.15 + 0.65 * Math.min(1, Math.max(0, intensity));
    this.root = rootMidi; this.ph = [this.rand(), this.rand(), this.rand()];
    this.rate = lerp(22, 28, this.rand()); this.wobble = 0; this.noiseLp = 0; this.nextFilter = 0;
    this.blips = type === "chirp" ? 2 + Math.floor(this.rand() * 2) : 0;
    this.bursts = type === "laugh" ? 4 + Math.floor(this.rand() * 5) : 0;
    this.lp1.set("lowpass", type === "purr" ? 300 : 700, 0.7, this.sr);
    this.lp2.set("lowpass", type === "purr" ? 300 : 700, 0.7, this.sr);
    if (type === "pluck") {
      const f = midiToHz(rootMidi + 24); this.ksLen = Math.max(2, Math.min(this.ks.length - 1, Math.round(this.sr / f)));
      for (let i = 0; i < this.ksLen; i++) this.ks[i] = this.rand() * 2 - 1;
      this.ksPos = 0; this.ksLp = 0;
    }
  }

  stop() { this.type = null; }

  /** One mono sample, before the master. */
  process(): number {
    const type = this.type;
    if (!type) return 0;
    const dt = 1 / this.sr, t = this.t, len = this.len, u = t / len, root = this.root;
    let y = 0;
    switch (type) {
      case "purr": {
        // a sine two octaves below the root, pulsed at 22 to 28 Hz, and low noise under it: nothing tonal above about 250 Hz,
        // so no cry can hide in it (test)
        const f = midiToHz(root - 24), env = Math.min(ramp(t, 0, 0.15), 1 - ramp(t, len - 0.3, len));
        this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
        this.ph[1] += this.rate * dt; if (this.ph[1] >= 1) this.ph[1] -= 1;
        const pulse = 0.5 * (1 + Math.sin(TAU * this.ph[1]));
        const n = this.lp2.process(this.lp1.process(this.rand() * 2 - 1));
        y = env * (Math.sin(TAU * this.ph[0]) * pulse * 0.9 + n * pulse * 0.5);
        break;
      }
      case "meow_up":
      case "meow_down": {
        const from = type === "meow_up" ? 12 : 19, to = type === "meow_up" ? 19 : 9, g = ramp(t, 0, type === "meow_up" ? 0.5 : 0.6);
        const f = midiToHz(root + lerp(from, to, g)) * (1 + 0.012 * Math.sin(TAU * 6 * t));
        this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
        if (t >= this.nextFilter) { this.bp.set("bandpass", lerp(900, 1600, g), 2.5, this.sr); this.nextFilter = t + 0.01; }
        let s = oscSample("sawtooth", this.ph[0], f * dt);
        s = this.bp.process(s) * 2.2 + this.lp1.process(s) * 0.25;
        if (type === "meow_down") s = Math.tanh(s * 1.4) / 1.2;
        y = s * Math.min(ramp(t, 0, 0.06), 1 - ramp(t, len - 0.15, len));
        break;
      }
      case "chirp": {
        const n = this.blips, slot = 0.1, k = Math.min(n - 1, Math.floor(t / slot)), local = t - k * slot;
        if (local < 0.06) {
          const semis = [12, 19, 24][k] + 1.5 * (local / 0.06);
          const f = midiToHz(root + semis);
          this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
          y = Math.sin(TAU * this.ph[0]) * Math.min(ramp(local, 0, 0.005), 1 - ramp(local, 0.04, 0.06));
        } else if (t >= n * slot) { this.type = null; return 0; }
        break;
      }
      case "laugh": {
        const slot = 0.12, k = Math.floor(t / slot), local = t - k * slot;
        if (k >= this.bursts) { this.type = null; return 0; }
        if (local < 0.08) {
          const f = midiToHz(root + 12 + k);
          this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
          y = oscSample("triangle", this.ph[0], f * dt) * Math.exp(-local * 35) * Math.pow(0.85, k) * Math.min(1, local / 0.004);
        }
        break;
      }
      case "growl": {
        this.wobble += (this.rand() - 0.5) * 0.002; this.wobble = Math.max(-0.2, Math.min(0.2, this.wobble));
        const f = midiToHz(root - 24);
        this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
        this.ph[1] += 40 * (1 + this.wobble) * dt; if (this.ph[1] >= 1) this.ph[1] -= 1;
        let s = Math.tanh(oscSample("sawtooth", this.ph[0], f * dt) * 2.2);
        s = this.lp2.process(this.lp1.process(s)) * (0.5 + 0.5 * Math.sin(TAU * this.ph[1]));
        y = s * 1.6 * Math.min(ramp(t, 0, 0.2), 1 - ramp(t, len - 0.3, len));
        break;
      }
      case "sigh": {
        if (t >= this.nextFilter) { this.bp.set("bandpass", lerp(1800, 400, u), 1.2, this.sr); this.nextFilter = t + 0.01; }
        y = this.bp.process(this.rand() * 2 - 1) * 2 * Math.min(ramp(t, 0, 0.3), 1 - ramp(t, 0.5, len));
        break;
      }
      case "hum": {
        const f = midiToHz(root + 7) * (1 + 0.006 * Math.sin(TAU * 5 * t));
        this.ph[0] += f * dt; if (this.ph[0] >= 1) this.ph[0] -= 1;
        y = oscSample("triangle", this.ph[0], f * dt) * 0.8 * Math.min(ramp(t, 0, 0.25), 1 - ramp(t, len - 0.4, len));
        break;
      }
      case "pluck": {
        const out = this.ks[this.ksPos], next = this.ks[(this.ksPos + 1) % this.ksLen];
        this.ksLp = 0.5 * (out + next) * 0.996;
        this.ks[this.ksPos] = this.ksLp; this.ksPos = (this.ksPos + 1) % this.ksLen;
        y = out * 0.9 * (1 - ramp(t, len - 0.15, len));
        break;
      }
      case "breath": {
        this.noiseLp += 0.08 * ((this.rand() * 2 - 1) - this.noiseLp);
        const env = t < 0.6 ? ramp(t, 0, 0.6) : 1 - ramp(t, 0.6, 1.4);
        y = this.noiseLp * 4 * env * env;
        break;
      }
    }
    this.t += dt;
    if (this.t >= this.len) this.type = null;
    return y * this.level * TRIM[type];
  }
}
