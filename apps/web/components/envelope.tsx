"use client";

import { useEffect, useRef } from "react";

// Seven lines. The centre line carries the pulses: an envelope with a fast
// attack and a slow release that widens and fades as it travels right, and may
// go up, down, or up then down. Every other line repeats exactly that shape,
// scaled down by its own opacity, so the fainter the line the flatter its copy.
// Everything is slow geometry, nowhere near the 3 Hz flashing limit.
const X0 = 2;
const X1 = 598;
const SAMPLES = 90;
const SPACING = 80;
const BASELINES = Array.from({ length: 7 }, (_, i) => 90 + i * SPACING);
const MAIN = 3;
// Largest excursion of the centre line. Every other line moves the same way by
// less (see GAIN), so no line reaches the baseline of its neighbour.
const CAP_UP = 64;
const CAP_DOWN = 16;
const OPACITY = [0.2, 0.4, 0.68, 1, 0.68, 0.4, 0.2];
// How much of the centre line's movement each line repeats: the fainter, the less.
const GAIN = OPACITY.map((o, i) => (i === MAIN ? 1 : Math.sqrt(o)));
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

/** The centre line's vertical excursion (up is positive) at each sample, for the pulses alive at time t. */
function displacement(pulses: Pulse[], t: number) {
  const out = new Float32Array(SAMPLES + 1);
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let sum = 0;
    for (const p of pulses) sum += pulseValue(p, x, t);
    out[k] = sum >= 0 ? CAP_UP * Math.tanh(sum / CAP_UP) : CAP_DOWN * Math.tanh(sum / CAP_DOWN);
  }
  return out;
}

function linePath(i: number, disp: Float32Array) {
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${(BASELINES[i] - GAIN[i] * disp[k]).toFixed(1)} `;
  }
  return d;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// A new pulse on the centre line: it may go up, down, or up then down.
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
    amp: (dip ? -1 : 1) * (dip ? CAP_DOWN * 1.4 : CAP_UP) * rand(0.55, 1),
    decay: rand(0, 0.025),
    biphasic: r > 0.72,
  };
}

export function Envelope({ className }: { className?: string }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // One frozen pulse, repeated on every line.
      const frozen: Pulse = { t0: 0, speed: 1, w0: 60, grow: 0, amp: CAP_UP * 0.8, decay: 0, biphasic: false };
      const disp = displacement([frozen], 200);
      paths.current.forEach((el, i) => el?.setAttribute("d", linePath(i, disp)));
      return;
    }
    const start = performance.now();
    let pulses: Pulse[] = [];
    // Event times: the first at once, then every 1.5 to 4 s. About a third of
    // the events come twice in quick succession.
    const events: number[] = [0];
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      while (events.length && t >= events[0]) {
        const at = events.shift() as number;
        pulses.push(spawnMain(t));
        if (events.length === 0) {
          events.push(at + rand(1.5, 4));
          if (Math.random() < 0.35) {
            const gap = t + rand(0.25, 0.8);
            // Now and then a third wave follows the second.
            if (Math.random() < 0.3) events.unshift(gap, gap + rand(0.25, 0.8));
            else events.unshift(gap);
          }
        }
      }
      pulses = pulses.filter((p) => {
        const age = t - p.t0;
        return centre(p, age) - 2.5 * width(p, age) < X1 && Math.abs(p.amp) * Math.exp(-p.decay * age) > 1;
      });
      const disp = displacement(pulses, t);
      paths.current.forEach((el, i) => el?.setAttribute("d", linePath(i, disp)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      className={className}
      viewBox="0 46 600 568"
      fill="none"
      role="img"
      aria-label="Seven lines repeating the same slow pulse, each fainter and flatter than the one before, like envelopes passing through"
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
          d={linePath(i, displacement([], 0))}
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
