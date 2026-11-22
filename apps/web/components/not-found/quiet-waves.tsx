"use client";

import { useEffect, useId, useRef } from "react";

// The 404's line: a small cousin of the hero's Envelope (components/envelope.tsx). Five lines, the centre one carrying the pulses
// (fast attack, slow release, widening as they travel right), the others repeating it a little later and flatter the further out they
// are. Calm, it is teal with rare, small pulses. While the trombone plays, an "agitation" level rises: the pulses that enter from the
// left are big, frequent and trembling, and amber. The colour and the tremble travel with them: a point x of the line shows the
// agitation there was when the wave passing it entered ((x - ENTRY) / FRONT seconds ago), so the amber arrives from the left behind a teal-to-amber
// front, and when the sound ends teal and calm come back the same way while the last amber pulses run out to the right.
const X0 = 2, X1 = 598, SAMPLES = 90;
const BASELINES = [34, 58, 82, 106, 130];
const MAIN = 2;
const CAP_UP = 30, CAP_DOWN = 7; // a line's copy stays under its neighbour: 30 x 0.7 up plus 7 down is under the 24 px between lines
const OPACITY = [0.22, 0.5, 1, 0.5, 0.22];
const GAIN = OPACITY.map((o, i) => (i === MAIN ? 1 : Math.sqrt(o)));
const DELAY_S = 0.11;
const BREATH_PX = 0.5;
const FRONT = 150; // px/s: how fast the colour and the tremble travel, about the speed of the pulses
const STOPS = 16;  // gradient stops along the width
// Pulses are born here, inside the faded left edge (the mask is clear from 14%, x 84), not off the line: they reach the visible part in
// about 0.2 s, the time the trombone takes to sound (it starts 250 ms after the press), so the waves and the sound start together.
const ENTRY = 50;

type Pulse = { t0: number; speed: number; w0: number; grow: number; amp: number; biphasic: boolean };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const mix = (a: number, b: number, m: number) => a + (b - a) * m;
const bump = (u: number) => (u < 0 ? Math.exp(-((u / 0.55) ** 2)) : Math.exp(-(u ** 2)));

/** A pulse; `m` is the agitation when it enters (0 calm, 1 while the trombone plays). */
function spawn(t: number, m: number): Pulse {
  const r = Math.random();
  const dip = r > 0.55 && r <= 0.72;
  const size = mix(rand(0.12, 0.28), rand(0.8, 1.15), m);
  return {
    t0: t, speed: mix(rand(120, 150), rand(145, 160), m), w0: mix(rand(40, 70), rand(18, 34), m), grow: rand(0.02, 0.08),
    amp: (dip ? -CAP_DOWN * 1.4 : CAP_UP) * size, biphasic: r > 0.72,
  };
}

function value(p: Pulse, x: number, t: number) {
  const age = t - p.t0, w = p.w0 * (1 + p.grow * age);
  const u = (x - (ENTRY - 0.5 * p.w0 + p.speed * age)) / w;
  const g = p.biphasic ? bump(u) - 0.8 * bump(u + 1.6) : bump(u);
  return p.amp * (g - 0.13 * Math.exp(-(((u + 2.4) / 0.9) ** 2)));
}

/** `heat(x)` is the agitation that reached x: it scales the vibrato there. */
function path(i: number, pulses: Pulse[], t: number, heat: (x: number) => number) {
  const te = t - DELAY_S * Math.abs(i - MAIN), up = CAP_UP * GAIN[i], down = CAP_DOWN * GAIN[i];
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let s = 0;
    for (const p of pulses) s += GAIN[i] * value(p, x, te);
    const disp = s >= 0 ? up * Math.tanh(s / up) : down * Math.tanh(s / down);
    const h = heat(x);
    const wobble = BREATH_PX * Math.sin(2 * Math.PI * (x / 310 + t / (7 + i) + i * 0.37))
      + (h > 0.01 ? 2.6 * h * Math.sin(2 * Math.PI * (x / 47 - t * 2.3 + i * 0.61)) * Math.sin(2 * Math.PI * (x / 190 + t * 0.7)) : 0); // the vibrato
    d += `${k ? "L" : "M"}${x.toFixed(1)} ${(BASELINES[i] - disp + wobble).toFixed(1)} `;
  }
  return d;
}

// oklab keeps the teal-to-amber front from passing through a muddy olive
const stopColour = (h: number) => `color-mix(in oklab, var(--glow) ${Math.round(h * 100)}%, var(--tide))`;
const still = () => 0;

export function QuietWaves({ busy }: { busy: boolean }) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const stops = useRef<(SVGStopElement | null)[]>([]);
  const grad = `nf-waves-${useId().replace(/:/g, "")}`;
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // one small pulse held in the middle (speed 1 px/s: its centre reaches x 300 at t = 300 - ENTRY + w0 / 2)
      const held: Pulse = { t0: 0, speed: 1, w0: 50, grow: 0, amp: CAP_UP * 0.3, biphasic: false };
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, [held], 300 - ENTRY + 25 + DELAY_S * Math.abs(i - MAIN), still)));
      return;
    }
    const start = performance.now();
    let pulses: Pulse[] = [], next = 0.4, frame = 0, m = 0, last = 0;
    const hist: { t: number; m: number }[] = []; // the agitation over the last few seconds, oldest first
    const shown: number[] = Array(STOPS).fill(0);
    /** The agitation `ago` seconds back (0 before the page started). */
    const past = (now: number, ago: number) => {
      const at = now - ago;
      for (let j = hist.length - 1; j >= 0; j--) if (hist[j].t <= at) return hist[j].m;
      return 0;
    };
    const tick = (nowMs: number) => {
      const t = (nowMs - start) / 1000, dt = Math.min(0.1, t - last);
      last = t;
      const target = busyRef.current ? 1 : 0;
      m += (target - m) * (1 - Math.exp(-dt / (target ? 0.12 : 0.35))); // the front of colour is a few tenths of a second wide
      hist.push({ t, m });
      while (hist.length > 2 && hist[1].t < t - (X1 / FRONT + 1)) hist.shift();
      if (next - t > mix(5, 0.4, m)) next = t + rand(0, 0.15); // a calm wait no longer holds back the first big pulse
      if (t >= next) {
        pulses.push(spawn(t, m));
        next = t + mix(rand(2.5, 5), rand(0.16, 0.4), m);
      }
      pulses = pulses.filter((p) => ENTRY - 0.5 * p.w0 + p.speed * (t - p.t0 - DELAY_S * 2) - 2.5 * p.w0 * (1 + p.grow * (t - p.t0)) < X1);
      const heat = (x: number) => past(t, Math.max(0, x - ENTRY) / FRONT);
      for (let s = 0; s < STOPS; s++) {
        const h = heat((600 * s) / (STOPS - 1));
        if (Math.abs(h - shown[s]) > 0.01 || (h === 0 && shown[s] !== 0)) { shown[s] = h; stops.current[s]?.style.setProperty("stop-color", stopColour(h)); }
      }
      paths.current.forEach((el, i) => el?.setAttribute("d", path(i, pulses, t, heat)));
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
          d={path(i, [], 0, still)}
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
