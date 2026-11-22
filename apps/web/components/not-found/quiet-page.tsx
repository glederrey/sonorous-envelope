"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { QuietWaves } from "./quiet-waves";

// The sad trombone: four falling notes, the last one long with a wobble. Quiet (peak gain 0.12), only on a press.
const WOMP: { hz: number; at: number; len: number }[] = [
  { hz: 233.08, at: 0, len: 0.42 },    // B♭3
  { hz: 220.0, at: 0.48, len: 0.42 },  // A3
  { hz: 207.65, at: 0.96, len: 0.42 }, // A♭3
  { hz: 196.0, at: 1.44, len: 1.6 },   // G3, held, with a long fade
];

let shared: AudioContext | null = null;

/** Plays once the context runs: a new context starts suspended or still opening the device, and notes scheduled 50 ms ahead lost
 *  their start. One context is kept for the page, and the first note starts 250 ms after it runs. Returns the length in seconds. */
async function womp() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return 0;
  const ac = (shared ??= new Ctx());
  await ac.resume().catch(() => {});
  const t0 = ac.currentTime + 0.25;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 2;
  lp.connect(ac.destination);
  for (const n of WOMP) {
    const o = ac.createOscillator(), g = ac.createGain();
    const release = n.len > 1 ? 0.6 : 0.12; // the last note dies away instead of stopping
    o.type = "sawtooth";
    o.frequency.setValueAtTime(n.hz * 1.02, t0 + n.at);
    o.frequency.exponentialRampToValueAtTime(n.hz, t0 + n.at + 0.08); // a small slide into each note, like a slide trombone
    if (n.len > 1) { // the wobble on the last note
      const lfo = ac.createOscillator(), depth = ac.createGain();
      lfo.frequency.value = 6; depth.gain.value = 4;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(t0 + n.at + 0.3); lfo.stop(t0 + n.at + n.len);
    }
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + n.at + 0.04);
    g.gain.setValueAtTime(0.12, t0 + n.at + n.len - release);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.len);
    o.connect(g).connect(lp);
    o.start(t0 + n.at); o.stop(t0 + n.at + n.len + 0.02);
  }
  return 0.25 + WOMP[WOMP.length - 1].at + WOMP[WOMP.length - 1].len;
}

/** The site's 404: "this page went quiet". The 0 of 404 is a rippling ring (the visuals' ripples), a flat sound line runs under the text
 *  (QuietWaves, the hero's lines in small), and a button plays a short sad trombone. Motion stops under prefers-reduced-motion. */
export function QuietPage() {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const press = async () => {
    setPlaying(true);
    const s = await womp();
    if (!s) { setPlaying(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(false), s * 1000);
  };

  return (
    <main className="nf" data-playing={playing || undefined}>
      <div className="nf-code" aria-hidden>
        <span>4</span>
        <svg className="nf-ring" viewBox="0 0 120 120">
          <circle className="nf-ripple" cx="60" cy="60" r="34" />
          <circle className="nf-ripple nf-ripple-2" cx="60" cy="60" r="34" />
          <circle className="nf-ripple nf-ripple-3" cx="60" cy="60" r="34" />
          <circle className="nf-zero" cx="60" cy="60" r="34" />
        </svg>
        <span>4</span>
      </div>
      <h1 className="nf-title">This page went quiet.</h1>
      <p className="nf-text se-muted">
        Nothing plays at this address. The link may be old, mistyped, or the saved moment behind it was deleted.
      </p>
      <QuietWaves busy={playing} />
      <div className="nf-actions">
        <Link className="se-btn se-btn-primary" href="/">Back to the start</Link>
        <button type="button" className="se-btn" onClick={press} disabled={playing}>
          <Volume2 size={16} aria-hidden />{playing ? "Wah wah wah…" : "Play a sad trombone"}
        </button>
      </div>
    </main>
  );
}
