"use client";

import { useEffect, useRef } from "react";

// Seven lines. The centre line carries the pulses: an envelope with a fast
// attack and a slow release that widens and fades as it travels right, and may
// go up, down, or up then down. Every other line repeats that shape, a little
// later and a little flatter the further it is from the centre (the fainter the
// line, the flatter its copy), with a small random spread per wave so the copies
// are not exact. Added life: a faint idle breathing on every line, a small
// undershoot after each wave, opacity that rises while a wave passes, a
// gradient that drifts, a ripple field the pointer disturbs, and a wave
// that runs both ways from wherever the visitor clicks.
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
// The ripple field: every line also carries a small damped wave (a row of springs). Moving the
// pointer across it kicks the lines; a click drops a bump that splits and runs left and right.
const SIM_C2 = 0.15;       // wave speed squared, in samples per step (about 150 px/s at 60 fps)
const SIM_DAMP = 0.012;
const SIM_SPRING = 0.0018; // pulls a line back to rest
const SIM_MAX = 22;        // px, so a ripple can never reach the next line
const KICK = 0.03;
// A click starts two waves that run left and right. Each grows from nothing to its height as it travels.
const CLICK_PX = 34;
const CLICK_SPEED = 170;   // px/s
const CLICK_GROW_S = 0.22; // time constant of the growth: about 90% of the height after half a second
const CLICK_DECAY = 0.45;  // per second
const CLICK_W0 = 26;       // px
type ClickWave = { t0: number; x: number; sign: number; y: number };
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

interface Extras { t: number; ripple: Float32Array }

/** The path of line i: the wave, the idle breathing and the ripple field added on the baseline. */
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
      y -= ex.ripple[k];
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

/** Advance one line's ripple field by one step: a damped wave equation with fixed ends. */
function stepRipple(h: Float32Array, v: Float32Array) {
  for (let k = 1; k < SAMPLES; k++) v[k] += SIM_C2 * (h[k - 1] + h[k + 1] - 2 * h[k]) - SIM_SPRING * h[k] - SIM_DAMP * v[k];
  for (let k = 1; k < SAMPLES; k++) h[k] = Math.max(-SIM_MAX, Math.min(SIM_MAX, h[k] + v[k]));
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
    const scratch = new Float32Array(SAMPLES + 1);
    const ripple = BASELINES.map(() => ({ h: new Float32Array(SAMPLES + 1), v: new Float32Array(SAMPLES + 1) }));
    const toSvg = (e: PointerEvent) => {
      const el = svg.current, ctm = el?.getScreenCTM();
      if (!el || !ctm) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      return p.x > -40 && p.x < 640 && p.y > 6 && p.y < 654 ? p : null;
    };
    const sampleAt = (x: number) => Math.round(((x - X0) / (X1 - X0)) * SAMPLES);
    let last: { x: number; y: number } | null = null;
    // Moving the pointer over the lines kicks the ones near it, away from the pointer, harder the faster it moves.
    const onMove = (e: PointerEvent) => {
      const p = toSvg(e);
      if (!p) { last = null; return; }
      const speed = last ? Math.min(60, Math.hypot(p.x - last.x, p.y - last.y)) : 0;
      last = { x: p.x, y: p.y };
      const c = sampleAt(p.x);
      if (speed < 0.5 || c < 1 || c >= SAMPLES) return;
      BASELINES.forEach((by, i) => {
        const near = Math.exp(-(((by - p.y) / 110) ** 2));
        if (near < 0.03) return;
        const push = KICK * speed * near * Math.tanh((p.y - by) / 25); // above the pointer: up, below: down
        for (let d = -2; d <= 2; d++) if (c + d > 0 && c + d < SAMPLES) ripple[i].v[c + d] += push * Math.exp(-(d * d) / 3);
      });
    };
    const onLeave = () => { last = null; };
    // A click or tap starts a small wave, up above the centre line and down below it, that runs both left and
    // right and grows as it goes (links and buttons on top keep their own job).
    const waves: ClickWave[] = [];
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("a, button, input, select, textarea, [role=button]")) return;
      const p = toSvg(e);
      if (!p || p.x < 0 || p.x > 600 || p.y < 46 || p.y > 614) return;
      if (waves.length < 8) waves.push({ t0: (e.timeStamp - start) / 1000, x: p.x, sign: p.y <= BASELINES[MAIN] ? 1 : -1, y: p.y });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
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
      for (let n = waves.length - 1; n >= 0; n--) if (t - waves[n].t0 > 5) waves.splice(n, 1);
      // keep a pulse until the most delayed line has seen it leave too
      pulses = pulses.filter((p) => {
        const age = t - DELAY_S * 3 - p.t0;
        return centre(p, age) - 2.5 * width(p, age) < X1 && Math.abs(p.amp) * Math.exp(-p.decay * age) > 1;
      });
      paths.current.forEach((el, i) => {
        stepRipple(ripple[i].h, ripple[i].v);
        const field = scratch;
        field.set(ripple[i].h);
        for (const w of waves) {
          const age = t - w.t0;
          const amp = w.sign * CLICK_PX * Math.exp(-(((BASELINES[i] - w.y) / 170) ** 2)) * (1 - Math.exp(-age / CLICK_GROW_S)) * Math.exp(-CLICK_DECAY * age);
          const wd = CLICK_W0 * (1 + 0.25 * age);
          for (const dir of [-1, 1]) {
            const cx = w.x + dir * CLICK_SPEED * age;
            for (let k = 0; k <= SAMPLES; k++) {
              const u = (X0 + ((X1 - X0) * k) / SAMPLES - cx) / wd;
              if (u > -3 && u < 3) field[k] += amp * Math.exp(-u * u);
            }
          }
        }
        const ex: Extras = { t, ripple: field };
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
