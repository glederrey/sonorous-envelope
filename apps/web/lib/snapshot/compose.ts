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
