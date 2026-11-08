"use client";

import { useEffect, useRef } from "react";

// Four voices, each an ADSR envelope drawn as one stroke, warm to cool.
// Drawn once on load, then the peaks drift slowly (about 30 s a cycle).
type Voice = { px: number; py: number; dx: number; sy: number; rx: number; width: number; opacity: number; phase: number };

const VOICES: Voice[] = [
  { px: 150, py: 24, dx: 260, sy: 96, rx: 430, width: 5, opacity: 1, phase: 0 },
  { px: 172, py: 46, dx: 288, sy: 112, rx: 408, width: 3, opacity: 0.55, phase: 1.7 },
  { px: 128, py: 62, dx: 238, sy: 122, rx: 452, width: 3, opacity: 0.4, phase: 3.1 },
  { px: 192, py: 36, dx: 302, sy: 80, rx: 388, width: 2, opacity: 0.3, phase: 4.6 },
];

const SPEED = 0.2; // rad/s, one cycle is about 31 s
const DRAW_MS = 2400;
const STAGGER_MS = 260;

function shape(v: Voice, t: number, amp: number) {
  const px = v.px + 16 * amp * Math.sin(t * SPEED + v.phase);
  const py = v.py + 10 * amp * Math.sin(t * SPEED * 0.8 + v.phase * 1.3);
  const sy = v.sy + 8 * amp * Math.sin(t * SPEED * 0.7 + v.phase * 0.6);
  const dx = v.dx + 12 * amp * Math.sin(t * SPEED * 0.9 + v.phase * 1.1);
  const rx = v.rx + 18 * amp * Math.sin(t * SPEED * 0.6 + v.phase * 0.8);
  const f = (n: number) => n.toFixed(1);
  return (
    `M12 180 C ${f(12 + (px - 12) * 0.45)} 180, ${f(px - 40)} ${f(py)}, ${f(px)} ${f(py)} ` +
    `C ${f(px + 40)} ${f(py)}, ${f(dx - 50)} ${f(sy)}, ${f(dx)} ${f(sy)} ` +
    `L ${f(rx)} ${f(sy)} ` +
    `C ${f(rx + 60)} ${f(sy)}, ${f(588 - 70)} 180, 588 180`
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
      // Ease the drift in after the last line has been drawn.
      const k = Math.min(1, Math.max(0, (elapsed - settle) / 4000));
      const amp = k * k * (3 - 2 * k);
      const t = elapsed / 1000;
      VOICES.forEach((v, i) => paths.current[i]?.setAttribute("d", shape(v, t, amp)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg className={className} viewBox="0 0 600 200" fill="none" role="img" aria-label="Layered attack, decay, sustain and release envelopes, drifting slowly">
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
