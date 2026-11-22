"use client";

import { useEffect, useId, useRef } from "react";

// The 404's line: a small cousin of the hero's Envelope (components/envelope.tsx). Five lines, the centre one carrying the pulses
// (fast attack, slow release, widening as they travel right), the others repeating it a little later and flatter the further out they
// are, with a faint idle breathing. Quiet and teal by default. While the trombone plays, an "agitation" level eases up (about 0.6 s)
// and back down after it (about 2 s): pulses come often, bigger and faster, the lines tremble, and amber sweeps in from the left (where
// the pulses enter) as a gradient, up to about half the width, the right end staying teal; it slides back out when the sound ends.
// The sweep moves the gradient's stops instead of blending the two colours, which would pass through a muddy olive.
const X0 = 2, X1 = 598, SAMPLES = 90;
const BASELINES = [34, 58, 82, 106, 130];
const MAIN = 2;
const CAP_UP = 30, CAP_DOWN = 7; // a line's copy stays under its neighbour: 30 x 0.7 up plus 7 down is under the 24 px between lines
const OPACITY = [0.22, 0.5, 1, 0.5, 0.22];
const GAIN = OPACITY.map((o, i) => (i === MAIN ? 1 : Math.sqrt(o)));
const DELAY_S = 0.11;
const BREATH_PX = 0.6;

type Pulse = { t0: number; speed: number; w0: number; grow: number; amp: number; biphasic: boolean };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const bump = (u: number) => (u < 0 ? Math.exp(-((u / 0.55) ** 2)) : Math.exp(-(u ** 2)));

const mix = (a: number, b: number, m: number) => a + (b - a) * m;

/** A pulse; `m` is the agitation (0 calm, 1 while the trombone plays). */
function spawn(t: number, m: number): Pulse {
  const r = Math.random();
  const dip = r > 0.55 && r <= 0.72;
  const size = mix(rand(0.55, 1), rand(0.8, 1.15), m);
  return {
    t0: t, speed: mix(rand(70, 120), rand(130, 200), m), w0: mix(rand(28, 60), rand(16, 34), m), grow: rand(0.02, 0.08),
    amp: (dip ? -CAP_DOWN * 1.4 : CAP_UP) * size, biphasic: r > 0.72,
  };
}

function value(p: Pulse, x: number, t: number) {
  const age = t - p.t0, w = p.w0 * (1 + p.grow * age);
  const u = (x - (X0 - p.w0 + p.speed * age)) / w;
  const g = p.biphasic ? bump(u) - 0.8 * bump(u + 1.6) : bump(u);
  return p.amp * (g - 0.13 * Math.exp(-(((u + 2.4) / 0.9) ** 2)));
}

function path(i: number, pulses: Pulse[], t: number, m = 0) {
  const te = t - DELAY_S * Math.abs(i - MAIN), up = CAP_UP * GAIN[i], down = CAP_DOWN * GAIN[i];
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let s = 0;
    for (const p of pulses) s += GAIN[i] * value(p, x, te);
    const disp = s >= 0 ? up * Math.tanh(s / up) : down * Math.tanh(s / down);
    const breath = BREATH_PX * Math.sin(2 * Math.PI * (x / 310 + t / (7 + i) + i * 0.37))
      + 2.2 * m * Math.sin(2 * Math.PI * (x / 47 - t * 2.3 + i * 0.61)) * Math.sin(2 * Math.PI * (x / 190 + t * 0.7)); // the tremble
    d += `${k ? "L" : "M"}${x.toFixed(1)} ${(BASELINES[i] - disp + breath).toFixed(1)} `;
  }
  return d;
}

export function QuietWaves({ busy }: { busy: boolean }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const stops = useRef<(SVGStopElement | null)[]>([]);
  const grad = `nf-waves-${useId().replace(/:/g, "")}`;
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // one pulse held in the middle (its centre reaches x 300 at t 348)
      const still: Pulse = { t0: 0, speed: 1, w0: 50, grow: 0, amp: CAP_UP * 0.7, biphasic: false };
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, [still], 348 + DELAY_S * Math.abs(i - MAIN))));
      return;
    }
    const start = performance.now();
    let pulses: Pulse[] = [], next = 0.4, frame = 0, m = 0, last = 0, shown = -1;
    const tick = (now: number) => {
      const t = (now - start) / 1000, dt = Math.min(0.1, t - last);
      last = t;
      m += ((busyRef.current ? 1 : 0) - m) * (1 - Math.exp(-dt / (busyRef.current ? 0.25 : 0.8))); // eases up in ~0.6 s, down in ~2 s
      if (t >= next) {
        pulses.push(spawn(t, m));
        next = t + mix(rand(1.6, 4), rand(0.18, 0.45), m);
      }
      if (Math.abs(m - shown) > 0.003) {
        shown = m;
        const edge = mix(-0.4, 0.5, m); // amber up to here, then 40% of the width to fade into teal
        stops.current[0]?.setAttribute("offset", String(Math.max(0, edge)));
        stops.current[1]?.setAttribute("offset", String(Math.min(1, Math.max(0, edge + 0.4))));
      }
      pulses = pulses.filter((p) => X0 - p.w0 + p.speed * (t - p.t0 - DELAY_S * 2) - 2.5 * p.w0 * (1 + p.grow * (t - p.t0)) < X1);
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, pulses, t, m)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg className="nf-waves" viewBox="0 0 600 150" fill="none" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--glow)" }} />
          <stop ref={(el) => { stops.current[0] = el; }} offset="0" style={{ stopColor: "var(--glow)" }} />
          <stop ref={(el) => { stops.current[1] = el; }} offset="0" style={{ stopColor: "var(--tide)" }} />
          <stop offset="1" style={{ stopColor: "var(--tide)" }} />
        </linearGradient>
      </defs>
      {BASELINES.map((_, i) => (
        <path
          key={i}
          ref={(el) => { paths.current[i] = el; }}
          d={path(i, [], 0)}
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
