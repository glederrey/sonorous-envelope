"use client";

import { useEffect, useRef } from "react";

// Seven lines. The centre line carries the pulses: an envelope with a fast
// attack and a slow release that widens and fades as it travels right, and may
// go up, down, or up then down. Every other line repeats that shape, a little
// later and a little flatter the further it is from the centre (the fainter the
// line, the flatter its copy), with a small random spread per wave so the copies
// are not exact. Added life: a faint idle breathing on every line, a small
// undershoot after each wave, opacity that rises while a wave passes, a
// gradient that drifts, lines that lean towards the pointer, and a pulse of its own
// wherever the visitor clicks.
// Everything is slow geometry, nowhere near the 3 Hz flashing limit.
const X0 = 2;
const X1 = 598;
const SAMPLES = 90;
const SPACING = 80;
const BASELINES = Array.from({ length: 7 }, (_, i) => 90 + i * SPACING);
const MAIN = 3;
// Largest excursion of the centre line. Each other line keeps a smaller cap, so
// two neighbours, even out of step, stay apart (60 up plus 16 down is under 80).
const CAP_UP = 60;
const CAP_DOWN = 16;
const OPACITY = [0.2, 0.4, 0.68, 1, 0.68, 0.4, 0.2];
// How much of the centre line's movement each line repeats: the fainter, the less.
const BASE_GAIN = OPACITY.map((o, i) => (i === MAIN ? 1 : Math.sqrt(o)));
const CAP = BASE_GAIN.map((g) => Math.min(1, g * 1.12));
const DELAY_S = 0.11; // each step away from the centre repeats the wave this much later
const BREATH_PX = 1.6;
const POINTER_PX = 10;
const STAGGER_MS = 240;

type Pulse = { t0: number; speed: number; w0: number; grow: number; amp: number; decay: number; biphasic: boolean; gains: number[] };

const bump = (u: number) => (u < 0 ? Math.exp(-((u / 0.55) ** 2)) : Math.exp(-(u ** 2)));
const centre = (p: Pulse, age: number) => X0 - p.w0 + p.speed * age;
const width = (p: Pulse, age: number) => p.w0 * (1 + p.grow * age);

function pulseValue(p: Pulse, x: number, t: number) {
  const age = t - p.t0;
  const w = width(p, age);
  const u = (x - centre(p, age)) / w;
  const g = p.biphasic ? bump(u) - 0.8 * bump(u + 1.6) : bump(u);
  // a small undershoot behind the wave: the line settles like a spring
  const settle = -0.13 * Math.exp(-(((u + 2.4) / 0.9) ** 2));
  return p.amp * Math.exp(-p.decay * age) * (g + settle);
}

const gains = () => BASE_GAIN.map((g, i) => (i === MAIN ? 1 : g * rand(0.9, 1.1)));

/** Line i's vertical excursion (up is positive) at each sample, for the pulses alive at time t. Returns the peak too. */
function displacement(i: number, pulses: Pulse[], t: number, out: Float32Array) {
  const te = t - DELAY_S * Math.abs(i - MAIN);
  const up = CAP_UP * CAP[i], down = CAP_DOWN * CAP[i];
  let peak = 0;
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let sum = 0;
    for (const p of pulses) sum += p.gains[i] * pulseValue(p, x, te);
    const d = sum >= 0 ? up * Math.tanh(sum / up) : down * Math.tanh(sum / down);
    out[k] = d;
    peak = Math.max(peak, Math.abs(d) / up);
  }
  return peak;
}

interface Extras { t: number; pointer: { x: number; y: number; k: number } | null }

