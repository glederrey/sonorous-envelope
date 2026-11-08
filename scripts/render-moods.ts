// Renders reference moods to WAV so the engine can be heard before the player exists.
// Usage: pnpm render:moods <output-dir> [seconds]
import { mkdirSync, writeFileSync } from "node:fs";
import { renderOffline } from "@sonorous/engine";
import { ListenerSettings, applyLimits, moodToEngineState, nextSlowMood, type Mood } from "@sonorous/shared";

const dir = process.argv[2];
const seconds = Number(process.argv[3] ?? 14);
if (!dir) { console.error("usage: render-moods <output-dir> [seconds]"); process.exit(1); }
mkdirSync(dir, { recursive: true });

const neutral: Mood = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.8, spontaneity: 0.2 };
const m = (o: Partial<Mood>): Mood => ({ ...neutral, ...o });
const moods: Record<string, Mood> = {
  "1-neutral": neutral,
  "2-tender-warm": m({ warmth: 0.9, closeness: 0.9, joy: 0.7, calm: 0.9 }),
  "3-cold-distant": m({ warmth: 0.1, closeness: 0.1, joy: 0.4, calm: 0.5 }),
  "4-joyful": m({ joy: 0.95, calm: 0.2, spontaneity: 0.9, warmth: 0.7 }),
  "5-sad": m({ joy: 0.1, calm: 0.9, warmth: 0.3 }),
  "6-fear": m({ joy: 0.2, calm: 0.1, warmth: 0.5, spontaneity: 0.6 }),
  "7-anger": m({ joy: 0.05, calm: 0.05, warmth: 0.05, spontaneity: 0.5 }),
};

function wav(left: Float32Array, right: Float32Array, sr: number): Buffer {
  const n = left.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  return buf;
}

const SR = 44100;
for (const consent of ["ambient", "anything"] as const) {
  const settings = ListenerSettings.parse({ consent, max_harshness: consent === "anything" ? 1 : 0.5, max_volume: 0.8 });
  for (const [name, mood] of Object.entries(moods)) {
    const slow = nextSlowMood(null, mood, true);
    const { effective, clamps } = applyLimits({ mapped: moodToEngineState(mood, slow), mood, settings });
    const { left, right, events } = renderOffline(effective, { seconds, sampleRate: SR, seed: 42 });
    writeFileSync(`${dir}/${name}.${consent}.wav`, wav(left, right, SR));
    let peak = 0; for (const v of left) peak = Math.max(peak, Math.abs(v));
    console.log(`${name}.${consent}: ${effective.arp.scale} ${Math.round(effective.arp.tempo)}bpm ${effective.arp.rate} notes=${events.length} peak=${peak.toFixed(2)} clamps=${clamps.length}`);
  }
}
