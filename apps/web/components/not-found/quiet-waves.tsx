"use client";

import { useEffect, useId, useRef } from "react";
import { ATTACK_S, releaseOf, VIBRATO, WOMP, WOMP_S } from "./trombone";

// The 404's lines: five standing waves in place, the centre one the strongest, the others a little later and flatter the further out
// they are (like the hero's lines). Calm, they are teal and barely move. When the trombone is heard they follow its score (trombone.ts):
// each note swells the waves with a shape of its own (fewer loops as the pitch falls), the held last note trembles at the vibrato's
// 6 Hz, and they settle when the sound stops. Amber spreads from the centre to the edges while it plays and draws back after.
const X0 = 2, X1 = 598, L = X1 - X0, SAMPLES = 120;
const BASELINES = [34, 58, 82, 106, 130];
const MAIN = 2;
const CAP = 28; // the centre line's largest excursion; the others are scaled by GAIN, so neighbours move together and never cross
const OPACITY = [0.22, 0.5, 1, 0.5, 0.22];
const GAIN = OPACITY.map((o, i) => (i === MAIN ? 1 : Math.sqrt(o)));
const LAG_S = 0.05;   // each line away from the centre follows the sound this much later
const SWAY_HZ = 1.6;  // how fast a swollen wave rocks
const HALF = 300;     // the centre, where the amber starts
const STOPS = 16;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// the four notes in loops across the width: the pitch falls, the waves get longer
const LOOPS = WOMP.map((n) => 2.5 * (n.hz / WOMP[WOMP.length - 1].hz) + 0.5);
const SIZE = [1, 0.9, 0.82, 1];

/** How loud the trombone is `s` seconds after it is heard (0 to 1), which note, and how far into it. */
function score(s: number): { level: number; note: number; into: number } {
  for (let k = 0; k < WOMP.length; k++) {
    const n = WOMP[k], into = s - n.at;
    if (into < 0 || into > n.len) continue;
    const rel = releaseOf(n.len);
    const level = Math.min(clamp01(into / ATTACK_S), clamp01((n.len - into) / rel));
    return { level: level * SIZE[k], note: k, into };
  }
  return { level: 0, note: -1, into: 0 };
}

/** Line i at time t (seconds on the page clock); `heard` is when the sound started on that clock, or null. */
function path(i: number, t: number, heard: number | null) {
  const s = heard === null ? -1 : t - heard - LAG_S * Math.abs(i - MAIN);
  const { level, note, into } = score(s);
  const ph = 2 * Math.PI * (SWAY_HZ * s + 0.08 * i), sway = Math.cos(ph), sway2 = Math.sin(ph); // two shapes in turn: never flat mid-note
  const shake = note === WOMP.length - 1 && into > VIBRATO.from ? Math.sin(2 * Math.PI * VIBRATO.hz * s) : 0;
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + (L * k) / SAMPLES, u = (x - X0) / L, win = Math.sin(Math.PI * u);
    // calm: two slow standing shapes, a pixel or two
    let y = 1.4 * win * (Math.sin(2 * Math.PI * (1.15 * u + 0.37 * i)) * Math.cos(2 * Math.PI * (t / 6.5 + 0.11 * i))
      + 0.6 * Math.sin(2 * Math.PI * (2.3 * u + 0.71 * i)) * Math.cos(2 * Math.PI * (t / 4.1 + 0.3 + 0.07 * i)));
    if (level > 0.001) {
      const loops = LOOPS[note];
      y += CAP * 0.85 * level * win * (Math.sin(Math.PI * loops * u) * sway + 0.55 * Math.sin(Math.PI * (loops + 1) * u) * sway2);
      y += CAP * 0.18 * level * win * shake * Math.sin(Math.PI * 11 * u); // the vibrato: a fast ripple on the held note
    }
    const cap = CAP * GAIN[i];
    d += `${k ? "L" : "M"}${x.toFixed(1)} ${(BASELINES[i] - cap * Math.tanh((GAIN[i] * y) / cap)).toFixed(1)} `;
  }
  return d;
}

// oklab keeps the teal-to-amber edge from passing through a muddy olive
const stopColour = (h: number) => `color-mix(in oklab, var(--glow) ${Math.round(h * 100)}%, var(--tide))`;

export function QuietWaves({ heardAt }: { heardAt: number | null }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const stops = useRef<(SVGStopElement | null)[]>([]);
  const grad = `nf-waves-${useId().replace(/:/g, "")}`;
  const heardRef = useRef(heardAt);
  useEffect(() => { heardRef.current = heardAt; }, [heardAt]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, 1, null)));
      return;
    }
    let frame = 0, spread = 0, last = performance.now();
    const shown: number[] = Array(STOPS).fill(0);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const h = heardRef.current, heard = h === null ? null : h / 1000, t = now / 1000;
      const sounding = heard !== null && t >= heard && t <= heard + WOMP_S;
      // the amber spreads from the centre while it sounds (about 0.3 s to the edges) and draws back after (about 0.8 s)
      spread += ((sounding ? 1 : 0) - spread) * (1 - Math.exp(-dt / (sounding ? 0.1 : 0.3)));
      const radius = spread * (HALF + 120);
      for (let s = 0; s < STOPS; s++) {
        const v = clamp01((radius - Math.abs((600 * s) / (STOPS - 1) - HALF)) / 120);
        if (Math.abs(v - shown[s]) > 0.01 || (v === 0 && shown[s] !== 0)) { shown[s] = v; stops.current[s]?.style.setProperty("stop-color", stopColour(v)); }
      }
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, t, heard)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg className="nf-waves" viewBox="0 0 600 150" fill="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
          {Array.from({ length: STOPS }, (_, s) => (
            <stop key={s} ref={(el) => { stops.current[s] = el; }} offset={s / (STOPS - 1)} style={{ stopColor: "var(--tide)" }} />
          ))}
        </linearGradient>
      </defs>
      {BASELINES.map((_, i) => (
        <path
          key={i}
          ref={(el) => { paths.current[i] = el; }}
          d={path(i, 0, null)}
          stroke={`url(#${grad})`}
          strokeWidth={3}
          strokeOpacity={OPACITY[i]}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
