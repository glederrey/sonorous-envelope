import type { Wave } from "./types";

function polyBlep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

/** One sample of a band-limited oscillator. `phase` in [0,1), `dt` = frequency / sampleRate. */
export function oscSample(wave: Wave, phase: number, dt: number): number {
  switch (wave) {
    case "sine": return Math.sin(6.283185307179586 * phase);
    case "triangle": return 4 * Math.abs(((phase + 0.75) % 1) - 0.5) - 1;
    case "sawtooth": return 2 * phase - 1 - polyBlep(phase, dt);
    case "square": return (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep((phase + 0.5) % 1, dt);
  }
}
