"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Play, Volume2, VolumeX } from "lucide-react";
import { beatsAt, type EngineState } from "@sonorous/engine";
import { frozenGrid, hardCaps } from "@sonorous/shared";
import { CopyLink } from "../copy-link";
import { QrLink } from "../qr-link";
import { AudioOutput } from "../player/audio";
import { VisualCanvas } from "../player/visual-canvas";
import { sliderToGain } from "../../lib/volume";
import { remember, stored } from "../../lib/player-prefs";
import { VizStore } from "../../lib/strudel/viz";
import type { StrudelOutput } from "../../lib/strudel/output";

// Strudel's picture is loaded when a Strudel moment shows (it brings the drawing code of Strudel with it)
const StrudelView = dynamic(() => import("../player/strudel-view").then((m) => m.StrudelView), { ssr: false });

/** A saved moment as /m reads it (get_saved_moment, migration 0027): never the owner or the session. */
export interface MomentData {
  id: string;
  name: string;
  savedBy: "human" | "ai";
  createdAt: string;
  effective: EngineState;
  /** the state's own seed */
  seed: number;
  /** voiceSeedOf(session id) when it was saved: the grid's per-step randomness and the picture's seed */
  voiceSeed: number;
}

const PREFS_KEY = "moment"; // one volume for every saved moment on this device

/**
 * The page of a saved moment: one frozen state plays, from the start, in the same engine, the same Strudel sandbox frame and the same
 * picture as the session player, with the same player-side caps. It has no poll, no heartbeat and no owner controls: the listener has
 * Mute, Volume, Share and the QR code. `rename` is the owner's form, passed in by the page (a server component).
 */
