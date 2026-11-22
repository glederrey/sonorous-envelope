"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const SHOW_MS = 3600; // fireworks, then a short fade, then "/"
const FADE_MS = 500;
const CALM_MS = 1600; // prefers-reduced-motion: the text only

type Rocket = { x: number; y: number; ty: number; vy: number; color: string; done: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export function Fireworks() {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      router.replace("/");
    };
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeAt = (calm ? CALM_MS : SHOW_MS) - FADE_MS;
    const fade = window.setTimeout(() => root.current?.classList.add("v1-out"), fadeAt);
    const done = window.setTimeout(leave, fadeAt + FADE_MS);
    window.addEventListener("pointerdown", leave);
    window.addEventListener("keydown", leave);
    const stop = () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
      window.removeEventListener("pointerdown", leave);
      window.removeEventListener("keydown", leave);
    };

    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (calm || !el || !ctx) return stop;

    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue("--bg").trim() || "#0c0e12";
    const colors = [css.getPropertyValue("--glow").trim() || "#f4a940", css.getPropertyValue("--tide").trim() || "#45c7b6", css.getPropertyValue("--ink").trim() || "#eceff3"];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    };
    size();
    window.addEventListener("resize", size);

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const launch = () =>
      rockets.push({ x: w * (0.15 + Math.random() * 0.7), y: h + 10, ty: h * (0.15 + Math.random() * 0.3), vy: -h * (1.3 + Math.random() * 0.4), color: pick(colors), done: false });
    const burst = (r: Rocket) => {
      const n = 70;
      const speed = Math.min(w, h) * (0.35 + Math.random() * 0.15);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
        const s = speed * (0.4 + Math.random() * 0.6);
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color: Math.random() < 0.8 ? r.color : pick(colors) });
      }
    };

    const launches = [0, 250, 600, 900, 1250, 1500, 1850, 2100, 2350];
    const timers = launches.map((t) => window.setTimeout(launch, t));
    let last = performance.now();
    let raf = requestAnimationFrame(function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.globalAlpha = 0.22; // trails: the old frame fades into the background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      for (const r of rockets) {
        if (r.done) continue;
        r.y += r.vy * dt;
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x - 1.5, r.y, 3, 10);
        if (r.y <= r.ty) {
          r.done = true;
          burst(r);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + h * 0.45 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 0.9;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      stop();
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [router]);

  return (
    <div ref={root} className="v1-show" aria-live="polite">
      <canvas ref={canvas} className="v1-canvas" aria-hidden="true" />
      <p className="v1-text">
        v1 <span className="v1-yay">\o/</span>
      </p>
    </div>
  );
}
