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

const VOICES: Voice[] = [
  { y0: 90, ph: 70, sh: 30, px: 190, dx: 300, rx: 400, width: 2, opacity: 0.35, phase: 0.4 },
  { y0: 170, ph: 92, sh: 40, px: 150, dx: 262, rx: 440, width: 2.5, opacity: 0.5, phase: 1.9 },
  { y0: 255, ph: 105, sh: 50, px: 175, dx: 285, rx: 415, width: 3, opacity: 0.7, phase: 3.2 },
  { y0: 340, ph: 100, sh: 44, px: 135, dx: 245, rx: 455, width: 4, opacity: 1, phase: 4.5 },
  { y0: 425, ph: 84, sh: 36, px: 195, dx: 310, rx: 395, width: 2.5, opacity: 0.55, phase: 5.8 },
  { y0: 505, ph: 62, sh: 26, px: 160, dx: 270, rx: 430, width: 2, opacity: 0.35, phase: 0.9 },
];

const SPEED = 0.35; // rad/s, one cycle is about 18 s
const DRAW_MS = 2200;
const STAGGER_MS = 240;

function shape(v: Voice, t: number, amp: number) {
  const s = (rate: number, mul = 1) => Math.sin(t * SPEED * rate + v.phase * mul);
  const px = v.px + 48 * amp * s(1);
  const py = v.y0 - (v.ph + 26 * amp * s(0.8, 1.3));
  const sy = v.y0 - (v.sh + 16 * amp * s(0.7, 0.6));
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
      viewBox="0 0 600 560"
      fill="none"
      role="img"
      aria-label="Six layered attack, decay, sustain and release envelopes, drifting slowly"
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
