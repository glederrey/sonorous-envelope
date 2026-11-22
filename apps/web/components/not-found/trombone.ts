// The sad trombone of the 404: four falling notes, the last one long with a wobble. Quiet (peak gain 0.12), only on a press.
// QuietWaves reads the same score, so the picture swells with each note.
export const WOMP: { hz: number; at: number; len: number }[] = [
  { hz: 233.08, at: 0, len: 0.42 },    // B♭3
  { hz: 220.0, at: 0.48, len: 0.42 },  // A3
  { hz: 207.65, at: 0.96, len: 0.42 }, // A♭3
  { hz: 196.0, at: 1.44, len: 1.6 },   // G3, held, with a long fade
];
export const ATTACK_S = 0.04;
export const releaseOf = (len: number) => (len > 1 ? 0.6 : 0.12); // the last note dies away instead of stopping
export const VIBRATO = { hz: 6, from: 0.3 }; // the wobble on the last note: 6 Hz, from 0.3 s into it
export const WOMP_S = WOMP[WOMP.length - 1].at + WOMP[WOMP.length - 1].len;

let shared: AudioContext | null = null;

/** Plays once the context runs: a new context starts suspended or still opening the device, and notes scheduled 50 ms ahead lost
 *  their start. One context is kept for the page, and the first note starts 250 ms after it runs. Returns when the first note is heard,
 *  on the performance.now() clock (output latency included), or null without Web Audio. */
export async function womp(): Promise<number | null> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ac = (shared ??= new Ctx());
  await ac.resume().catch(() => {});
  const lead = 0.25, t0 = ac.currentTime + lead;
  const heardAt = performance.now() + (lead + (ac.outputLatency || ac.baseLatency || 0)) * 1000;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 2;
  lp.connect(ac.destination);
  for (const n of WOMP) {
    const o = ac.createOscillator(), g = ac.createGain();
    const release = releaseOf(n.len);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(n.hz * 1.02, t0 + n.at);
    o.frequency.exponentialRampToValueAtTime(n.hz, t0 + n.at + 0.08); // a small slide into each note, like a slide trombone
    if (n.len > 1) {
      const lfo = ac.createOscillator(), depth = ac.createGain();
      lfo.frequency.value = VIBRATO.hz; depth.gain.value = 4;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t0 + n.at + VIBRATO.from); lfo.stop(t0 + n.at + n.len);
    }
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + n.at + ATTACK_S);
    g.gain.setValueAtTime(0.12, t0 + n.at + n.len - release);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
    o.connect(g).connect(lp);
    o.start(t0 + n.at); o.stop(t0 + n.at + n.len + 0.02);
  }
  return heardAt;
}
