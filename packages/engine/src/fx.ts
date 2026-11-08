/** Stereo ping-pong delay. Feedback is low-passed at 4 kHz. Max time 1.5 s. */
export class PingPongDelay {
  private l: Float32Array; private r: Float32Array;
  private w = 0; private lpL = 0; private lpR = 0; private time: number;
  private readonly lpCoef: number;
  constructor(private sr: number) {
    const n = Math.ceil(1.5 * sr) + 4;
    this.l = new Float32Array(n); this.r = new Float32Array(n);
    this.time = 0.3 * sr;
    this.lpCoef = 1 - Math.exp((-2 * Math.PI * 4000) / sr);
  }
  /** Returns the wet signal (not mixed with the input). `timeSec` is smoothed here to avoid pitch jumps. */
  process(x: number, timeSec: number, feedback: number, out: [number, number]) {
    const target = Math.min(Math.max(timeSec, 0.01), 1.5) * this.sr;
    this.time += (target - this.time) * 0.0005;
    const n = this.l.length;
    let rp = this.w - this.time; if (rp < 0) rp += n;
    const i = Math.floor(rp), f = rp - i, j = (i + 1) % n;
    const yl = this.l[i] * (1 - f) + this.l[j] * f;
    const yr = this.r[i] * (1 - f) + this.r[j] * f;
    this.lpL += (yl - this.lpL) * this.lpCoef;
    this.lpR += (yr - this.lpR) * this.lpCoef;
    this.l[this.w] = x + feedback * this.lpR;
    this.r[this.w] = feedback * this.lpL;
    this.w = (this.w + 1) % n;
    out[0] = yl; out[1] = yr;
  }
}

class Comb {
  private buf: Float32Array; private i = 0; private store = 0;
  constructor(len: number) { this.buf = new Float32Array(len); }
  process(x: number, fb: number, damp: number): number {
    const y = this.buf[this.i];
    this.store = y * (1 - damp) + this.store * damp;
    this.buf[this.i] = x + this.store * fb;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}
class Allpass {
  private buf: Float32Array; private i = 0;
  constructor(len: number) { this.buf = new Float32Array(len); }
  process(x: number): number {
    const b = this.buf[this.i];
    const y = -x + b;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS = [556, 441, 341, 225];
const SPREAD = 23;

/** Freeverb-style reverb: 8 combs and 4 allpasses per channel. Mono in, stereo out. */
export class Reverb {
  private cl: Comb[]; private cr: Comb[]; private al: Allpass[]; private ar: Allpass[];
  constructor(sr: number) {
    const k = sr / 44100;
    const len = (n: number) => Math.max(8, Math.round(n * k));
    this.cl = COMBS.map((n) => new Comb(len(n)));
    this.cr = COMBS.map((n) => new Comb(len(n + SPREAD)));
    this.al = ALLPASS.map((n) => new Allpass(len(n)));
    this.ar = ALLPASS.map((n) => new Allpass(len(n + SPREAD)));
  }
  /** `size` 0..1 maps to room size 0.5..0.95. */
  process(x: number, size: number, out: [number, number]) {
    const fb = 0.5 + 0.45 * Math.min(Math.max(size, 0), 1);
    const inp = x * 0.015;
    let l = 0, r = 0;
    for (const c of this.cl) l += c.process(inp, fb, 0.4);
    for (const c of this.cr) r += c.process(inp, fb, 0.4);
    for (const a of this.al) l = a.process(l);
    for (const a of this.ar) r = a.process(r);
    out[0] = l; out[1] = r;
  }
}
