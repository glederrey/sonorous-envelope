import type { FilterType } from "./types";

/** RBJ cookbook biquad, transposed direct form II. */
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private z1 = 0; private z2 = 0;

  set(type: FilterType, cutoff: number, q: number, sampleRate: number) {
    const f = Math.min(Math.max(cutoff, 20), 0.45 * sampleRate);
    const w0 = (2 * Math.PI * f) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(q, 0.1));
    let b0: number, b1: number, b2: number;
    if (type === "lowpass") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    else if (type === "highpass") { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}
