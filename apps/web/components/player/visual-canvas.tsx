"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { beatsAt, tempoAt, type EngineState } from "@sonorous/engine";
import { drawFrame, EMPTY_FRAME, hslToRgb, scaleFrame, type Frame, type SceneName } from "@sonorous/shared";
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
  /** false: no moving gradient (the lab compares with and without) */
  play?: boolean;
  /** false: no scene (the listener turned the visuals off) */
  visuals?: boolean;
  /** the canvas could not be used: the parent falls back to the CSS field */
  onFail: () => void;
}

interface SceneSpec { scene: SceneName | "none"; density?: number; speed?: number; epoch: number }
const SCALE_START = 1, SCALE_MIN = 0.3; // the canvas starts at the device's own resolution (up to 2x the CSS size); a slow device steps it down below

export function VisualCanvas({ source, clockOffset, latency, active, play = true, visuals = true, onFail }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const veils = useRef<Array<{ cv: HTMLCanvasElement; img: ImageData | null; key: unknown; colour?: string }>>([]); // the small canvas each veil layer is drawn into before it is smoothed up
  const live = useRef({ source, active, latency, play, visuals, onFail });
  live.current = { source, active, latency, play, visuals, onFail }; // read inside the loop: a new callback or source must never restart it (a restart redraws the picture from nothing)

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) { live.current.onFail(); return; }
    const clock = new BeatClock();
    let raf = 0, scale = SCALE_START, w = 1, h = 1, last = 0, ema = 16, wasEmpty = true, failed = false;
    let epochs = 0, curSig: string | null = null, curScene = null as SceneSpec | null, fromScene = null as SceneSpec | null, fadeStart = 0, fadeDur = 1.5; // the scene being replaced fades out while the new one fades in
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

    const MIN_LINE = 0.7; // device pixels: the thinnest line the painter draws (capFrame counts it in the area)
    const paint = (f: Frame, hue: number) => {
      ctx.clearRect(0, 0, w, h);
      const m = Math.min(w, h);
      const hsla = (dh: number, l: number, a: number, abs?: number, sat = 55) => `hsla(${Math.round(abs ?? hue + dh)},${sat}%,${l}%,${a})`;
      if (f.wash > 0) { ctx.fillStyle = `rgba(255,255,255,${f.wash})`; ctx.fillRect(0, 0, w, h); }
      if (f.glow) {
        const g = f.glow, r = Math.max(1, g.r * m), grad = ctx.createRadialGradient(g.x * w, g.y * h, 0, g.x * w, g.y * h, r);
        grad.addColorStop(0, `rgba(255,255,255,${g.a})`); grad.addColorStop(Math.min(0.95, g.hold), `rgba(255,255,255,${g.a})`); grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }
      let vi = 0;
      for (const l of f.layers) {
        if (l.a <= 0.0005) continue;
        if (l.kind === "tint") {
          // a light of another hue, at the lightness that leaves the brightness alone: a wide soft radial gradient
          const r = Math.max(1, l.r * m), g = ctx.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, r);
          g.addColorStop(0, hsla(0, l.l ?? 50, l.a, l.hue, l.sat ?? 60)); g.addColorStop(0.55, hsla(0, l.l ?? 50, l.a * 0.5, l.hue, l.sat ?? 60)); g.addColorStop(1, hsla(0, l.l ?? 50, 0, l.hue, l.sat ?? 60));
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        } else if (l.kind === "blob") {
          const r = Math.max(1, l.r * m), sx = l.sx ?? 1, g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, hsla(l.dh, l.l ?? 88, l.a, l.hue, l.sat ?? 30)); g.addColorStop(0.3, hsla(l.dh, l.l ?? 88, l.a * 0.85, l.hue, l.sat ?? 30)); g.addColorStop(1, hsla(l.dh, l.l ?? 88, 0, l.hue, l.sat ?? 30));
          ctx.setTransform(sx, 0, 0, 1, l.x * w, l.y * h); ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.setTransform(1, 0, 0, 1, 0, 0);
        } else if (l.kind === "veil" && l.grid && l.gw && l.gh) {
          // a low-resolution field in one colour, its opacity per cell (the scene blends the two time steps around now, so it changes every frame): written into a small canvas and smoothed up over the view at the layer's opacity
          const slot = (veils.current[vi] ??= { cv: document.createElement("canvas"), img: null as ImageData | null, key: null as unknown });
          vi++;
          const cv = slot.cv, vctx = cv.getContext("2d");
          if (vctx) {
            if (cv.width !== l.gw || cv.height !== l.gh || !slot.img) { cv.width = l.gw; cv.height = l.gh; slot.img = vctx.createImageData(l.gw, l.gh); slot.colour = ""; }
            const img = slot.img, d = img.data, colour = `${l.hue}|${l.sat}|${l.l}`;
            if (slot.colour !== colour) { const [R, G, B] = hslToRgb(l.hue ?? 0, (l.sat ?? 10) / 100, (l.l ?? 90) / 100); for (let q = 0; q < l.grid.length; q++) { d[4 * q] = R; d[4 * q + 1] = G; d[4 * q + 2] = B; } slot.colour = colour; }
            for (let q = 0; q < l.grid.length; q++) d[4 * q + 3] = Math.round(255 * l.grid[q]);
            vctx.putImageData(img, 0, 0);
          }
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.globalAlpha = Math.min(1, l.a); ctx.drawImage(slot.cv, 0, 0, w, h); ctx.globalAlpha = 1;
        } else if (l.ys && l.cols && l.h) {
          // a curtain: one gradient in local coordinates (bright at the lower edge, fading upwards), moved to each column's edge
          const H = l.h * h, n = l.ys.length, cw = w / n, g = ctx.createLinearGradient(0, -H, 0, H * 0.1);
          g.addColorStop(0, hsla(l.dh, l.l ?? 80, 0, l.hue, l.sat ?? 30)); g.addColorStop(0.9, hsla(l.dh, l.l ?? 80, l.a, l.hue, l.sat ?? 30)); g.addColorStop(1, hsla(l.dh, l.l ?? 80, 0, l.hue, l.sat ?? 30));
          ctx.fillStyle = g;
          for (let i = 0; i < n; i++) {
            const k = l.cols[i]; if (k <= 0.02) continue;
            ctx.setTransform(1, 0, 0, 1, 0, l.ys[i] * h); ctx.globalAlpha = k; ctx.fillRect(i * cw, -H, cw + 1, H * 1.1);
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
        }
      }
      for (const i of f.items) {
        const col = hsla(i.dh ?? 0, i.l ?? 88, i.a, i.hue, i.sat);
        ctx.fillStyle = ctx.strokeStyle = col;
        if (i.kind === "dot" && i.soft && i.soft > 0.05) {
          const r = Math.max(1, i.r * m * 1.6), g = ctx.createRadialGradient(i.x * w, i.y * h, 0, i.x * w, i.y * h, r);
          g.addColorStop(0, col); g.addColorStop(Math.min(0.95, 1 - i.soft), col); g.addColorStop(1, hsla(i.dh ?? 0, i.l ?? 88, 0, i.hue, i.sat));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(i.x * w, i.y * h, r, 0, Math.PI * 2); ctx.fill();
        }
        else if (i.kind === "dot") { ctx.beginPath(); ctx.arc(i.x * w, i.y * h, Math.max(0.5, i.r * m), 0, Math.PI * 2); ctx.fill(); }
        else if (i.kind === "ring") {
          ctx.lineWidth = Math.max(MIN_LINE, i.w * m); ctx.beginPath();
          ctx.ellipse(i.x * w, i.y * h, Math.max(0.5, i.r * m), Math.max(0.3, i.r * m * (i.sq ?? 1)), 0, 0, Math.PI * 2); ctx.stroke();
        }
        else if (i.kind === "path" && i.pts && i.pts.length >= 4) {
          ctx.lineWidth = Math.max(MIN_LINE, i.w * m); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(i.pts[0] * w, i.pts[1] * h);
          for (let k = 2; k < i.pts.length; k += 2) ctx.lineTo(i.pts[k] * w, i.pts[k + 1] * h);
          ctx.stroke();
        }
        else if (i.kind === "leaf") {
          // a pointed leaf with a midrib, turned over by `sq`
          const L = Math.max(2, i.r * m);
          ctx.save(); ctx.translate(i.x * w, i.y * h); ctx.rotate(i.ang ?? 0); ctx.scale(Math.max(0.2, i.sq ?? 1), 1);
          ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(L * 0.8, -L * 0.1, 0, L); ctx.quadraticCurveTo(-L * 0.8, -L * 0.1, 0, -L); ctx.fill();
          ctx.strokeStyle = hsla(0, Math.max(10, (i.l ?? 50) - 22), i.a, i.hue, i.sat); ctx.lineWidth = Math.max(MIN_LINE, L * 0.07);
          ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(0, L * 1.12); ctx.stroke();
          ctx.restore();
        }
        else if (i.kind === "seed") {
          // a dandelion seed: a tiny body and a tuft of fine hairs
          const R = Math.max(3, i.r * m), x = i.x * w, y = i.y * h, a0 = i.ang ?? 0;
          ctx.lineWidth = MIN_LINE; ctx.beginPath();
          for (let k = 0; k < 9; k++) { const a = a0 + (k / 9) * Math.PI * 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); }
          ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, Math.max(1, R * 0.12), 0, Math.PI * 2); ctx.fill();
        }
        else if (i.kind === "wave") {
          // a line across the view: a sine (soft 1) or a zigzag (soft 0)
          const N = 40, amp = i.r * m, wl = Math.max(0.05, i.k ?? 0.4) * w, soft = i.soft ?? 1, ph = i.ph ?? 0;
          ctx.lineWidth = Math.max(MIN_LINE, i.w * m); ctx.beginPath();
          for (let n = 0; n <= N; n++) {
            const x = (n / N) * w, a = (2 * Math.PI * x) / wl + ph;
            const sine = Math.sin(a), tri = (2 / Math.PI) * Math.asin(sine);
            const y = i.y * h + amp * (tri + (sine - tri) * soft);
            n === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        else {
          // a streak runs from its tail along its angle; a drop's tail fades out behind it
          const len = i.r * m, ang = i.ang ?? 0, x0 = i.x * w, y0 = i.y * h, x1 = x0 + Math.sin(ang) * len, y1 = y0 + Math.cos(ang) * len;
          ctx.lineWidth = Math.max(MIN_LINE, i.w * m); ctx.lineCap = "round";
          if (i.tail) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, hsla(i.dh ?? 0, i.l ?? 88, 0, i.hue, i.sat)); g.addColorStop(1, col); ctx.strokeStyle = g; }
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
    };

    const loop = (now: number) => {
      if (failed) return;
      raf = requestAnimationFrame(loop);
      try {
        const { source: s, active: on, latency: lat, play: playOn, visuals: visualsOn } = live.current;
        if (!on || !s) { if (last) { ctx.clearRect(0, 0, w, h); last = 0; wasEmpty = true; clock.reset(); curSig = null; fromScene = null; } return; }
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
        // A change of scene (or of its density or speed) is a crossfade of at least 1.5 s, never a swap: the old picture fades out as the new one comes in.
        const sig = `${c.scene ?? "none"}|${c.density ?? 0.4}|${c.speed ?? 0.4}`;
        if (sig !== curSig) {
          if (curSig !== null && curScene) {
            const fading = fromScene !== null && (now - fadeStart) / 1000 < fadeDur * 0.5; // changed again early in a fade: keep fading out the first
            if (!fading) fromScene = curScene;
            fadeStart = now; fadeDur = Math.min(8, Math.max(1.5, tr.time));
          }
          if (curScene?.scene !== (c.scene ?? "none")) epochs++; // a scene that starts is a new epoch: the sunbeam rolls a new lean
          curSig = sig; curScene = { scene: c.scene ?? "none", density: c.density, speed: c.speed, epoch: epochs };
        }
        const fk = fromScene ? Math.min(1, (now - fadeStart) / 1000 / fadeDur) : 1;
        if (fk >= 1) fromScene = null;
        const raw = lvl === 0 ? EMPTY_FRAME : drawFrame({ colour: c, bpm: tempoAt(s.state, Math.max(0, tau)), beats, t: now / 1000, seed: s.seed & 0xffff, epoch: curScene?.epoch ?? 0, play: playOn, visuals: visualsOn, px: w, from: fromScene ? { ...fromScene, k: fk } : undefined }, w / h, MIN_LINE / Math.min(w, h));
        const frame: Frame = lvl >= 0.999 || lvl === 0 ? raw : scaleFrame(raw, lvl ** 1.7); // the ear hears the level on a log scale, so the picture falls a little faster than the gain to keep up with the sound
        const empty = frame.wash === 0 && !frame.glow && frame.items.length === 0 && frame.layers.length === 0;
        if (!(empty && wasEmpty)) paint(frame, c.h); // a still state is not repainted 60 times a second
        wasEmpty = empty;
        // a slow phone gets a smaller picture, not a stutter
        if (last) { ema = ema * 0.95 + (now - last) * 0.05; if (ema > 24 && scale > SCALE_MIN) { scale = Math.max(SCALE_MIN, scale * 0.8); ema = 16; resize(); wasEmpty = false; } }
        last = now;
      } catch {
        // a canvas bug must not break the page: stop, and let the parent bring back the CSS field
        failed = true; cancelAnimationFrame(raf); live.current.onFail();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [clockOffset]);

  return <canvas ref={ref} className="pl-motion" aria-hidden />;
}
