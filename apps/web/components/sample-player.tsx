"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Square } from "lucide-react";
import { AudioOutput } from "./player/audio";
import { sliderToGain } from "../lib/volume";
import { SAMPLES, fadeOut, stateOfStep, type Sample } from "../lib/samples";

const FADE_S = 3;
const SAMPLE_VOLUME = 0.6; // slider position: a little below the player's default, and the visitor has not chosen yet

/** "Hear what to expect": five emotions played by the same engine as a real session. Starts on a tap, stops on a tap or when it ends. */
export function SamplePlayer() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState("");
  const out = useRef<AudioOutput | null>(null);
  const timers = useRef<number[]>([]);
  const swatches = useMemo(() => SAMPLES.map((s) => {
    const c = stateOfStep(s.steps[0], s.id).colour;
    return `hsl(${Math.round(c.h)} ${Math.round(Math.min(1, c.s + 0.25) * 100)}% ${Math.round(Math.max(0.3, c.l + 0.2) * 100)}%)`;
  }), []);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const stop = async (immediate = false) => {
    clear(); setPlaying(null);
    const o = out.current; out.current = null;
    if (!o) return;
    if (!immediate) await new Promise((r) => setTimeout(r, 400)); // let a fade-out state land first
    await o.close();
  };
  useEffect(() => () => { clear(); void out.current?.close(); }, []);

  const play = async (s: Sample) => {
    setError("");
    if (playing === s.id) { await stop(); return; }
    clear();
    try {
      if (!out.current) {
        out.current = await AudioOutput.start();
        out.current.setGain(sliderToGain(SAMPLE_VOLUME));
      }
      const o = out.current;
      setPlaying(s.id);
      let last = stateOfStep(s.steps[0], s.id);
      s.steps.forEach((step, i) => {
        const state = stateOfStep(step, s.id); last = state;
        // a new sample replaces the one before it with a short transition of its own
        if (i === 0) o.setState({ ...state, transition: { time: 1, curve: "smooth" } }, s.seed, 0, 0);
        else timers.current.push(window.setTimeout(() => o.setState(state, s.seed), step.at * 1000));
      });
      timers.current.push(window.setTimeout(() => o.setState(fadeOut(last, FADE_S), s.seed), (s.seconds - FADE_S) * 1000));
      timers.current.push(window.setTimeout(() => { void stop(true); }, s.seconds * 1000 + 300));
    } catch {
      setPlaying(null); setError("Your browser did not let the sound start. Tap again.");
    }
  };

  return (
    <div className="lp-samples">
      <ul className="lp-sample-list">
        {SAMPLES.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="lp-sample" aria-pressed={playing === s.id} onClick={() => void play(s)}>
              <span className="lp-swatch" style={{ background: swatches[i] }} aria-hidden />
              <span className="lp-sample-text">
                <span className="se-heading">{s.name}</span>
                <span className="se-muted se-sm">{s.blurb}</span>
              </span>
              <span className="lp-sample-state se-sm">{playing === s.id ? <><Square size={14} aria-hidden /> Stop</> : "Play"}</span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="se-sm">{error}</p>}
    </div>
  );
}
