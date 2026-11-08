"use client";

import { useEffect, useRef } from "react";

// Six voices stacked down the hero, each an ADSR envelope drawn as one stroke,
// warm to cool. Drawn once on load, then the peaks drift (about 18 s a cycle,
// far below the 3 Hz flashing limit).
type Voice = {
  y0: number; // baseline
  ph: number; // attack peak height above the baseline
  sh: number; // sustain height above the baseline
  px: number; // attack peak x
  dx: number; // end of decay x
  rx: number; // start of release x
  width: number;
  opacity: number;
  phase: number;
};

// Baselines are 100 apart. Each voice's tallest peak plus its drift stays under
// 84, so a line never reaches the line above it.
const BASELINES = [90, 190, 290, 390, 490, 590, 690];
const PEAKS = [38, 46, 54, 62, 54, 46, 38];
const VOICES: Voice[] = BASELINES.map((y0, i) => {
  const d = Math.abs(i - 3); // distance from the centre line
  return {
    y0,
    ph: PEAKS[i],
    sh: 22 + (3 - d) * 3,
    px: [190, 150, 175, 135, 195, 160, 180][i],
    dx: [300, 262, 285, 245, 310, 270, 295][i],
    rx: [400, 440, 415, 455, 395, 430, 410][i],
    width: 4,
    opacity: [0.2, 0.4, 0.68, 1, 0.68, 0.4, 0.2][i],
    phase: i * 1.3 + 0.4,
  };
});

const SPEED = 0.35; // rad/s, one cycle is about 18 s
const DRAW_MS = 2200;
const STAGGER_MS = 240;

function shape(v: Voice, t: number, amp: number) {
  const s = (rate: number, mul = 1) => Math.sin(t * SPEED * rate + v.phase * mul);
  const px = v.px + 48 * amp * s(1);
  const py = v.y0 - (v.ph + 20 * amp * s(0.8, 1.3));
  const sy = v.y0 - (v.sh + 10 * amp * s(0.7, 0.6));
  const dx = v.dx + 34 * amp * s(0.9, 1.1);
  const rx = v.rx + 52 * amp * s(0.6, 0.8);
  const y0 = v.y0 + 6 * amp * s(0.5, 0.4);
  const f = (n: number) => n.toFixed(1);
  return (
    `M12 ${f(y0)} C ${f(12 + (px - 12) * 0.45)} ${f(y0)}, ${f(px - 40)} ${f(py)}, ${f(px)} ${f(py)} ` +
    `C ${f(px + 40)} ${f(py)}, ${f(dx - 50)} ${f(sy)}, ${f(dx)} ${f(sy)} ` +
    `L ${f(rx)} ${f(sy)} ` +
    `C ${f(rx + 60)} ${f(sy)}, ${f(588 - 70)} ${f(y0)}, 588 ${f(y0)}`
  );
}

export function Envelope({ className }: { className?: string }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    const settle = DRAW_MS + STAGGER_MS * (VOICES.length - 1);
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      // Ease the drift in as the last line finishes drawing.
      const k = Math.min(1, Math.max(0, (elapsed - settle * 0.6) / 3500));
      const amp = k * k * (3 - 2 * k);
      const t = elapsed / 1000;
      VOICES.forEach((v, i) => paths.current[i]?.setAttribute("d", shape(v, t, amp)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      className={className}
      viewBox="0 0 600 720"
      fill="none"
      role="img"
      aria-label="Seven layered attack, decay, sustain and release envelopes, drifting slowly"
    >
      <defs>
        <linearGradient id="env-stroke" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4a940" />
          <stop offset="1" stopColor="#45c7b6" />
        </linearGradient>
      </defs>
      {VOICES.map((v, i) => (
        <path
          key={i}
          ref={(el) => {
            paths.current[i] = el;
          }}
          className="lp-env-line"
          pathLength={1}
          d={shape(v, 0, 0)}
          stroke="url(#env-stroke)"
          strokeWidth={v.width}
          strokeOpacity={v.opacity}
          strokeLinecap="round"
          style={{ animationDelay: `${i * STAGGER_MS}ms` }}
        />
      ))}
    </svg>
  );
}
