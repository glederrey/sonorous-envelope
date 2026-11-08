"use client";

import { useEffect, useRef } from "react";

// Seven lines, each a flat baseline that pulses travel along. A pulse is an
// envelope: fast attack, slow release. It widens and fades as it moves right.
// The centre line sends a clean upward pulse; the others vary (up, down, or
// up then down) at random intervals. Everything is slow geometry, nowhere near
// the 3 Hz flashing limit.
const X0 = 2;
const X1 = 598;
const SAMPLES = 80;
const SPACING = 110;
const BASELINES = Array.from({ length: 7 }, (_, i) => 70 + i * SPACING);
// Largest excursion per line. Neighbours' caps add up to less than SPACING, so
// lines can never touch.
const CAPS = [34, 40, 46, 50, 46, 40, 34];
const OPACITY = [0.2, 0.4, 0.68, 1, 0.68, 0.4, 0.2];
const STAGGER_MS = 240;

type Pulse = { t0: number; speed: number; w0: number; grow: number; amp: number; decay: number; biphasic: boolean };

const bump = (u: number) => (u < 0 ? Math.exp(-((u / 0.55) ** 2)) : Math.exp(-(u ** 2)));
const centre = (p: Pulse, age: number) => X0 - p.w0 + p.speed * age;
const width = (p: Pulse, age: number) => p.w0 * (1 + p.grow * age);

function pulseValue(p: Pulse, x: number, t: number) {
  const age = t - p.t0;
  const w = width(p, age);
  const u = (x - centre(p, age)) / w;
  const g = p.biphasic ? bump(u) - 0.8 * bump(u + 1.6) : bump(u);
  return p.amp * Math.exp(-p.decay * age) * g;
}

function linePath(i: number, pulses: Pulse[], t: number) {
  const cap = CAPS[i];
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let sum = 0;
    for (const p of pulses) sum += pulseValue(p, x, t);
    const y = BASELINES[i] - cap * Math.tanh(sum / cap);
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const MAIN = 3;

// The middle line sets the pulse. Every other line sends a variant of it at the
// same moment: a little faster or slower, wider or narrower, up, down or both.
function spawnMain(t: number): Pulse {
  return {
    t0: t,
    speed: rand(65, 100),
    w0: rand(40, 65),
    grow: rand(0.03, 0.1),
    amp: CAPS[MAIN] * rand(0.85, 1),
    decay: rand(0.12, 0.25),
    biphasic: false,
  };
}

function spawnVariant(i: number, main: Pulse, t: number): Pulse {
  const r = Math.random();
  return {
    t0: t + rand(0, 0.5),
    speed: main.speed * rand(0.8, 1.25),
    w0: main.w0 * rand(0.7, 1.4),
    grow: main.grow * rand(0.5, 2),
    amp: (r > 0.5 && r <= 0.75 ? -1 : 1) * CAPS[i] * rand(0.5, 1),
    decay: main.decay * rand(0.7, 1.5),
    biphasic: r > 0.75,
  };
}

export function Envelope({ className }: { className?: string }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // One frozen pulse per line.
      paths.current.forEach((el, i) => {
        const frozen: Pulse = { t0: 0, speed: 0, w0: 60, grow: 0, amp: CAPS[i] * 0.8, decay: 0, biphasic: false };
        el?.setAttribute("d", linePath(i, [{ ...frozen, speed: 1 }], 200));
      });
      return;
    }
    const start = performance.now();
    const lines = BASELINES.map(() => [] as Pulse[]);
    let next = 0; // the first pulse starts at once
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (t >= next) {
        const main = spawnMain(t);
        lines.forEach((pulses, i) => {
          if (i === MAIN) pulses.push(main);
          else if (Math.random() > 0.12) pulses.push(spawnVariant(i, main, t));
        });
        next = t + rand(5, 8);
      }
      lines.forEach((pulses, i) => {
        lines[i] = pulses.filter((p) => {
          const age = t - p.t0;
          return centre(p, age) - 2.5 * width(p, age) < X1 && Math.abs(p.amp) * Math.exp(-p.decay * age) > 1;
        });
        paths.current[i]?.setAttribute("d", linePath(i, lines[i], t));
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      className={className}
      viewBox="0 0 600 800"
      fill="none"
      role="img"
      aria-label="Seven lines with slow pulses travelling along them, like envelopes passing through"
    >
      <defs>
        <linearGradient id="env-stroke" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4a940" />
          <stop offset="1" stopColor="#45c7b6" />
        </linearGradient>
      </defs>
      {BASELINES.map((_, i) => (
        <path
          key={i}
          ref={(el) => {
            paths.current[i] = el;
          }}
          className="lp-env-line"
          pathLength={1}
          d={linePath(i, [], 0)}
          stroke="url(#env-stroke)"
          strokeWidth={4}
          strokeOpacity={OPACITY[i]}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animationDelay: `${i * STAGGER_MS}ms` }}
        />
      ))}
    </svg>
  );
}
