"use client";

import { useEffect, useRef, useState } from "react";

// The /v1 easter egg: /v1 redirects to /#v1 (next.config.ts) and the home page fires a few rockets over itself, in the brand colours.
// The canvas ignores the pointer, so the page stays usable; reduced motion skips it.

const LAUNCHES_MS = [0, 220, 520, 800, 1100, 1350, 1650, 1900, 2150];
const END_MS = 4200;

type Rocket = { x: number; y: number; ty: number; vy: number; color: string; done: boolean };
type Spark = { x: number; y: number; px: number; py: number; vx: number; vy: number; life: number; decay: number; color: string };

export function Fireworks() {
  const [on, setOn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.location.hash !== "#v1") return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setOn(true);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!on || !el || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    const colors = ["--glow", "--tide", "--ink"].map((v, i) => css.getPropertyValue(v).trim() || ["#f4a940", "#45c7b6", "#eceff3"][i]);
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const launch = () =>
      rockets.push({ x: w * (0.12 + Math.random() * 0.76), y: h + 10, ty: h * (0.12 + Math.random() * 0.33), vy: -h * (1.3 + Math.random() * 0.4), color: pick(colors), done: false });
    const burst = (r: Rocket) => {
      const n = 80;
      const speed = Math.min(w, h) * (0.35 + Math.random() * 0.15);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
        const s = speed * (0.4 + Math.random() * 0.6);
        sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.7 + Math.random() * 0.4, color: Math.random() < 0.8 ? r.color : pick(colors) });
      }
    };

    const timers = LAUNCHES_MS.map((t) => window.setTimeout(launch, t));
    const end = window.setTimeout(() => setOn(false), END_MS);
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (const r of rockets) {
        if (r.done) continue;
        r.y += r.vy * dt;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x, r.y + 18);
        ctx.stroke();
        if (r.y <= r.ty) {
          r.done = true;
          burst(r);
        }
      }
      ctx.lineWidth = 2.2;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.px = s.x;
        s.py = s.y;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + h * 0.45 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.life;
        ctx.strokeStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(s.px - (s.x - s.px) * 2, s.py - (s.y - s.py) * 2); // a short tail behind the spark
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(end);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [on]);

  return on ? <canvas ref={canvas} className="fw-canvas" aria-hidden="true" /> : null;
}
