"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { beatsAt, tempoAt, type EngineState } from "@sonorous/engine";
import { drawFrame, type Frame } from "@sonorous/shared";
import { BeatClock } from "../../lib/beat-clock";

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
        const frame = drawFrame({ colour: c, bpm: tempoAt(s.state, Math.max(0, tau)), beats, t: now / 1000, seed: s.seed & 0xffff }, w / h);
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
