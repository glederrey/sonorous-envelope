"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { EngineState } from "@sonorous/engine";
import { hardCaps, parseSettings, type ListenerSettings } from "@sonorous/shared";
import { createClient } from "../../lib/supabase/browser";
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

export function Player({ sessionId }: { sessionId: string }) {
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

  const audio = useRef<AudioOutput | null>(null);
  const settings = useRef<ListenerSettings>(parseSettings({}));
  const latest = useRef<Playing | null>(null);
  const userId = useRef<string | null>(null);
  const controls = useRef({ muted, volume, echo, started });
  controls.current = { muted, volume, echo, started };

  // restore the listener's own settings once, on the client
  useEffect(() => {
    const s = stored(sessionId);
    setMuted(Boolean(s.muted)); setVolume(Number(s.volume)); setEcho(Number(s.echo));
  }, [sessionId]);

  const apply = useCallback((row: { effective: EngineState; seed: number; turn: number; final: boolean; created_at: string }) => {
    const at = new Date(row.created_at).getTime();
    if (latest.current && at < latest.current.at) return; // an older state arriving late
    const state: EngineState = JSON.parse(JSON.stringify(row.effective));
    hardCaps(state, settings.current); // second line of defence, the server already limited it
    const next = { state, seed: Number(row.seed), turn: row.turn, final: row.final, at };
    latest.current = next;
    setPlaying(next);
    audio.current?.setState(state, next.seed);
  }, []);

  // join, load the current state, then follow changes
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          if (!cancelled) { setPhase("error"); setMessage("Could not open this player. Try again in a moment."); }
          return;
        }
        user = data.user;
      }
      userId.current = user.id;
      const joined = await supabase.rpc("join_session", { p_session: sessionId });
      if (joined.error) {
        if (!cancelled) { setPhase("error"); setMessage("This session was not found, or it has ended."); }
        return;
      }

      const load = async () => {
        const { data: s } = await supabase.from("sessions").select("settings,ended_at,current_state_id").eq("id", sessionId).maybeSingle();
        if (cancelled || !s) return;
        settings.current = parseSettings(s.settings);
        if (s.ended_at) { setPhase("ended"); return; }
        if (s.current_state_id) {
          const { data: st } = await supabase.from("states").select("effective,seed,turn,final,created_at").eq("id", s.current_state_id).maybeSingle();
          if (st && !cancelled) apply(st);
        }
        setPhase((p) => (p === "joining" ? "ready" : p));
      };

      const channel = supabase.channel(`session:${sessionId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "states", filter: `session_id=eq.${sessionId}` },
          (payload) => apply(payload.new as never))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
          (payload) => {
            const row = payload.new as { settings?: unknown; ended_at?: string | null };
            if (row.settings) settings.current = parseSettings(row.settings);
            if (row.ended_at) setPhase("ended");
          })
        // subscribe first, then load, so no update falls between the two
        .subscribe((status) => { if (status === "SUBSCRIBED") void load(); });
      cleanup = () => { void supabase.removeChannel(channel); };
    })();
    return () => { cancelled = true; cleanup(); };
  }, [supabase, sessionId, apply]);

  // heartbeat: tells the model who is listening and with what controls
  const beat = useCallback(async () => {
    if (!userId.current) return;
    const c = controls.current;
    await supabase.from("player_heartbeats").upsert({
      session_id: sessionId, user_id: userId.current, device_id: deviceId(),
      audio: !c.started ? "not_started" : c.muted ? "muted" : "playing",
      volume: c.volume, delay: c.echo,
    }, { onConflict: "session_id,device_id" });
  }, [supabase, sessionId]);

  useEffect(() => {
    if (phase !== "ready") return;
    void beat();
    const t = setInterval(() => { if (document.visibilityState === "visible") void beat(); }, HEARTBEAT_MS);
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
        {phase === "ready" && started && (
          <section className="pl-panel" aria-label="Listening controls">
            <button
              type="button" className="se-btn pl-mute" aria-pressed={muted} onClick={() => setMuted((m) => !m)}
            >
              {muted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
              {muted ? "Muted. Tap to unmute" : "Mute"}
            </button>
            <label className="pl-slider">
              <span>Volume</span>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </label>
            <label className="pl-slider">
              <span>Echo</span>
              <input type="range" min={0} max={1} step={0.01} value={echo} onChange={(e) => setEcho(Number(e.target.value))} />
            </label>
            <p className="pl-status se-sm">
              {midTurn && <span className="pl-dot" aria-hidden />}
              {playing
                ? `Listening · turn ${playing.turn} · last change ${ageSec < 5 ? "just now" : `${ageSec} s ago`}${midTurn ? " · Claude is mid-answer" : ""}`
                : "Listening · waiting for the first sound"}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
