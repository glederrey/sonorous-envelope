"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Eye, EyeOff, Lock, Play, Volume2, VolumeX } from "lucide-react";
import { beatsAt, type EngineState } from "@sonorous/engine";
import { hardCaps, isResting, parseSettings, voiceSeedOf, type ListenerSettings } from "@sonorous/shared";
import { createClient } from "../../lib/supabase/browser";
import { CopyLink } from "../copy-link";
import { QrLink } from "../qr-link";
import { sliderToGain } from "../../lib/volume";
import { restedState } from "../../lib/rested-state";
import { isSounding } from "../../lib/sounding";
import { unwrapHue } from "../../lib/hue";
import { WhatClaudeSet } from "./what-claude-set";
import { AudioOutput } from "./audio";
import { VisualCanvas } from "./visual-canvas";
import { OwnerControls } from "./owner-controls";
import { StrudelPanel } from "./strudel-panel";
import type { StrudelOutput } from "../../lib/strudel/output";
import { effectiveRestAfter, normalizeFace, type Face, type Policy } from "../../lib/mcp/modes";

type Phase = "joining" | "ready" | "ended" | "error";
interface Playing { state: EngineState; seed: number; turn: number; final: boolean; at: number; id?: string }

const STALE_MID_TURN_MS = 20_000;
const HEARTBEAT_MS = 20_000;

