"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { beatsAt, tempoAt, type EngineState, type ResolvedColour } from "@sonorous/engine";
import { blendColour, drawFrame, EMPTY_FRAME, GLYPHS, hslToRgb, scaleFrame, type Frame, type SceneName } from "@sonorous/shared";
import { BeatClock } from "../../lib/beat-clock";
import { isSounding } from "../../lib/sounding";
import { picLog } from "../../lib/debug";

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
  /** seconds from the audio being scheduled to the ear,  */
  latency: () => number;
  /** false: draw nothing (audio not started, or the listener asked for a still picture) */
  active: boolean;
  /** false: no moving gradient (the lab compares with and without) */
  play?: boolean;
  /** false: no scene (the listener turned the visuals off) */
  visuals?: boolean;
  /** the canvas could not be used: the parent falls back to the CSS field */
  onFail: () => void;
  /** Strudel's own picture is shown (strudel-view.tsx): this canvas paints nothing, and only keeps the level and the beat, which that view reads */
  strudelView?: boolean;
  /** written every frame: how much of the picture shows (0 to 1, with the fades and the first-bar wait) and the beat the ear is at */
  levelOut?: MutableRefObject<number>;
  beatsOut?: MutableRefObject<number>;
  /** how opaque the Strudel view is: until it is, the scenes keep painting under it, so they cross-fade */
  viewOpacity?: MutableRefObject<number>;
}

interface SceneSpec { scene: SceneName | "none"; density?: number; speed?: number; epoch: number }
const SCALE_START = 1, SCALE_MIN = 0.3; // the canvas starts at the device's own resolution (up to 2x the CSS size); a slow device steps it down below

/** Seconds a scene takes at least to come in from nothing (the model's own transition counts when it is longer). */
const SCENE_FADE_IN = 2;

