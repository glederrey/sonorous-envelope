"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { beatsAt, tempoAt, type EngineState } from "@sonorous/engine";
import { drawFrame, EMPTY_FRAME, type Frame } from "@sonorous/shared";
import { BeatClock } from "../../lib/beat-clock";
import { isSounding } from "../../lib/sounding";

// The moving part of the colour field (docs/visuals.md): a canvas over the CSS gradient. It reads the beat from the shared timeline,
// asks the pure frame model (`drawFrame`, which also applies the flash budget) what to draw, and paints it. Nothing here decides how
// the picture looks; that is `packages/shared/src/visual.ts`, which tests can run without a canvas.

export interface VisualSource {
  state: EngineState;
  /** when the state was written, ms on the server's clock */
  at: number;
  seed: number;
}
interface Props {
  source: VisualSource | null;
  /** server clock minus ours, ms */
  clockOffset: MutableRefObject<number>;
  /** seconds from the audio being scheduled to the ear, with the listener's own nudge */
  latency: () => number;
  /** false: draw nothing (audio not started, or the listener asked for a still picture) */
  active: boolean;
  /** the canvas could not be used: the parent falls back to the CSS field */
  onFail: () => void;
}

const SCALE_START = 0.5, SCALE_MIN = 0.3;

export function VisualCanvas({ source, clockOffset, latency, active, onFail }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ source, active, latency });
  live.current = { source, active, latency };

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) { onFail(); return; }
    const clock = new BeatClock();
    let raf = 0, scale = SCALE_START, w = 1, h = 1, last = 0, ema = 16, wasEmpty = true, failed = false;
    let lvl = -1, lvlFrom = 1, lvlAt = 0, hold: number | null = null, rampStart: number | null = null, lvlKey = "", ramp0 = 0; // how much of the picture shows: it fades out with the sound after silence, and back in with the next sound

    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(r.width * dpr * scale)); h = Math.max(1, Math.round(r.height * dpr * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const paint = (f: Frame, tint: string) => {
      ctx.clearRect(0, 0, w, h);
      const m = Math.min(w, h);
      if (f.wash > 0) { ctx.fillStyle = `rgba(255,255,255,${f.wash})`; ctx.fillRect(0, 0, w, h); }
      if (f.glow) {
        const g = f.glow, r = Math.max(1, g.r * m), grad = ctx.createRadialGradient(g.x * w, g.y * h, 0, g.x * w, g.y * h, r);
        grad.addColorStop(0, `rgba(255,255,255,${g.a})`); grad.addColorStop(Math.min(0.95, g.hold), `rgba(255,255,255,${g.a})`); grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }
      for (const i of f.items) {
        ctx.fillStyle = ctx.strokeStyle = `hsla(${tint},${i.a})`;
        if (i.kind === "dot" && i.soft && i.soft > 0.05) {
          const r = Math.max(1, i.r * m * 1.6), g = ctx.createRadialGradient(i.x * w, i.y * h, 0, i.x * w, i.y * h, r);
          g.addColorStop(0, `hsla(${tint},${i.a})`); g.addColorStop(Math.min(0.95, 1 - i.soft), `hsla(${tint},${i.a})`); g.addColorStop(1, `hsla(${tint},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(i.x * w, i.y * h, r, 0, Math.PI * 2); ctx.fill();
        }
        else if (i.kind === "dot") { ctx.beginPath(); ctx.arc(i.x * w, i.y * h, Math.max(0.5, i.r * m), 0, Math.PI * 2); ctx.fill(); }
        else if (i.kind === "ring") { ctx.lineWidth = Math.max(1.5, i.w * m); ctx.beginPath(); ctx.arc(i.x * w, i.y * h, Math.max(0.5, i.r * m), 0, Math.PI * 2); ctx.stroke(); }
        else { ctx.lineWidth = Math.max(1.5, i.w * m); ctx.beginPath(); ctx.moveTo(i.x * w, i.y * h); ctx.lineTo(i.x * w, i.y * h + i.r * m); ctx.stroke(); }
      }
    };

    const loop = (now: number) => {
      if (failed) return;
      raf = requestAnimationFrame(loop);
      try {
        const { source: s, active: on, latency: lat } = live.current;
        if (!on || !s) { if (last) { ctx.clearRect(0, 0, w, h); last = 0; wasEmpty = true; clock.reset(); } return; }
        // the beat the ear is hearing now: the server's clock, minus the delay between the audio being scheduled and heard
        const tau = (Date.now() + clockOffset.current - s.at) / 1000 - lat();
        const target = beatsAt(s.state, Math.max(0, tau));
        const beats = clock.update(target, now);
        const c = s.state.colour;
        // A silent state (silence, the end of a session) fades the picture out over its transition, like the sound; a sounding state after it
        // fades it back in. The level follows the server's clock (tau), so every device fades together, and starts from where it was.
        const tr = s.state.transition, target01 = isSounding(s.state) ? 1 : 0, span = Math.max(1, tr.time), delay = tr.delay ?? 0;
        // A new state, or the same state turned silent on this device (the owner stopped Strudel: same `at`, a silent copy): the fade starts
        // from the level shown now. For the same `at` it starts now, not at the time the state was written (that was long ago: no fade at all).
        const key = `${s.at}|${target01}`;
        if (lvlKey !== key) {
          ramp0 = lvlAt === s.at ? tau : 0;
          lvlFrom = lvl < 0 ? target01 : lvl; lvlAt = s.at; lvlKey = key; rampStart = null;
          // Strudel comes in on the next bar: when the picture fades in from silence it waits for that bar, so it starts with the music
          const fromQuiet = lvlFrom < 0.5 && target01 === 1 && s.state.engine === "strudel" && Boolean(s.state.pattern);
          hold = fromQuiet ? Math.ceil(beatsAt(s.state, Math.max(0, (Date.now() + clockOffset.current - s.at) / 1000)) / 4 + 0.05) * 4 : null;
        }
        if (hold !== null && rampStart === null) { if (target >= hold) rampStart = tau; }
        const p = hold !== null ? (rampStart === null ? 0 : Math.min(1, Math.max(0, (tau - rampStart) / span))) : Math.min(1, Math.max(0, (tau - ramp0 - delay) / span));
        lvl = lvlFrom + (target01 - lvlFrom) * (p * p * (3 - 2 * p));
        if (lvl < 0.003) lvl = 0;
        const raw = lvl === 0 ? EMPTY_FRAME : drawFrame({ colour: c, bpm: tempoAt(s.state, Math.max(0, tau)), beats, t: now / 1000, seed: s.seed & 0xffff }, w / h);
        const frame: Frame = lvl >= 0.999 || lvl === 0 ? raw : { wash: raw.wash * lvl, glow: raw.glow ? { ...raw.glow, a: raw.glow.a * lvl } : null, items: raw.items.map((i) => ({ ...i, a: i.a * lvl })) };
        const empty = frame.wash === 0 && !frame.glow && frame.items.length === 0;
        if (!(empty && wasEmpty)) paint(frame, `${Math.round(c.h)},55%,88%`); // a still state is not repainted 60 times a second
        wasEmpty = empty;
        // a slow phone gets a smaller picture, not a stutter
        if (last) { ema = ema * 0.95 + (now - last) * 0.05; if (ema > 24 && scale > SCALE_MIN) { scale = Math.max(SCALE_MIN, scale * 0.8); ema = 16; resize(); wasEmpty = false; } }
        last = now;
      } catch {
        // a canvas bug must not break the page: stop, and let the parent bring back the CSS field
        failed = true; cancelAnimationFrame(raf); onFail();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [clockOffset, onFail]);

  return <canvas ref={ref} className="pl-motion" aria-hidden />;
}