function stored(id: string) {
  const fallback = { muted: false, volume: 0.8 };
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
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [audioState, setAudioState] = useState<string>("running");
  const [rested, setRested] = useState(false); // the sound has faded because the model has not updated for rest_after
  const [hidden, setHidden] = useState(false); // hides the panels so only the colour field is left
  const [face, setFace] = useState<Face>("internal"); // the face playing now (the model switches it, or the owner locks it)
  const [policy, setPolicy] = useState<Policy>("auto");
  // the moving picture (canvas): the listener can turn it off, nudge its timing for devices that cannot report their delay, and
  // ?field=css brings back the old CSS motion
  const [stillPicture, setStillPicture] = useState(false);
  const [nudgeMs, setNudgeMs] = useState(0);
  const [canvasOk, setCanvasOk] = useState(true);
  const nudge = useRef(0);
  // Strudel (roadmap #18): the model's code plays in a sandbox on the external face, if the owner allows it. The listener may stop it here.
  const [allowCode, setAllowCode] = useState(true);
  const strudel = useRef<StrudelOutput | null>(null);
  const engineCtl = useRef({ face: "internal" as Face, allowCode: true });
  engineCtl.current = { face, allowCode };
  const reported = useRef(new Set<string>());
  // The owner locked the face or switched code off while this state played. When they allow it again the synth keeps playing until the
  // model sends something new: the old song does not come back on its own. (Stopping and playing the pattern here is the listener's own button.)
  const ownerBlocked = useRef<number | null>(null);
  const [blockedAt, setBlockedAt] = useState<number | null>(null);
  const [dimDelay, setDimDelay] = useState(0); // seconds the dark layer waits before it lifts (Strudel's first bar)
  const [dimAnimated, setDimAnimated] = useState(false); // the dark layer snaps at the first paint (a late joiner after silence sees black), then glides
  const block = (at: number) => { ownerBlocked.current = at; setBlockedAt(at); };

  const audio = useRef<AudioOutput | null>(null);
  const lastHue = useRef({ h: 220, h2: 245 });
  const settings = useRef<ListenerSettings>(parseSettings({}));
  const latest = useRef<Playing | null>(null);
  const known = useRef(false);
  const reload = useRef<() => void>(() => {});
  const knownV = useRef<string | null>(null); // version of the state we hold: the poll then answers `same` when nothing changed
  const lastGridSync = useRef(0);
  // ?debug=1 shows what the page did while it was in the background, to find where a phone cuts it off
  const [debug, setDebug] = useState(false);
  const dbg = useRef({ hiddenAt: 0, ticks: 0, ok: 0, err: 0, applied: 0, wok: 0, werr: 0, stopped: 0, lastErr: "" });
  const [dbgText, setDbgText] = useState("Leave this page, then come back: this line tells what happened while you were away.");
  useEffect(() => setDebug(new URLSearchParams(window.location.search).has("debug")), []);
  const controls = useRef({ muted, volume, started });
  controls.current = { muted, volume, started };

  // restore the listener's own settings once, on the client
  useEffect(() => {
    const s = stored(sessionId);
    setMuted(Boolean(s.muted)); setVolume(Number(s.volume));
  }, [sessionId]);

  // the picture's own settings, per device: ?field=css keeps the old CSS motion
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("se:picture") ?? "{}") as { still?: boolean; nudge?: number };
      setStillPicture(Boolean(v.still)); const n = Number.isFinite(v.nudge) ? Math.min(400, Math.max(0, Number(v.nudge))) : 0; setNudgeMs(n); nudge.current = n;
    } catch { /* private window */ }
    if (new URLSearchParams(window.location.search).get("field") === "css") setCanvasOk(false);
  }, []);
  const rememberPicture = (still: boolean, n: number) => { try { localStorage.setItem("se:picture", JSON.stringify({ still, nudge: n })); } catch { /* private window */ } };
  const pictureLatency = useCallback(() => (audio.current ? audio.current.latency : 0) + nudge.current / 1000, []);
  const failCanvas = useCallback(() => setCanvasOk(false), []);

  /** Strudel is on for this state when the model asked for it, the face is external, the owner allows code. */
  const patternOn = (p: Playing) => {
    const c = engineCtl.current;
    return p.state.engine === "strudel" && Boolean(p.state.pattern) && c.face === "external" && c.allowCode && ownerBlocked.current !== p.at;
  };
  const cycleNow = useCallback(() => {
    const p = latest.current;
    if (!p) return 0;
    return beatsAt(p.state, Math.max(0, (Date.now() + clockOffset.current - p.at) / 1000)) / 4;
  }, []);
  const ensureStrudel = useCallback(async () => {
    if (strudel.current || !audio.current) return strudel.current;
    const { StrudelOutput } = await import("../../lib/strudel/output");
    const a = audio.current;
    if (!a || strudel.current) return strudel.current;
    strudel.current = new StrudelOutput(a.context, a.strudelBus, {
      cycleNow, latency: () => audio.current?.latency ?? 0,
      onReport: (id, r) => {
        // only the owner's device may report, and each state once: the model reads it as data from the player
        if (!id || reported.current.has(id)) return;
        reported.current.add(id);
        // supabase-js sends a query only when it is awaited or given .then, so `void` alone would send nothing
        supabase.rpc("report_pattern", { p_state: id, p_ok: r.ok, p_error: r.error ?? null, p_events: r.eventsPerCycle ?? null, p_notes: r.notes }).then(() => {}, () => {});
      },
    });
    return strudel.current;
  }, [supabase, cycleNow]);
  /** Send a state to the right engine: the pattern into Strudel (the synth paused), anything else into the synth. */
  const runEngine = useCallback((p: Playing, delay = 0, elapsed?: number) => {
    const a = audio.current;
    if (!a) return;
    if (patternOn(p)) {
      a.setState({ ...p.state, volume: 0 }, p.seed, delay, elapsed); // the synth is paused: it fades out over the transition
      void ensureStrudel().then((o) => o?.play({ id: p.id ?? null, code: p.state.pattern!.code, bpm: p.state.pattern!.bpm, seed: p.seed & 0xffff }));
    } else {
      // The pattern fades out, at most 3 s, and the new synth state starts when that fade is almost done, so a closing sound does not
      // overlap it (a stop already under way is not restarted).
      // A silent state (silence, a session end) fades Strudel over its own transition, like the picture; a state that brings a synth sound
      // fades it in at most 3 s and starts when that is almost done.
      const quiet = p.state.volume <= 0.001;
      const fadeLen = quiet ? Math.max(0.3, p.state.transition.time) : Math.min(3, Math.max(0.3, p.state.transition.time));
      const left = strudel.current?.stop(fadeLen, delay) ?? 0;
      a.setState(p.state, p.seed, quiet ? delay : Math.max(delay, left - 0.5), elapsed);
    }
  }, [ensureStrudel]);
  // the owner locked the face or switched code off: the same state goes to the other engine
  useEffect(() => {
    const p = latest.current;
    if (!p || !audio.current || p.state.engine !== "strudel" || restedFrom.current) return;
    if (face !== "external" || !allowCode) {
      block(p.at);
      // The owner turned Strudel off or locked the internal face: the sound and the picture fade to nothing, not to the leftover synth state
      // (the faces are different voices; the model's next set_sound brings the internal one). The state loses its pattern, so the picture
      // does not count it as sounding.
      const { engine: _engine, pattern: _pattern, ...rest } = p.state;
      const state: EngineState = { ...rest, volume: 0, transition: { time: 3, curve: "smooth" } };
      latest.current = { ...p, state }; // this is now the state that plays here: allowing Strudel again must not bring the synth fields back
      setPlaying({ ...p, state });
      runEngine({ ...p, state }, 0, Math.max(0, (Date.now() + clockOffset.current - p.at) / 1000));
      return;
    }
    runEngine(p, 0, Math.max(0, (Date.now() + clockOffset.current - p.at) / 1000));
  }, [face, allowCode, runEngine]);

  const apply = useCallback((row: { id?: string; effective: EngineState; seed: number; turn: number; final: boolean; created_at: string }) => {
    const at = new Date(row.created_at).getTime();
    if (latest.current && at <= latest.current.at) return; // an older state, or the one already playing
    const state: EngineState = JSON.parse(JSON.stringify(row.effective));
    hardCaps(state); // second line of defence, the server already applied the safety rules
    const next = { state, seed: Number(row.seed), turn: row.turn, final: row.final, at, id: row.id };
    // Strudel starts on the next bar: when it comes in from silence the picture fades in on that bar too, not before the music
    const wasSounding = latest.current ? isSounding(latest.current.state) : true;
    const ageNow = (Date.now() + clockOffset.current - at) / 1000;
    if (!wasSounding && state.engine === "strudel" && state.pattern) {
      const bars = beatsAt(state, Math.max(0, ageNow)) / 4;
      setDimDelay((Math.ceil(bars + 0.05) - bars) * 240 / state.pattern.bpm + pictureLatency());
    } else setDimDelay(0);
    latest.current = next;
    restedFrom.current = null; setRested(false); // a new state brings the sound back, with its own transition
    if (document.visibilityState === "hidden") dbg.current.applied++;
    // a state with a delay (the closing fade after a closing sound) waits that long from when it was written; the engine
    // keeps the timing, and the colour waits the same time
    const age = (Date.now() + clockOffset.current - at) / 1000;
    const delay = state.transition.delay ?? 0;
    const wait = Math.max(0, delay - age);
    if (wait > 0) setTimeout(() => { if (latest.current === next) setPlaying(next); }, wait * 1000);
    else setPlaying(next);
    // `elapsed`: seconds since the state started, by the server's clock, so this device lands on the shared step grid
    runEngine(next, wait, Math.max(age, delay)); // seconds since it was written, at the moment it starts
  }, [pictureLatency]);

  // Presence between turns: with no update for rest_after seconds the sound fades to silence on its own (no state is
  // written). The clock is the server's: offset = server time minus ours, taken from get_player_state.
  const clockOffset = useRef(0);
  const clockSamples = useRef<Array<{ rtt: number; offset: number }>>([]);
  // The offset between the server's clock and ours, from the request with the shortest round trip among the last twelve:
  // a short trip means the least time spent on the network, so the midpoint is the best guess for when the server answered.
  const noteClock = (serverMs: number, t0: number, t1: number) => {
    const list = clockSamples.current; list.push({ rtt: t1 - t0, offset: serverMs - (t0 + t1) / 2 });
    if (list.length > 12) list.shift();
    clockOffset.current = list.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
  };
  const restedFrom = useRef<Playing | null>(null);
  const restedAtMs = useRef(0); // the fade to silence takes 30 s: "Fading" until then, "Faded" after
  const restTick = useCallback(() => {
    const p = latest.current, r = settings.current.rest_after;
    if (!p || (p.state.engine === "strudel" && p.state.pattern)) return; // a pattern keeps playing: the external face never fades
    if (p.state.volume <= 0.001) return; // already silent (a silence, an owner stop): nothing to fade, and the rested state would wipe the scene at once
    const resting = r !== null && isResting(p.at, r, Date.now() + clockOffset.current);
    if (resting && !restedFrom.current) {
      restedFrom.current = p; restedAtMs.current = Date.now(); setRested(true);
      const state = restedState(p.state);
      setPlaying({ ...p, state });
      audio.current?.setState(state, p.seed);
    } else if (!resting && restedFrom.current && restedFrom.current.at === p.at) {
      // the owner or Claude turned the fade off or made it longer: bring the same state back
      const orig = restedFrom.current; restedFrom.current = null; setRested(false);
      const state: EngineState = JSON.parse(JSON.stringify(orig.state));
      state.transition = { time: Math.max(3, orig.state.transition.time), curve: "smooth" };
      setPlaying({ ...orig, state });
      audio.current?.setState(state, orig.seed);
    }
  }, []);

  // load the current state, then follow changes. The link is the only credential: no account, no sign-in.
  useEffect(() => {
    let cancelled = false;
    let ended = false;
    let busy = false; // one check at a time: the timers, the poll and the broadcast must not pile up requests
    const load = async () => {
      if (ended || busy) return;
      busy = true;
      try { await check(); } finally { busy = false; }
    };
    const check = async () => {
      let result: Awaited<ReturnType<typeof supabase.rpc>>;
      const t0 = Date.now();
      try {
        result = await supabase.rpc("player_poll", { p_session: sessionId, p_known: knownV.current });
      } catch (e) {
        result = { data: null, error: { message: String(e) } } as unknown as typeof result;
      }
      const { data, error } = result;
      if (data && typeof data === "object" && "now" in data && data.now) noteClock(Date.parse(String(data.now)), t0, Date.now());
      if (document.visibilityState === "hidden") {
        if (error) { dbg.current.err++; dbg.current.lastErr = String(error.message ?? error).slice(0, 80); } else dbg.current.ok++;
      }
      handle(data, error);
    };
    // shared by the page's own check and by the worker's check
    const handle = (data: { same?: boolean; v?: string; settings?: unknown; ended?: boolean; now?: string; mode?: string; mode_policy?: string; allow_code?: boolean; state?: Parameters<typeof apply>[0] } | null, error: unknown) => {
      if (cancelled) return;
      if (data?.same) {
        // nothing changed since the version we have: a few bytes came back. Still pull the step grid onto the shared one now and then.
        if (latest.current && !restedFrom.current && Date.now() - lastGridSync.current > 5000) {
          lastGridSync.current = Date.now();
          audio.current?.syncGrid(Math.max(0, (Date.now() + clockOffset.current - latest.current.at) / 1000));
        }
        restTick();
        return;
      }
      if (data?.v) { knownV.current = data.v; ticker?.postMessage({ known: data.v }); }
      if (error || !data) {
        // a missing session is final; a network blip after the first load is not
        if (!known.current) { setPhase("error"); setMessage(error ? "Could not open this player. Try again in a moment." : "This session was not found."); }
        return;
      }
      known.current = true;
      lastGridSync.current = Date.now();
      const f = normalizeFace(data.mode);
      const pol: Policy = data.mode_policy === "internal" || data.mode_policy === "external" ? data.mode_policy : "auto";
      setFace(f); setPolicy(pol); setAllowCode(data.allow_code !== false);
      const parsed = parseSettings(data.settings);
      settings.current = { ...parsed, rest_after: effectiveRestAfter(parsed.rest_after, f) }; // the external face never fades
      if (data.now && clockSamples.current.length === 0) clockOffset.current = Date.parse(data.now) - Date.now(); // a first guess, from the worker
      if (data.ended) {
        ended = true;
        // play the closing state first (silence with end): show "ended" once its fade is over
        let wait = 0;
        if (data.state) {
          apply(data.state);
          const age = Date.now() + clockOffset.current - new Date(data.state.created_at).getTime();
          const fade = (data.state.effective.transition?.delay ?? 0) + (data.state.effective.transition?.time ?? 0);
          if (controls.current.started && age < (fade + 5) * 1000) wait = Math.max(0, fade * 1000 - age) + 500;
        }
        setTimeout(() => { if (cancelled) return; setPhase("ended"); strudel.current?.close(); strudel.current = null; void audio.current?.close(); audio.current = null; }, wait);
        return;
      }
      if (data.state) apply(data.state);
      // joined while the owner has Strudel off or the face locked: the old pattern must not start when they allow it again
      if ((f !== "external" || data.allow_code === false) && latest.current?.state.engine === "strudel") block(latest.current.at);
      // now and then, pull this device's step grid back onto the shared one (audio clocks drift apart slowly)
      if (data.state && latest.current && !restedFrom.current) {
        const age = (Date.now() + clockOffset.current - latest.current.at) / 1000;
        audio.current?.syncGrid(Math.max(0, age)); // seconds since the state was written (the engine ignores it while a delayed state waits)
      }
      restTick();
      setPhase((p) => (p === "joining" ? "ready" : p));
    };
    reload.current = () => void load();
    void load();
    // the broadcast is only a nudge; the real state always comes from get_player_state
    const channel = supabase.channel(`player:${sessionId}`)
      .on("broadcast", { event: "state" }, () => void load())
      .on("broadcast", { event: "session" }, () => void load())
      .subscribe();
    // a poll every second: when nothing changed the answer is a few bytes (player_poll), so it is cheap
    // keep polling in the background while audio is playing: the listener is in another app, and the sound must still follow Claude
    const poll = setInterval(() => { if (document.visibilityState === "visible" || controls.current.started) void load(); }, 1000);
    // The page's own timers and requests are throttled in the background. A dedicated worker has its own timer and its
    // own network access, so it asks for the state itself and hands the answer to the page, which applies it.
    let ticker: Worker | null = null;
    let tickerUrl = "";
    let visFn: (() => void) | null = null;
    try {
      const code = `
        let cfg = null, busy = false;
        onmessage = (e) => { cfg = Object.assign(cfg || {}, e.data); };
        setInterval(async () => {
          postMessage({ tick: 1 });
          if (!cfg || busy || !cfg.away) return; // the page does its own checks while it is visible
          busy = true;
          try {
            const r = await fetch(cfg.url + "/rest/v1/rpc/player_poll", {
              method: "POST", headers: { apikey: cfg.key, "content-type": "application/json" },
              body: JSON.stringify({ p_session: cfg.id, p_known: cfg.known || null }),
            });
            postMessage({ status: r.status, data: r.ok ? await r.json() : null });
          } catch (err) { postMessage({ error: String(err) }); }
          busy = false;
        }, 3000);`;
      tickerUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      ticker = new Worker(tickerUrl);
      ticker.postMessage({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, id: sessionId });
      visFn = () => ticker?.postMessage({ away: document.visibilityState === "hidden" });
      document.addEventListener("visibilitychange", visFn);
      visFn();
      ticker.onmessage = (e: MessageEvent) => {
        const hidden = document.visibilityState === "hidden";
        const m = e.data as { tick?: number; status?: number; data?: Parameters<typeof handle>[0]; error?: string };
        if (m.tick) {
          restTick(); // the worker's timer is not throttled in the background
          if (hidden) {
            dbg.current.ticks++;
            // sample the audio while away: the state read on return says nothing about what happened meanwhile
            const a = audio.current;
            if (a && (a.state !== "running" || !a.keepAlivePlaying)) dbg.current.stopped++;
          }
          return;
        }
        if (!hidden || !controls.current.started) return; // while visible, the page's own check does the work
        if (m.error || m.status !== 200) { dbg.current.werr++; dbg.current.lastErr = (m.error ?? `HTTP ${m.status}`).slice(0, 80); return; }
        dbg.current.wok++;
        handle(m.data ?? null, null);
      };
    } catch { /* no workers: the page timer above is the fallback */ }
    return () => {
      if (visFn) document.removeEventListener("visibilitychange", visFn);
      ticker?.terminate(); if (tickerUrl) URL.revokeObjectURL(tickerUrl);
      cancelled = true; reload.current = () => {}; clearInterval(poll); void supabase.removeChannel(channel); };
  }, [supabase, sessionId, apply, restTick]);

  // heartbeat: tells the model who is listening and with what controls
  const beat = useCallback(async () => {
    const c = controls.current;
    await supabase.rpc("player_heartbeat", {
      p_session: sessionId, p_device: deviceId(),
      p_audio: !c.started ? "not_started" : c.muted ? "muted" : "playing",
      p_volume: c.volume, p_delay: null,
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
  }, [muted, volume, started, phase, beat]);

  useEffect(() => {
    if (phase !== "ready") return;
    const t = setTimeout(() => setDimAnimated(true), 700);
    return () => clearTimeout(t);
  }, [phase]);

  // listener controls go to the engine and are remembered
  useEffect(() => {
    audio.current?.setGain(muted ? 0 : sliderToGain(volume));
  }, [muted, volume, started]);
  // the slider moves the volume many times a second: write it down once it rests, not on every step (a phone's main thread also plays the music)
  useEffect(() => {
    const t = setTimeout(() => remember(sessionId, { muted, volume }), 300);
    return () => clearTimeout(t);
  }, [muted, volume, sessionId]);

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
      const d = dbg.current;
      if (document.visibilityState === "hidden") { d.hiddenAt = Date.now(); d.ticks = 0; d.ok = 0; d.err = 0; d.applied = 0; d.wok = 0; d.werr = 0; d.stopped = 0; d.lastErr = ""; return; }
      if (d.hiddenAt) {
        const secs = Math.round((Date.now() - d.hiddenAt) / 1000);
        const a = audio.current;
        const player = "mediaSession" in navigator ? (navigator.mediaSession.metadata ? "registered" : "not registered") : "not supported";
        const lines = [
          `Away ${secs} s (a timer tick is expected about every 3 s, so about ${Math.round(secs / 3)}).`,
          `Timer ticks: ${d.ticks}. Ticks with the audio stopped: ${d.stopped}.`,
          `State checks by the page: ${d.ok} ok, ${d.err} failed. By the worker: ${d.wok} ok, ${d.werr} failed${d.lastErr ? ` (last error: ${d.lastErr})` : ""}.`,
          `New sounds received while away: ${d.applied}.`,
          `Now: audio engine ${a?.state ?? "not started"}, keep-alive file ${a ? (a.keepAlivePlaying ? "playing" : "paused") : "n/a"}, lock-screen player ${player}.`,
          `Audio session type: ${a?.audioSessionType ?? "n/a"}.`,
          ...(a?.events.length ? ["Audio events:", ...a.events.slice(-12)] : ["Audio events: none."]),
        ];
        setDbgText(lines.join("\n"));
        d.hiddenAt = 0;
      }
      reload.current();
      void audio.current?.resume();
      void beat();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    document.addEventListener("resume", back); // the page was frozen by the browser and thawed
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); document.removeEventListener("resume", back); };
  }, [beat]);

  // lock screen and headset controls: play and pause map to unmute and mute
  useEffect(() => {
    if (!started || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: "The model's sound", artist: "Sonorous Envelope", album: "Live session" });
    ms.setActionHandler("play", () => { setMuted(false); void audio.current?.resume(); reload.current(); });
    ms.setActionHandler("pause", () => { setMuted(true); audio.current?.pauseElement(); });
    // this is a live sound, not a 60 s track: no seeking, and no progress bar if the browser accepts an endless duration
    for (const a of ["seekto", "seekbackward", "seekforward", "previoustrack", "nexttrack"] as const) {
      try { ms.setActionHandler(a, null); } catch { /* not supported */ }
    }
    try { ms.setPositionState({ duration: Infinity, playbackRate: 1, position: 0 }); } catch { /* not supported */ }
    return () => { ms.setActionHandler("play", null); ms.setActionHandler("pause", null); };
  }, [started]);
  // Muted means paused, in the page and on the lock screen: Chrome builds the notification from the audio element, so
  // pausing only the sound would leave a "Pause" button that does nothing.
  useEffect(() => {
    if (!started) return;
    if (muted) audio.current?.pauseElement(); else void audio.current?.resume();
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = muted ? "paused" : "playing";
  }, [started, muted]);

  // status clock
  useEffect(() => {
    const t = setInterval(() => { setTick((n) => n + 1); restTick(); }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => { strudel.current?.close(); strudel.current = null; void audio.current?.close(); }, []);

  async function start() {
    setStarting(true);
    try {
      const out = await AudioOutput.start();
      audio.current = out;
      out.watch(setAudioState);
      out.setGain(muted ? 0 : sliderToGain(volume));
      // already resting when the listener taps Start: begin silent (the engine's first state jumps to its target)
      out.setGridSeed(voiceSeedOf(sessionId));
      if (latest.current) {
        // joining late: start on the shared step grid, by the server's clock
        const age = (Date.now() + clockOffset.current - latest.current.at) / 1000, delay = latest.current.state.transition.delay ?? 0;
        if (restedFrom.current) out.setState(restedState(latest.current.state), latest.current.seed, Math.max(0, delay - age), Math.max(age, delay));
        else runEngine(latest.current, Math.max(0, delay - age), Math.max(age, delay));
      }
      setStarted(true);
    } catch {
      setMessage("Your browser could not start audio.");
    } finally { setStarting(false); }
  }

  const colour = playing?.state.colour;
  // hue glides as a number: unwrap it against the last one so 350 to 10 goes the short way, not through the whole wheel
  const hue = unwrapHue(lastHue.current.h, colour?.h ?? 220);
  const hue2 = unwrapHue(lastHue.current.h2, colour?.secondary?.h ?? ((colour?.h ?? 220) + 25));
  lastHue.current = { h: hue, h2: hue2 };
  const fieldStyle = {
    "--pl-h": hue, "--pl-s": colour?.s ?? 0.15, "--pl-l": colour?.l ?? 0.12,
    "--pl-h2": hue2, "--pl-s2": colour?.secondary?.s ?? colour?.s ?? 0.15,
    "--pl-l2": colour?.secondary?.l ?? Math.max(0, (colour?.l ?? 0.12) - 0.08),
    "--pl-t": `${Math.max(1, playing?.state.transition.time ?? 1)}s`,
    "--pl-dim": playing && !isSounding(playing.state) ? 1 : 0, "--pl-dim-delay": `${playing && isSounding(playing.state) ? dimDelay : 0}s`,
    "--pl-pulse": colour?.pulseHz ? `${1 / Math.min(3, colour.pulseHz)}s` : "0s",
  } as CSSProperties;

  void tick;
  const ageSec = playing ? Math.max(0, Math.round((Date.now() - playing.at) / 1000)) : 0;
  const midTurn = Boolean(playing && !playing.final && Date.now() - playing.at < STALE_MID_TURN_MS);

  const shareText = signedIn
    ? "Anyone with the link can listen. Nobody else can change anything."
    : "Want your AI to make sound for you too?";
  const shareAction = signedIn
    ? <CopyLink path={`/s/${sessionId}`} label="Copy link" />
    : <><a className="se-btn" href="/#add">Add to your AI</a><CopyLink path={`/s/${sessionId}`} label="Copy link" /></>;

  return (
    <div
      className="pl-field" style={fieldStyle}
      data-motion={reduced || stillPicture || canvasOk ? "still" : colour?.motion ?? "still"} data-texture={colour?.texture ?? "flat"} data-shape={colour?.shape ?? "wash"}
    >
      <div className="pl-dim" data-animated={dimAnimated} aria-hidden />
      {canvasOk && !reduced && (
        <VisualCanvas
          source={playing ? { state: playing.state, at: playing.at, seed: playing.seed } : null}
          clockOffset={clockOffset} latency={pictureLatency} active={started && !stillPicture} onFail={failCanvas}
        />
      )}
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
            <p className="pl-lede">Someone&apos;s AI is making this sound. You stay in control of the volume.</p>
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
            {debug && <p className="pl-local se-sm pl-debug" role="status">{dbgText}{strudel.current ? `\n${strudel.current.statsLine()}` : ""}</p>}
            {debug && <p className="pl-local se-sm pl-debug" role="status">
              {`Live: engine ${audio.current?.state ?? "not started"}, keep-alive ${audio.current ? (audio.current.keepAlivePlaying ? "playing" : "paused") : "n/a"}, session type ${audio.current?.audioSessionType ?? "n/a"}.\n${audio.current?.events.slice(-8).join("\n") ?? ""}`}
            </p>}
            <div className="pl-bar">
              <p className="pl-status se-sm">
                <span className={midTurn ? "pl-dot" : "pl-dot pl-dot-idle"} aria-hidden />
                <span className="pl-face" title={face === "internal" ? "The sound is how the model feels" : "The sound is made for you"}>{face === "internal" ? "Internal" : "External"}{face === "external" && allowCode && blockedAt !== playing?.at && playing?.state.engine === "strudel" && playing.state.pattern ? " · Strudel" : ""}{policy !== "auto" && <><Lock size={12} aria-hidden /><span className="se-visually-hidden"> (locked by the owner)</span></>}</span>
                <span className="pl-when">
                {playing
                    ? rested ? (Date.now() - restedAtMs.current < 30_000 ? "Fading · no update for a while" : `Faded · no update for ${age(ageSec).replace(" ago", "")}`) : `Turn ${playing.turn} · ${midTurn ? "mid-answer" : age(ageSec)}`
                    : "Waiting for the first sound"}
                </span>
              </p>
              <button type="button" className="se-btn se-btn-icon pl-icon-btn" onClick={() => setHidden(true)} aria-label="Hide controls" title="Hide controls">
                <EyeOff size={18} aria-hidden />
              </button>
            </div>

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
              {canvasOk && !reduced && (
                <label className="pl-slider" title="Delay the picture so it matches the sound, for example on Bluetooth headphones. Leave it at 0 if they already match.">
                  <span>Picture delay</span>
                  <input type="range" min={0} max={400} step={10} value={nudgeMs} style={{ "--fill": `${(nudgeMs / 400) * 100}%` } as CSSProperties}
                    onChange={(e) => { const n = Number(e.target.value); setNudgeMs(n); nudge.current = n; rememberPicture(stillPicture, n); }} />
                  <output>{nudgeMs} ms</output>
                </label>
              )}
            </div>

            {canvasOk && !reduced && (
              <button type="button" className="se-btn pl-mute" aria-pressed={stillPicture} onClick={() => { setStillPicture(!stillPicture); rememberPicture(!stillPicture, nudgeMs); }}>
                {stillPicture ? "Still picture. Tap for motion" : "Still picture"}
              </button>
            )}

            {(() => {
              const code = playing?.state.engine === "strudel" && playing.state.pattern && face === "external" && allowCode && blockedAt !== playing.at
                ? <StrudelPanel code={playing.state.pattern.code} bpm={playing.state.pattern.bpm} />
                : null;
              // the code sits right under the Face block for the owner, and on its own for a listener
              return signedIn ? <OwnerControls supabase={supabase} sessionId={sessionId} face={face} policy={policy} onChanged={() => reload.current()} afterFace={code} /> : code;
            })()}

            {signedIn && <WhatClaudeSet supabase={supabase} sessionId={sessionId} stateAt={playing?.at ?? 0} />}

            <div className="pl-share se-sm">
              <p>{shareText}</p>
              <div className="pl-actions">
                {shareAction}
                <div className="pl-hide-phone"><QrLink path={`/s/${sessionId}`} /></div>
              </div>
            </div>
          </section>
        )}
        {phase === "ready" && !started && <aside className="pl-aside se-sm"><p style={{ margin: 0 }}>{shareText}</p><div className="pl-actions">{shareAction}</div></aside>}
      </main>
    </div>
  );
}