export function VisualCanvas({ source, clockOffset, latency, active, play = true, visuals = true, onFail, strudelView = false, levelOut, beatsOut, viewOpacity }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const veils = useRef<Array<{ cv: HTMLCanvasElement; img: ImageData | null; key: unknown; colour?: string }>>([]); // the small canvas each veil layer is drawn into before it is smoothed up
  const live = useRef({ source, active, latency, play, visuals, onFail, strudelView, levelOut, beatsOut, viewOpacity });
  live.current = { source, active, latency, play, visuals, onFail, strudelView, levelOut, beatsOut, viewOpacity }; // read inside the loop: a new callback or source must never restart it (a restart redraws the picture from nothing)

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) { live.current.onFail(); return; }
    const clock = new BeatClock();
    // With `?debug` in the address: what the picture sees (a mount, a new state, a jump of the beat, the scenes and the fades), as `[picture]` lines
    const dbg = picLog;
    let dbgAt = 0, dbgBeats = 0; dbg("mount");
    let raf = 0, scale = SCALE_START, w = 1, h = 1, last = 0, ema = 16, wasEmpty = true, failed = false;
    let epochs = 0, curSig: string | null = null, curScene = null as SceneSpec | null, fromScene = null as SceneSpec | null, fadeStart = 0, fadeDur = 1.5, oldLvl = 1; // the scene being replaced fades out while the new one fades in
    let shown: ResolvedColour | null = null, fromC: ResolvedColour | null = null, colAt = 0; // the colour the picture is drawn from: it glides from the colour before to the state's own over its transition
    let fadeMin = 1; // the shortest fade for the state now playing
    let prevTarget = -1, quietBefore = false; // the level the last state aimed for, and whether the state now playing came after a silence
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
          const kk = i.k ?? 0.5;
          ctx.beginPath();
          if (kk > 0.8) { // a lobed maple leaf: five points round a middle, notches between them
            for (let q = 0; q < 10; q++) { const a = (q / 10) * Math.PI * 2 - Math.PI / 2, rr = q % 2 === 0 ? L * (q === 0 ? 1.05 : 0.85) : L * 0.42; q ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath();
          } else { const wid = 0.25 + 1.05 * kk, cy = -L * (0.55 - 0.7 * kk); // a long narrow leaf to a broad round one, the belly lower on the broad ones
            ctx.moveTo(0, -L); ctx.quadraticCurveTo(L * wid, cy, 0, L); ctx.quadraticCurveTo(-L * wid, cy, 0, -L); }
          ctx.fill();
          ctx.strokeStyle = hsla(0, Math.max(10, (i.l ?? 50) - 22), i.a, i.hue, i.sat); ctx.lineWidth = Math.max(MIN_LINE, L * 0.07);
          ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(0, L * 1.12); ctx.stroke();
          ctx.restore();
        }
        else if (i.kind === "glyph") {
          // a character of the digital rain
          const size = Math.max(6, i.r * m); ctx.font = `${size}px ui-monospace, "Noto Sans Mono CJK JP", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(GLYPHS[(i.g ?? 0) % GLYPHS.length], i.x * w, i.y * h);
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
        if (!on || !s) { if (live.current.levelOut) live.current.levelOut.current = 0; if (last) { ctx.clearRect(0, 0, w, h); last = 0; wasEmpty = true; clock.reset(); curSig = null; fromScene = null; shown = null; colAt = 0; } return; }
        // the beat the ear is hearing now: the server's clock, minus the delay between the audio being scheduled and heard
        const tau = (Date.now() + clockOffset.current - s.at) / 1000 - lat();
        const target = beatsAt(s.state, Math.max(0, tau));
        const beats = clock.update(target, now);
        if (s.at !== dbgAt) { dbg("state", { at: s.at, tau: +tau.toFixed(2), vol: s.state.volume, delay: s.state.transition.delay ?? 0, scene: s.state.colour.scene }); dbgAt = s.at; }
        if (dbgBeats && Math.abs(beats - dbgBeats) > 0.5) dbg("beat jump", { from: +dbgBeats.toFixed(2), to: +beats.toFixed(2) });
        dbgBeats = beats;
        const toC = s.state.colour;
        if (colAt !== s.at) { fromC = shown ?? toC; colAt = s.at; }
        const trc = s.state.transition, pc = Math.min(1, Math.max(0, (tau - (trc.delay ?? 0)) / Math.max(1, trc.time)));
        const c = shown = fromC && trc.curve !== "sudden" ? blendColour(fromC, toC, pc * pc * (3 - 2 * pc)) : toC; // the server's clock again, so every device glides together
        // A silent state (silence, the end of a session) fades the picture out over its transition, like the sound; a sounding state after it
        // fades it back in. The level follows the server's clock (tau), so every device fades together, and starts from where it was.
        const tr = s.state.transition, target01 = isSounding(s.state) ? 1 : 0, span = Math.max(fadeMin, tr.time), delay = tr.delay ?? 0;
        // A new state, or the same state turned silent on this device (the owner stopped Strudel: same `at`, a silent copy): the fade starts
        // from the level shown now. For the same `at` it starts now, not at the time the state was written (that was long ago: no fade at all).
        const key = `${s.at}|${target01}`;
        if (lvlKey !== key) {
          quietBefore = prevTarget === 0; prevTarget = target01;
          dbg("level", { from: +(lvl < 0 ? target01 : lvl).toFixed(2), to: target01, span: +span.toFixed(2), delay, afterSilence: quietBefore });
          const sameAt = lvlAt === s.at;
          lvlFrom = lvl < 0 ? target01 : lvl; lvlAt = s.at; lvlKey = key; rampStart = null;
          // A fade in from nothing starts when the state arrives here, not when it was written: a state that arrives a second late would
          // otherwise pop in at a third of its level (v0.19.2 tests, test 8: tau 1.28 s at arrival, level 0 to 0.39 in one frame).
          ramp0 = sameAt ? tau : lvlFrom < 0.05 && target01 === 1 ? Math.max(0, tau - delay) : 0;
          fadeMin = lvlFrom < 0.05 && target01 === 1 && !(s.state.engine === "strudel" && s.state.pattern) ? SCENE_FADE_IN : 1;
          // Strudel comes in on the next bar: when the picture fades in from silence it waits for that bar, so it starts with the music
          const fromQuiet = lvlFrom < 0.5 && target01 === 1 && s.state.engine === "strudel" && Boolean(s.state.pattern);
          hold = fromQuiet ? Math.ceil(beatsAt(s.state, Math.max(0, (Date.now() + clockOffset.current - s.at) / 1000)) / 4 + 0.05) * 4 : null;
        }
        if (hold !== null && rampStart === null) { if (target >= hold) rampStart = tau; }
        const p = hold !== null ? (rampStart === null ? 0 : Math.min(1, Math.max(0, (tau - rampStart) / span))) : Math.min(1, Math.max(0, (tau - ramp0 - delay) / span));
        const lvlShown = Math.max(0, lvl); // the level painted last frame: an old scene that is kept fades out from there
        lvl = lvlFrom + (target01 - lvlFrom) * (p * p * (3 - 2 * p));
        if (lvl < 0.003) lvl = 0;
        const { levelOut: lo, beatsOut: bo, strudelView: sv } = live.current;
        if (lo) lo.current = lvl;
        if (bo) bo.current = beats;
        // Strudel's picture is on top: nothing to paint here. The scenes that are showing keep painting until that view is opaque, so
        // the two cross-fade; coming from nothing there is nothing to keep. The scene bookkeeping starts again when the scenes come back
        // (no slow fade in from a scene that was never painted).
        if (sv && (wasEmpty || (live.current.viewOpacity?.current ?? 1) >= 0.98)) {
          if (!wasEmpty) { ctx.clearRect(0, 0, w, h); wasEmpty = true; }
          curSig = null; curScene = null; fromScene = null;
          last = now; return;
        }
        // Nothing shows: forget the scene that was showing, so a scene that comes in later fades in from nothing and never cross-fades from the old one.
        if (lvl === 0) { curSig = null; curScene = null; fromScene = null; }
        // A change of scene (or of its density or speed) is a crossfade of at least 1.5 s, never a swap: the old picture fades out as the new one comes in.
        const sig = `${c.scene ?? "none"}|${c.density ?? 0.4}|${c.speed ?? 0.4}`;
        if (lvl > 0 && sig !== curSig) { // nothing shows at level 0: no scene starts there (it logged and counted a new scene every frame of a silence)
          if (curSig !== null && curScene) {
            const fading = fromScene !== null && (now - fadeStart) / 1000 < fadeDur * 0.5; // changed again early in a fade: keep fading out the first
            // The old scene fades out from the level it was painted at last frame, not the new state's level (it showed at 0.39 when it had
            // faded to almost nothing, v0.19.2 tests); one that had all but faded out is dropped.
            if (!fading) { if (lvlShown < 0.05) fromScene = null; else { fromScene = curScene; oldLvl = Math.min(1, lvlShown); } }
            // after a silence the old scene is only what was fading out with the sound: it finishes at once, so it never shows under the new one
            fadeStart = now; fadeDur = quietBefore ? 0.6 : Math.min(8, Math.max(1.5, tr.time));
            dbg("scene", { from: curScene.scene, to: c.scene ?? "none", fade: +fadeDur.toFixed(2), level: +lvlShown.toFixed(2), kept: fromScene !== null });
          } else if (curSig === null) dbg("scene", { from: null, to: c.scene ?? "none", level: +lvl.toFixed(2) });
          if (curScene?.scene !== (c.scene ?? "none")) epochs++; // a scene that starts is a new epoch: the sunbeam rolls a new lean
          curSig = sig; curScene = { scene: c.scene ?? "none", density: c.density, speed: c.speed, epoch: epochs };
        }
        const fk = fromScene ? Math.min(1, (now - fadeStart) / 1000 / fadeDur) : 1;
        if (fk >= 1) fromScene = null;
        const raw = lvl === 0 ? EMPTY_FRAME : drawFrame({ colour: c, bpm: tempoAt(s.state, Math.max(0, tau)), beats, t: now / 1000, seed: s.seed & 0xffff, epoch: curScene?.epoch ?? 0, play: playOn, visuals: visualsOn, px: w, from: fromScene ? { ...fromScene, k: 1 - (1 - fk) * (lvl > oldLvl ? (oldLvl / lvl) ** 1.7 : 1) } : undefined }, w / h, MIN_LINE / Math.min(w, h));
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
    return () => { dbg("unmount"); cancelAnimationFrame(raf); ro.disconnect(); };
  }, [clockOffset]);

  return <canvas ref={ref} className="pl-motion" aria-hidden />;
}
