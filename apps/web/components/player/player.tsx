"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Eye, EyeOff, Play, Sun, Volume2, VolumeX } from "lucide-react";
import type { EngineState } from "@sonorous/engine";
import { hardCaps, parseSettings, type ListenerSettings } from "@sonorous/shared";
import { createClient } from "../../lib/supabase/browser";
import { CopyLink } from "../copy-link";
import { QrLink } from "../qr-link";
import { AudioOutput } from "./audio";

type Phase = "joining" | "ready" | "ended" | "error";
interface Playing { state: EngineState; seed: number; turn: number; final: boolean; at: number }

const STALE_MID_TURN_MS = 20_000;
const HEARTBEAT_MS = 20_000;

function stored(id: string) {
  const fallback = { muted: false, volume: 0.8, echo: 0.5 };
  try {
    const raw = localStorage.getItem(`se:player:${id}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
function remember(id: string, value: object) {
  try { localStorage.setItem(`se:player:${id}`, JSON.stringify(value)); } catch { /* private window */ }
}
function deviceId() {
  try {
    let d = localStorage.getItem("se:device");
    if (!d) { d = crypto.randomUUID().slice(0, 12); localStorage.setItem("se:device", d); }
    return d;
  } catch { return crypto.randomUUID().slice(0, 12); }
}

function age(sec: number) {
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  return `${Math.round(sec / 3600)} h ago`;
}

export function Player({ sessionId, signedIn }: { sessionId: string; signedIn: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("joining");
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [echo, setEcho] = useState(0.5);
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [audioState, setAudioState] = useState<string>("running");
  const [keepAwake, setKeepAwake] = useState(false);
  const [hidden, setHidden] = useState(false); // hides the panels so only the colour field is left

  const audio = useRef<AudioOutput | null>(null);
  const settings = useRef<ListenerSettings>(parseSettings({}));
  const latest = useRef<Playing | null>(null);
  const known = useRef(false);
  const reload = useRef<() => void>(() => {});
  const controls = useRef({ muted, volume, echo, started });
  controls.current = { muted, volume, echo, started };

  // restore the listener's own settings once, on the client
  useEffect(() => {
    const s = stored(sessionId);
    setMuted(Boolean(s.muted)); setVolume(Number(s.volume)); setEcho(Number(s.echo));
  }, [sessionId]);

  const apply = useCallback((row: { effective: EngineState; seed: number; turn: number; final: boolean; created_at: string }) => {
    const at = new Date(row.created_at).getTime();
    if (latest.current && at <= latest.current.at) return; // an older state, or the one already playing
    const state: EngineState = JSON.parse(JSON.stringify(row.effective));
    hardCaps(state, settings.current); // second line of defence, the server already limited it
    const next = { state, seed: Number(row.seed), turn: row.turn, final: row.final, at };
    latest.current = next;
    setPlaying(next);
    audio.current?.setState(state, next.seed);
  }, []);

  // load the current state, then follow changes. The link is the only credential: no account, no sign-in.
  useEffect(() => {
    let cancelled = false;
    let ended = false;
    const load = async () => {
      if (ended) return;
      const { data, error } = await supabase.rpc("get_player_state", { p_session: sessionId });
      if (cancelled) return;
      if (error || !data) {
        // a missing session is final; a network blip after the first load is not
        if (!known.current) { setPhase("error"); setMessage(error ? "Could not open this player. Try again in a moment." : "This session was not found."); }
        return;
      }
      known.current = true;
      settings.current = parseSettings(data.settings);
      if (data.ended) { ended = true; setPhase("ended"); return; }
      if (data.state) apply(data.state);
      setPhase((p) => (p === "joining" ? "ready" : p));
    };
    reload.current = () => void load();
    void load();
    // the broadcast is only a nudge; the real state always comes from get_player_state
    const channel = supabase.channel(`player:${sessionId}`)
      .on("broadcast", { event: "state" }, () => void load())
      .on("broadcast", { event: "session" }, () => void load())
      .subscribe();
    // a slow poll as a safety net if the live connection drops
    // keep polling in the background while audio is playing: the listener is in another app, and the sound must still follow Claude
    const poll = setInterval(() => { if (document.visibilityState === "visible" || controls.current.started) void load(); }, 5000);
    return () => { cancelled = true; reload.current = () => {}; clearInterval(poll); void supabase.removeChannel(channel); };
  }, [supabase, sessionId, apply]);

  // heartbeat: tells the model who is listening and with what controls
  const beat = useCallback(async () => {
    const c = controls.current;
    await supabase.rpc("player_heartbeat", {
      p_session: sessionId, p_device: deviceId(),
      p_audio: !c.started ? "not_started" : c.muted ? "muted" : "playing",
      p_volume: c.volume, p_delay: c.echo,
    });
  }, [supabase, sessionId]);

  useEffect(() => {
    if (phase !== "ready") return;
    void beat();
    const t = setInterval(() => { if (document.visibilityState === "visible" || controls.current.started) void beat(); }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [phase, beat]);
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => void beat(), 600);
    return () => clearTimeout(t);
  }, [muted, volume, echo, started, phase, beat]);

  // listener controls go to the engine and are remembered
  useEffect(() => {
    audio.current?.setGain(muted ? 0 : volume);
    audio.current?.setDelay(echo, settings.current.max_delay_mix);
    remember(sessionId, { muted, volume, echo });
  }, [muted, volume, echo, sessionId, started]);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  // Coming back to the page (phone unlocked, tab switched back): catch up at once instead of waiting for the poll,
  // and try to restart the audio if the phone interrupted it.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible") return;
      reload.current();
      void audio.current?.resume();
      void beat();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); };
  }, [beat]);

  // keep the screen on, if the listener asks for it (the lock is released when the page is hidden, so ask again on return)
  useEffect(() => {
    if (!keepAwake || !started || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const ask = async () => {
      try { lock = await navigator.wakeLock.request("screen"); if (cancelled) void lock.release(); } catch { /* refused, e.g. low battery */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void ask(); };
    void ask();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release(); };
  }, [keepAwake, started]);

  // lock screen and headset controls: play and pause map to unmute and mute
  useEffect(() => {
    if (!started || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: "Claude's sound", artist: "Sonorous Envelope", album: "Live session" });
    ms.setActionHandler("play", () => { setMuted(false); void audio.current?.resume(); });
    ms.setActionHandler("pause", () => setMuted(true));
    return () => { ms.setActionHandler("play", null); ms.setActionHandler("pause", null); };
  }, [started]);
  useEffect(() => {
    if (started && "mediaSession" in navigator) navigator.mediaSession.playbackState = muted ? "paused" : "playing";
  }, [started, muted]);

  // status clock
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => { void audio.current?.close(); }, []);

  async function start() {
    setStarting(true);
    try {
      const out = await AudioOutput.start();
      audio.current = out;
      out.watch(setAudioState);
      out.setGain(muted ? 0 : volume);
      out.setDelay(echo, settings.current.max_delay_mix);
      if (latest.current) out.setState(latest.current.state, latest.current.seed);
      setStarted(true);
    } catch {
      setMessage("Your browser could not start audio.");
    } finally { setStarting(false); }
  }

  const colour = playing?.state.colour;
  const fieldStyle = {
    "--pl-h": colour?.h ?? 220, "--pl-s": colour?.s ?? 0.15, "--pl-l": colour?.l ?? 0.12,
    "--pl-h2": colour?.secondary?.h ?? ((colour?.h ?? 220) + 25), "--pl-s2": colour?.secondary?.s ?? colour?.s ?? 0.15,
    "--pl-l2": colour?.secondary?.l ?? Math.max(0, (colour?.l ?? 0.12) - 0.08),
    "--pl-t": `${Math.max(1, playing?.state.transition.time ?? 1)}s`,
    "--pl-pulse": colour?.pulseHz ? `${1 / Math.min(3, colour.pulseHz)}s` : "0s",
  } as CSSProperties;

  void tick;
  const ageSec = playing ? Math.max(0, Math.round((Date.now() - playing.at) / 1000)) : 0;
  const midTurn = Boolean(playing && !playing.final && Date.now() - playing.at < STALE_MID_TURN_MS);

  const shareText = signedIn
    ? "Anyone with the link can listen. Nobody else can change anything."
    : "Want Claude to make sound for you too?";
  const shareAction = signedIn
    ? <CopyLink path={`/s/${sessionId}`} label="Copy link" />
    : <a className="se-btn" href="/#add">Add it to your Claude</a>;

  return (
    <div
      className="pl-field" style={fieldStyle}
      data-motion={reduced ? "still" : colour?.motion ?? "still"} data-texture={colour?.texture ?? "flat"}
    >
      <main className="pl-stage">
        {phase === "joining" && <p className="pl-note" role="status">Opening the player…</p>}
        {phase === "error" && <p className="pl-note" role="alert">{message}</p>}
        {phase === "ended" && (
          <div className="pl-note" role="status">
            <p style={{ margin: 0 }}>This session has ended.</p>
          </div>
        )}
        {phase === "ready" && !started && (
          <div className="pl-start">
            <p className="pl-lede">Someone&apos;s Claude is making this sound. It starts quietly, and you stay in control of the volume.</p>
            <button type="button" className="se-btn se-btn-primary pl-start-btn" onClick={start} disabled={starting}>
              {starting ? "Starting…" : "Start listening"}
            </button>
            {message && <p className="pl-note" role="alert">{message}</p>}
          </div>
        )}
        {phase === "ready" && started && hidden && (
          <button type="button" className="se-btn pl-reveal" onClick={() => setHidden(false)}>
            <Eye size={18} aria-hidden />
            Show controls
          </button>
        )}
        {phase === "ready" && started && !hidden && (
          <section className="pl-panel" aria-label="Listening controls">
            <div className="pl-bar">
              <p className="pl-status se-sm">
                <span className={midTurn ? "pl-dot" : "pl-dot pl-dot-idle"} aria-hidden />
                {playing
                  ? `Turn ${playing.turn} · ${midTurn ? "Claude is mid-answer" : `changed ${age(ageSec)}`}`
                  : "Waiting for the first sound"}
              </p>
              <button type="button" className="se-btn se-btn-icon pl-icon-btn" onClick={() => setHidden(true)} aria-label="Hide controls" title="Hide controls">
                <EyeOff size={18} aria-hidden />
              </button>
            </div>

            {audioState !== "running" ? (
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
              <label className="pl-slider">
                <span>Echo</span>
                <input type="range" min={0} max={1} step={0.01} value={echo} style={{ "--fill": `${echo * 100}%` } as CSSProperties}
                  onChange={(e) => setEcho(Number(e.target.value))} />
                <output>{Math.round(echo * 100)}</output>
              </label>
              <p className="pl-local se-sm">Only changes what you hear on this device.</p>
            </div>

            <div className="pl-share se-sm">
              <p>{shareText}</p>
              <div className="pl-actions">
                {shareAction}
                {"wakeLock" in navigator && (
                  <button type="button" className="se-btn" aria-pressed={keepAwake} onClick={() => setKeepAwake((k) => !k)}>
                    <Sun size={16} aria-hidden />
                    {keepAwake ? "Screen stays on" : "Keep screen on"}
                  </button>
                )}
                <div className="pl-hide-phone"><QrLink path={`/s/${sessionId}`} /></div>
              </div>
            </div>
          </section>
        )}
        {(phase === "ended" || (phase === "ready" && !started)) && <aside className="pl-aside se-sm"><p style={{ margin: 0 }}>{shareText}</p>{shareAction}</aside>}
      </main>
    </div>
  );
}
