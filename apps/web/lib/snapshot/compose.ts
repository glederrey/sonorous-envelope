import type { SoundFrame } from "./sound-recorder";

const STOPS: Array<[number, number, number]> = [
  [4, 5, 24], // dark navy
  [86, 28, 110], // violet
  [190, 55, 90],
  [250, 140, 40], // orange
  [252, 245, 200], // pale yellow
];

/** Magma-like colour map, 0..1 to RGB 0..255. */
export function heat(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export interface ComposeOptions {
  width?: number;
  pictureHeight?: number;
  spectroHeight?: number;
  base: string;
  layers: Array<HTMLCanvasElement | null>;
  frames: SoundFrame[];
  floorDb?: number;
  ceilDb?: number;
  label?: string;
  /** The Strudel view (`.pl-strudel`) as the listener sees it: its dark backdrop, the drawings at their opacity, and the code on top
   *  (tester report v0.22.0: the model saw a bright pianoroll without the code or the dimming the listener saw). */
  strudel?: HTMLElement | null;
  /** performance.now() ms when the current sound arrived: a thin line marks it on the spectrogram (older columns are the sound before) */
  markAt?: number;
}

function drawCover(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number) {
  if (!src.width || !src.height) return;
  const scale = Math.max(w / src.width, h / src.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
}

const num = (v: string | null | undefined, d: number) => { const x = parseFloat(v ?? ""); return Number.isFinite(x) ? x : d; };

/** Draws the Strudel view into the picture area, mapped the way `drawCover` maps a full-view canvas (cover, centred). */
function drawStrudel(ctx: CanvasRenderingContext2D, root: HTMLElement, w: number, h: number) {
  const view = root.getBoundingClientRect();
  if (!view.width || !view.height) return;
  const rootOp = num(root.style.opacity, 1);
  if (rootOp <= 0.01 || root.style.visibility === "hidden") return;
  const s = Math.max(w / view.width, h / view.height), ox = (w - view.width * s) / 2, oy = (h - view.height * s) / 2;
  const cs = getComputedStyle(root), hue = num(cs.getPropertyValue("--pl-h"), 220), k = num(root.style.getPropertyValue("--sv-k"), 1);
  ctx.save();
  ctx.globalAlpha = rootOp;
  // the backdrop: the same radial gradient as the CSS (.pl-strudel)
  const g = ctx.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, Math.max(w, h) * 0.9);
  g.addColorStop(0, `hsl(${hue} 32% ${9 * k}%)`); g.addColorStop(1, `hsl(${hue} 36% ${4 * k}%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const cv = root.querySelector<HTMLCanvasElement>(".pl-strudel-cv");
  if (cv) { ctx.globalAlpha = rootOp * num(cv.style.opacity, 1); drawCover(ctx, cv, w, h); }
  const pre = root.querySelector<HTMLElement>(".pl-strudel-code");
  const codeOp = pre ? num(pre.style.opacity, 1) * num(getComputedStyle(pre).opacity, 1) : 0;
  if (pre && codeOp > 0.01 && getComputedStyle(pre).display !== "none") {
    ctx.globalAlpha = rootOp * codeOp;
    const pcs = getComputedStyle(pre);
    ctx.font = `${num(pcs.fontSize, 14) * s}px ${pcs.fontFamily}`;
    ctx.textBaseline = "top"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 8 * s; ctx.shadowOffsetY = s;
    const range = document.createRange(), walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    // each text node in runs of characters on one line, at the place the browser laid them out
    for (let node = walk.nextNode() as Text | null; node; node = walk.nextNode() as Text | null) {
      ctx.fillStyle = getComputedStyle(node.parentElement ?? pre).color;
      const text = node.data;
      let run = "", x0 = 0, y0 = 0;
      const flush = () => { if (run.trim()) ctx.fillText(run, ox + (x0 - view.left) * s, oy + (y0 - view.top) * s); run = ""; };
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const r = range.getBoundingClientRect();
        if (text[i] === "\n" || !r.width) { flush(); continue; }
        if (r.top > view.bottom) break;
        if (run && Math.abs(r.top - y0) > 2) flush();
        if (!run) { x0 = r.left; y0 = r.top; }
        run += text[i];
      }
      flush();
    }
  }
  ctx.restore();
}

export function composeSnapshot(opts: ComposeOptions): HTMLCanvasElement {
  const width = opts.width ?? 512;
  const ph = opts.pictureHeight ?? 288;
  const sh = opts.spectroHeight ?? 128;
  const floor = opts.floorDb ?? -100;
  const ceil = opts.ceilDb ?? -20;
  const { frames } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = ph + sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.font = "11px system-ui";
  ctx.textBaseline = "top";

  // Picture
  ctx.fillStyle = opts.base;
  ctx.fillRect(0, 0, width, ph);
  for (const layer of opts.layers) if (layer) drawCover(ctx, layer, width, ph);
  if (opts.strudel) drawStrudel(ctx, opts.strudel, width, ph);

  // Spectrogram
  ctx.fillStyle = "#04051a";
  ctx.fillRect(0, ph, width, sh);
  let covered = 0;
  if (frames.length) {
    const bands = frames[0].bands.length;
    const img = ctx.createImageData(width, sh);
    const span = ceil - floor;
    for (let x = 0; x < width; x++) {
      const f = frames[Math.min(frames.length - 1, Math.floor((x / width) * frames.length))];
      for (let y = 0; y < sh; y++) {
        // Low frequencies at the bottom.
        const band = Math.min(bands - 1, Math.floor(((sh - 1 - y) / sh) * bands));
        const [r, g, b] = heat((f.bands[band] - floor) / span);
        const o = (y * width + x) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, ph);
    covered = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / 1000 : 0;
  }

  // Separator
  ctx.fillStyle = "#000";
  ctx.fillRect(0, ph, width, 1);
  if (frames.length > 1 && opts.markAt !== undefined && opts.markAt > frames[0].t) {
    const i = frames.findIndex((f) => f.t >= opts.markAt!);
    if (i > 0) { // the columns are one frame each, stretched to the width
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(Math.round((i / frames.length) * width), ph + 1, 2, sh - 1);
    }
  }

  // Labels
  const tag = (text: string, x: number, y: number, align: CanvasTextAlign) => {
    const w = ctx.measureText(text).width;
    const bx = align === "right" ? x - w - 6 : x;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bx, y, w + 6, 15);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(text, bx + 3, y + 2);
  };
  if (frames.length) {
    tag("40 Hz–12 kHz", 4, ph + 4, "left");
    tag(`${Math.round(covered)} s`, width - 4, ph + sh - 19, "right");
  } else {
    ctx.fillStyle = "#aab";
    ctx.textAlign = "left";
    ctx.fillText("no sound recorded", 8, ph + sh / 2 - 6);
  }
  if (opts.label) tag(opts.label, 4, 4, "left");

  return canvas;
}

export function toJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.72): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export function dataUrlBase64(url: string): { mime: string; base64: string } {
  const m = /^data:([^;,]+)(?:;[^,]*)*;base64,(.*)$/s.exec(url);
  if (!m) throw new Error("not a base64 data URL");
  return { mime: m[1], base64: m[2] };
}