/** The path of line i: the wave, the idle breathing and the pointer lean added on the baseline. */
function linePath(i: number, disp: Float32Array, ex: Extras | null) {
  const by = BASELINES[i];
  let d = "";
  for (let k = 0; k <= SAMPLES; k++) {
    const x = X0 + ((X1 - X0) * k) / SAMPLES;
    let y = by - disp[k];
    if (ex) {
      // two slow waves per line, each with its own period and phase
      const a = ex.t / (7 + i * 0.9), b = ex.t / (11 - i * 0.6);
      y += BREATH_PX * (Math.sin(2 * Math.PI * (x / 310 + a + i * 0.37)) + 0.5 * Math.sin(2 * Math.PI * (x / 170 - b + i * 0.71))) / 1.5;
      const ptr = ex.pointer;
      if (ptr && ptr.k > 0.001) {
        const dx = (x - ptr.x) / 90, dy = (by - ptr.y) / 130;
        y += Math.max(-POINTER_PX, Math.min(POINTER_PX, (ptr.y - by) * 0.12)) * Math.exp(-dx * dx - dy * dy) * ptr.k;
      }
    }
    d += `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
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
  // Size: a few big waves, many small ones, the rest in between.
  const z = Math.random();
  const big = z < 0.12, small = z >= 0.12 && z < 0.55;
  const size = big ? rand(0.95, 1) : small ? rand(0.3, 0.55) : rand(0.55, 0.9);
  return {
    t0: t,
    speed: swell ? rand(38, 60) : spike ? rand(110, 150) : rand(65, 105),
    w0: (swell ? rand(75, 125) : spike ? rand(16, 28) : rand(40, 70)) * (big ? 1.3 : 1),
    grow: swell ? rand(0, 0.03) : rand(0.02, 0.08),
    amp: (dip ? -1 : 1) * (dip ? CAP_DOWN * 1.4 : CAP_UP) * size,
    decay: rand(0, 0.025),
    biphasic: r > 0.72,
    gains: gains(),
  };
}

// A pulse the visitor starts by clicking: it begins under the click and travels right.
// A click above the centre line sends a swell up, a click below sends a dip.
function spawnAt(t: number, x: number, up: boolean): Pulse {
  const p = spawnMain(t);
  const age0 = Math.max(0, (x - X0 + p.w0) / p.speed);
  return { ...p, t0: t - age0, amp: (up ? 1 : -1) * (up ? CAP_UP : CAP_DOWN * 1.4) * rand(0.6, 1), biphasic: false };
}

export function Envelope({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const gradient = useRef<SVGLinearGradientElement | null>(null);

  useEffect(() => {
    const out = BASELINES.map(() => new Float32Array(SAMPLES + 1));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // One frozen pulse, repeated on every line.
      const frozen: Pulse = { t0: 0, speed: 1, w0: 60, grow: 0, amp: CAP_UP * 0.8, decay: 0, biphasic: false, gains: [...BASE_GAIN] };
      paths.current.forEach((el, i) => {
        displacement(i, [frozen], 200, out[i]);
        el?.setAttribute("d", linePath(i, out[i], null));
      });
      return;
    }
    const start = performance.now();
    let pulses: Pulse[] = [];
    // Event times: the first at once, then every 1.5 to 4 s. About a third of
    // the events come twice in quick succession.
    const events: number[] = [0];
    const energy = BASELINES.map(() => 0);
    // The pointer, in the svg's own coordinates; `k` eases in and out so the lean never jumps.
    const pointer = { x: 0, y: 0, k: 0, target: 0 };
    const onMove = (e: PointerEvent) => {
      const el = svg.current, ctm = el?.getScreenCTM();
      if (!el || !ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const inside = p.x > -40 && p.x < 640 && p.y > 6 && p.y < 654;
      pointer.target = inside ? 1 : 0;
      if (inside) { pointer.x = p.x; pointer.y = p.y; }
    };
    const onLeave = () => { pointer.target = 0; };
    // Clicks and taps on the animation start a pulse (links and buttons on top of it keep their own job).
    const clicks: { x: number; up: boolean }[] = [];
    let lastClick = -1;
    const onDown = (e: PointerEvent) => {
      const el = svg.current, ctm = el?.getScreenCTM();
      if (!el || !ctm || (e.target as Element | null)?.closest?.("a, button, input, select, textarea, [role=button]")) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      if (p.x < 0 || p.x > 600 || p.y < 46 || p.y > 614 || e.timeStamp - lastClick < 150) return;
      lastClick = e.timeStamp;
      clicks.push({ x: p.x, up: p.y <= BASELINES[MAIN] });
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
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
      for (const c of clicks.splice(0)) if (pulses.length < 8) pulses.push(spawnAt(t, c.x, c.up));
      // keep a pulse until the most delayed line has seen it leave too
      pulses = pulses.filter((p) => {
        const age = t - DELAY_S * 3 - p.t0;
        return centre(p, age) - 2.5 * width(p, age) < X1 && Math.abs(p.amp) * Math.exp(-p.decay * age) > 1;
      });
      pointer.k += (pointer.target - pointer.k) * 0.06;
      const ex: Extras = { t, pointer };
      paths.current.forEach((el, i) => {
        const peak = displacement(i, pulses, t, out[i]);
        el?.setAttribute("d", linePath(i, out[i], ex));
        // a line glows a little while a wave passes through it (eased, so it never flickers)
        energy[i] += (peak - energy[i]) * 0.05;
        el?.setAttribute("stroke-opacity", String(Math.min(1, OPACITY[i] * (1 + 0.14 * energy[i]))));
      });
      // the colours drift sideways, one slow cycle in about 40 s
      const shift = 110 * Math.sin((2 * Math.PI * t) / 40);
      gradient.current?.setAttribute("x1", String(shift));
      gradient.current?.setAttribute("x2", String(600 + shift));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <svg
      ref={svg}
      className={className}
      viewBox="0 46 600 568"
      fill="none"
      role="img"
      aria-label="Seven lines repeating the same slow pulse, each fainter and flatter than the one before, like envelopes passing through"
    >
      <defs>
        <linearGradient ref={gradient} id="env-stroke" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
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
          d={linePath(i, new Float32Array(SAMPLES + 1), null)}
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
