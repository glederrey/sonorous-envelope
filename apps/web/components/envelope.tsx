"use client";

import { useEffect, useRef } from "react";

// Seven lines, each a flat baseline that pulses travel along. A pulse is an
// envelope: fast attack, slow release. It widens and fades as it moves right.
// The centre line sends a clean upward pulse; the others vary (up, down, or
// up then down) at random intervals. Everything is slow geometry, nowhere near
// the 3 Hz flashing limit.
const X0 = 2;
const X1 = 478;
const SAMPLES = 90;
const SPACING = 125;
const BASELINES = Array.from({ length: 7 }, (_, i) => 130 + i * SPACING);
const MAIN = 3;
// Largest upward excursion per line (always below SPACING, so a line never
// reaches the baseline of the one above). Only the middle line can also dip,
// and its dip plus the next line's rise stays under SPACING.
const CAPS_UP = [55, 70, 85, 100, 85, 70, 55];
const CAP_DOWN = 30;
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
  const up = CAPS_UP[i];
  const down = i === MAIN ? CAP_DOWN : 1;
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let sum = 0;
    for (const p of pulses) sum += pulseValue(p, x, t);
    const y = BASELINES[i] - (sum >= 0 ? up * Math.tanh(sum / up) : down * Math.tanh(sum / down));
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// The middle line sets the pulse and may go up, down, or up then down. Every
// other line sends an upward variant at the same moment: faster or slower,
// wider or narrower. Waves keep their height until they leave at the right.
function spawnMain(t: number): Pulse {
  const r = Math.random();
  const dip = r > 0.5 && r <= 0.72;
  // Three characters: a slow wide swell, a quick sharp spike, or something between.
  const k = Math.random();
  const swell = k < 0.2;
  const spike = k >= 0.2 && k < 0.4;
  return {
    t0: t,
    speed: swell ? rand(38, 60) : spike ? rand(110, 150) : rand(65, 105),
    w0: swell ? rand(75, 125) : spike ? rand(16, 28) : rand(40, 70),
    grow: swell ? rand(0, 0.03) : rand(0.02, 0.08),
    amp: (dip ? -1 : 1) * (dip ? CAP_DOWN * 1.4 : CAPS_UP[MAIN]) * rand(0.55, 1),
    decay: rand(0, 0.025),
    biphasic: r > 0.72,
  };
}

function spawnVariant(i: number, main: Pulse, t: number): Pulse {
  return {
    t0: t + (Math.random() < 0.2 ? rand(0.4, 1.4) : rand(0, 0.5)),
    speed: main.speed * rand(0.65, 1.5),
    w0: Math.abs(main.w0) * rand(0.55, 1.8),
    grow: main.grow * rand(0.4, 2.2),
    amp: CAPS_UP[i] * rand(0.35, 1),
    decay: rand(0, 0.025),
    biphasic: false,
  };
}

export function Envelope({ className }: { className?: string }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // One frozen pulse per line.
      paths.current.forEach((el, i) => {
        const frozen: Pulse = { t0: 0, speed: 0, w0: 60, grow: 0, amp: CAPS_UP[i] * 0.8, decay: 0, biphasic: false };
        el?.setAttribute("d", linePath(i, [{ ...frozen, speed: 1 }], 200));
      });
      return;
    }
    const start = performance.now();
    const lines = BASELINES.map(() => [] as Pulse[]);
    // Event times: the first at once, then every 2.5 to 6 s. About a third of
    // the events come twice in quick succession.
    const events: number[] = [0];
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      while (events.length && t >= events[0]) {
        const at = events.shift() as number;
        const main = spawnMain(t);
        lines.forEach((pulses, i) => {
          if (i === MAIN) pulses.push(main);
          else if (Math.random() > 0.12) pulses.push(spawnVariant(i, main, t));
        });
        if (events.length === 0) {
          events.push(at + rand(2.5, 6));
          if (Math.random() < 0.35) {
            const gap = t + rand(0.25, 0.8);
            // Now and then a third wave follows the second.
            if (Math.random() < 0.3) events.unshift(gap, gap + rand(0.25, 0.8));
            else events.unshift(gap);
          }
        }
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
      viewBox="0 65 480 880"
      fill="none"
      role="img"
      aria-label="Seven lines with slow pulses travelling along them, like envelopes passing through"
    >
      <defs>
        <linearGradient id="env-stroke" x1="0" y1="0" x2="480" y2="0" gradientUnits="userSpaceOnUse">
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
