"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EyeOff, Lock, Maximize2, Play, Volume2, VolumeX } from "lucide-react";
import { QrLink } from "../qr-link";

/** The listening controls of the player, as a plain component: everything it shows comes in as props, so the player fills it from a live
 *  session and /dev/controls fills it with made-up state to look at the layout. The owner's block and the Strudel code panel arrive as `middle`. */
export interface ControlsPanelProps {
  debug?: ReactNode;
  midTurn: boolean;
  faceLabel: string;
  faceTitle: string;
  strudelTag: boolean;
  locked: boolean;
  when: string;
  onHide: () => void;
  onFullscreen: () => void;
  audioState: string;
  muted: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  volume: number;
  onVolume: (v: number) => void;
  /** null: no picture toggles (the canvas is off) */
  picture: { gradientOn: boolean; visualsOn: boolean; onGradient: () => void; onVisuals: () => void } | null;
  /** the owner's block or the listener's: given the Gradient/Scenes toggles, it places them in its "Visuals" section */
  middle: ReactNode | ((picture: ReactNode) => ReactNode);
  extra?: ReactNode;
  shareText: string;
  shareAction: ReactNode;
  qrPath: string;
}

/** The turn text ("Turn 3 · 12 s ago") sits in the middle of the top row; a panel narrower than this (px) has no room for it and drops it. */
export const WHEN_MIN_WIDTH = 430;

export function ControlsPanel(p: ControlsPanelProps & { /** the width under which the turn text is dropped (the lab tries values) */ whenMinWidth?: number; onWidth?: (w: number) => void }) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(1000);
  const onWidth = p.onWidth;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { const w = el.getBoundingClientRect().width; setWidth(w); onWidth?.(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onWidth]);
  const showWhen = width >= (p.whenMinWidth ?? WHEN_MIN_WIDTH);
  return (
    <section ref={ref} className="pl-panel pl-panel-clip" aria-label="Listening controls">
      <div className="pl-panel-scroll">
      {p.debug}
      <div className="pl-bar">
        <p className="pl-status se-sm">
          <span className={p.midTurn ? "pl-dot" : "pl-dot pl-dot-idle"} aria-hidden />
          <span className="pl-face" title={p.faceTitle}>{p.faceLabel}{p.strudelTag ? " · Strudel" : ""}{p.locked && <><Lock size={12} aria-hidden /><span className="se-visually-hidden"> (locked by the owner)</span></>}</span>
        </p>
        {showWhen ? <p className="pl-when se-sm">{p.when}</p> : <span className="pl-when" />}
        <div className="pl-bar-btns">
          <button type="button" className="se-btn se-btn-icon pl-icon-btn" onClick={p.onFullscreen} aria-label="Fullscreen" title="Only the picture: no header, controls or footer. Touch the picture to show the exit button; Esc leaves too.">
            <Maximize2 size={18} aria-hidden />
          </button>
          <button type="button" className="se-btn se-btn-icon pl-icon-btn" onClick={p.onHide} aria-label="Hide controls" title="Hide controls">
            <EyeOff size={18} aria-hidden />
          </button>
        </div>
      </div>

      {p.audioState !== "running" && !p.muted ? (
        <button type="button" className="se-btn se-btn-primary pl-mute" onClick={p.onResume}>
          <Play size={22} aria-hidden />
          Sound stopped. Tap to resume
        </button>
      ) : (
        <button type="button" className="se-btn pl-mute" aria-pressed={p.muted} onClick={p.onToggleMute}>
          {p.muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
          {p.muted ? "Muted. Tap to unmute" : "Mute"}
        </button>
      )}

      <div className="pl-sliders">
        <label className="pl-slider">
          <span>Volume</span>
          <input type="range" min={0} max={1} step={0.01} value={p.volume} style={{ "--fill": `${p.volume * 100}%` } as CSSProperties}
            onChange={(e) => p.onVolume(Number(e.target.value))} />
          <output>{Math.round(p.volume * 100)}</output>
        </label>
      </div>

      {(() => {
        const picture = p.picture && (
        <div className="pl-toggles">
          <button type="button" className="se-btn pl-toggle" aria-pressed={p.picture.gradientOn} onClick={p.picture.onGradient}>
            <span className="pl-check" aria-hidden />Gradient
          </button>
          <button type="button" className="se-btn pl-toggle" aria-pressed={p.picture.visualsOn} onClick={p.picture.onVisuals}>
            <span className="pl-check" aria-hidden />Scenes
          </button>
        </div>
        );
        return typeof p.middle === "function" ? p.middle(picture) : <>{picture}{p.middle}</>;
      })()}
      {/* What the AI is doing: information, not controls (the code playing, what the model set, what the AI can see), in one quiet
          card so it does not read as more buttons. Hidden when none of its blocks renders. */}
      {p.extra && <section className="pl-info" aria-label="What the AI is doing"><p className="pl-info-title">What the AI is doing</p>{p.extra}</section>}

      <div className="pl-share se-sm">
        <p>{p.shareText}</p>
        <div className="pl-actions">
          {p.shareAction}
          <div className="pl-hide-phone"><QrLink path={p.qrPath} /></div>
        </div>
      </div>
      </div>
    </section>
  );
}