export function MomentPlayer({ moment, mine, rename }: { moment: MomentData; mine: boolean; rename?: ReactNode }) {
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [audioState, setAudioState] = useState("running");
  const [reduced, setReduced] = useState(false);
  const [canvasOk, setCanvasOk] = useState(true);
  const [at, setAt] = useState(0); // when it started playing here (ms): the state's clock

  // The same safety net as the session player: the server's rules were applied when the state was written, this is the second line.
  const state = useMemo(() => {
    const s: EngineState = JSON.parse(JSON.stringify(moment.effective));
    hardCaps(s);
    s.grid = frozenGrid(s); // the beat on the state's own rate: it no longer steps from the rate before
    return s;
  }, [moment.effective]);
  const pattern = state.engine === "strudel" ? state.pattern : undefined;
  const pictureSeed = moment.voiceSeed & 0xffff;

  const audio = useRef<AudioOutput | null>(null);
  const strudel = useRef<StrudelOutput | null>(null);
  const startedAt = useRef(0);
  const clockOffset = useRef(0); // this page has no server clock to follow: the moment starts when Start is tapped
  const vizStore = useMemo(() => new VizStore(), []);
  const vizLevel = useRef(0), vizBeats = useRef(0), vizOpacity = useRef(0); // written by the visual canvas, read by the Strudel picture
  const latency = useCallback(() => (audio.current ? audio.current.latency : 0), []);
  const failCanvas = useCallback(() => setCanvasOk(false), []);

  useEffect(() => {
    const s = stored(PREFS_KEY);
    setMuted(Boolean(s.muted)); setVolume(Number(s.volume));
  }, []);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  useEffect(() => { audio.current?.setGain(muted ? 0 : sliderToGain(volume)); }, [muted, volume, started]);
  useEffect(() => {
    const t = setTimeout(() => remember(PREFS_KEY, { muted, volume }), 300);
    return () => clearTimeout(t);
  }, [muted, volume]);
  // Muted means paused, as in the session player: the lock-screen player and the keep-alive file follow it
  useEffect(() => {
    if (!started) return;
    if (muted) audio.current?.pauseElement(); else void audio.current?.resume();
  }, [started, muted]);
  useEffect(() => () => { strudel.current?.close(); strudel.current = null; void audio.current?.close(); }, []);

  async function start() {
    setStarting(true);
    try {
      const out = await AudioOutput.start();
      audio.current = out;
      out.watch(setAudioState);
      out.setGain(muted ? 0 : sliderToGain(volume));
      out.setGridSeed(moment.voiceSeed);
      startedAt.current = Date.now();
      setAt(startedAt.current);
      if (pattern) {
        out.setState({ ...state, volume: 0 }, moment.seed, 0, 0); // the synth is paused while the pattern plays
        void import("../../lib/strudel/output").then(({ StrudelOutput }) => {
          const a = audio.current;
          if (!a) return;
          strudel.current ??= new StrudelOutput(a.context, a.strudelBus, {
            cycleNow: () => beatsAt(state, Math.max(0, (Date.now() - startedAt.current) / 1000)) / 4,
            latency: () => audio.current?.latency ?? 0, viz: vizStore, onReport: () => {}, // nobody reads a keepsake's report
          });
          void strudel.current.play({ id: null, code: pattern.code, bpm: pattern.bpm, seed: moment.seed & 0xffff });
        });
      } else out.setState(state, moment.seed, 0, 0);
      setStarted(true);
    } catch {
      setMessage("Your browser could not start audio.");
    } finally { setStarting(false); }
  }

  const source = useMemo(() => (started ? { state, at, seed: pictureSeed } : null), [started, state, at, pictureSeed]);
  const strudelOn = Boolean(pattern) && canvasOk && !reduced;
  const colour = state.colour;
  // black until Start, then the colour fades in with the sound (lightness 0 is black whatever the hue)
  const fieldStyle = {
    "--pl-h": colour.h, "--pl-s": colour.s, "--pl-l": started ? colour.l : 0,
    "--pl-h2": colour.secondary?.h ?? colour.h + 25, "--pl-s2": colour.secondary?.s ?? colour.s, "--pl-l2": started ? colour.secondary?.l ?? Math.max(0, colour.l - 0.08) : 0,
    "--pl-t": "2.5s", "--pl-pulse": colour.pulseHz ? `${1 / Math.min(3, colour.pulseHz)}s` : "0s",
  } as CSSProperties;
  const by = moment.savedBy === "ai" ? "the AI" : mine ? "you" : "a listener";
  const date = new Date(moment.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      className="pl-field" style={fieldStyle}
      data-motion={reduced || canvasOk ? "still" : colour.motion ?? "still"} data-canvas={canvasOk && !reduced ? "on" : "off"} data-texture={colour.texture ?? "flat"} data-shape={colour.shape ?? "wash"}
    >
      {canvasOk && !reduced && (
        <VisualCanvas
          source={source} clockOffset={clockOffset} latency={latency} active={started} onFail={failCanvas}
          strudelView={strudelOn} levelOut={vizLevel} beatsOut={vizBeats} viewOpacity={vizOpacity}
        />
      )}
      {started && strudelOn && (
        <StrudelView store={vizStore} output={() => strudel.current} level={vizLevel} beats={vizBeats} shown opacity={vizOpacity} hue={colour.h} showCode />
      )}
      <main className="pl-stage">
        <section className="pl-panel" aria-label="Saved moment">
          <div>
            <h1 className="se-heading" style={{ margin: 0, overflowWrap: "anywhere" }}>{moment.name}</h1>
            <p className="se-sm" style={{ margin: "4px 0 0", color: "var(--on-scrim-muted)" }}>Saved by {by} · {date} · {pattern ? "Strudel" : "Synth"}</p>
          </div>
          {rename}
          {!started ? (
            <>
              <button type="button" className="se-btn se-btn-primary pl-start-btn" onClick={start} disabled={starting}>
                {starting ? "Starting…" : "Start listening"}
              </button>
              {message && <p className="se-sm" role="alert" style={{ margin: 0 }}>{message}</p>}
            </>
          ) : (
            <>
              {audioState !== "running" && !muted ? (
                <button type="button" className="se-btn se-btn-primary pl-mute" onClick={() => void audio.current?.resume()}>
                  <Play size={22} aria-hidden />
                  Sound stopped. Tap to resume
                </button>
              ) : (
                <button type="button" className="se-btn pl-mute" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
                  {muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
                  {muted ? "Muted. Tap to unmute" : "Mute"}
                </button>
              )}
              <div className="pl-sliders">
                <label className="pl-slider">
                  <span>Volume</span>
                  <input type="range" min={0} max={1} step={0.01} value={volume} style={{ "--fill": `${volume * 100}%` } as CSSProperties}
                    onChange={(e) => setVolume(Number(e.target.value))} />
                  <output>{Math.round(volume * 100)}</output>
                </label>
              </div>
            </>
          )}
          <div className="pl-share se-sm">
            <div className="pl-actions">
              <CopyLink path={`/m/${moment.id}`} />
              <div className="pl-hide-phone"><QrLink path={`/m/${moment.id}`} /></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
