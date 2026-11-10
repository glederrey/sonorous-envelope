// Prints the measured loudness of each landing sample step, so the five can be levelled. Usage: pnpm samples:loudness
import { measure } from "@sonorous/shared";
import { SAMPLES, stateOfStep } from "../apps/web/lib/samples";

for (const s of SAMPLES) {
  for (const step of s.steps) {
    const f = measure(stateOfStep(step, s.id), s.seed);
    console.log(`${s.id.padEnd(10)} t=${String(step.at).padStart(2)} loudness ${f.loudnessDb.toFixed(1)} dB`);
  }
}
