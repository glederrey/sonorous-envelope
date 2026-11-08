import type { LfoShape } from "./types";

export class Lfo {
  phase = 0; private held = 0; value = 0;
  constructor(private rand: () => number) { this.held = rand() * 2 - 1; }
  /** Advance by one sample, return a value in [-1, 1]. */
  next(shape: LfoShape, rate: number, sr: number): number {
    this.phase += rate / sr;
    if (this.phase >= 1) { this.phase -= 1; this.held = this.rand() * 2 - 1; }
    const p = this.phase;
    switch (shape) {
      case "sine": this.value = Math.sin(2 * Math.PI * p); break;
      case "triangle": this.value = 4 * Math.abs(p - 0.5) - 1; break;
      case "square": this.value = p < 0.5 ? 1 : -1; break;
      case "random": this.value = this.held; break;
    }
    return this.value;
  }
}
