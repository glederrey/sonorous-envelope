"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineState } from "@sonorous/engine";
import type { ListenerSettings } from "@sonorous/shared";
import { isSounding } from "../sounding";
import { composeSnapshot, toJpegDataUrl } from "./compose";
import { SoundRecorder } from "./sound-recorder";

const SAMPLE_MS = 100;

/** True when a canvas holds nothing yet (every pixel of a 16×9 reduction is transparent). */
function isBlank(c: HTMLCanvasElement): boolean {
  if (!c.width || !c.height) return true;
  const t = document.createElement("canvas"); t.width = 16; t.height = 9;
  const x = t.getContext("2d"); if (!x) return false;
  x.drawImage(c, 0, 0, 16, 9);
  const d = x.getImageData(0, 0, 16, 9).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
  return true;
}
const REFRESH_MS = 30_000;
const MAX_IMAGE_CHARS = 340_000; // put_snapshot refuses more than 350000

/** What the player is showing and playing, as far as a snapshot needs it. */
export interface SnapshotSource {
  id?: string;
  turn: number;
  state: EngineState;
}

/**
 * The owner's player keeps the picture and the sound it produces for the model's `inspect("snapshot")`: it listens to a tap on
 * its own output every 100 ms, and shortly after each new state (and every 30 s after that) it saves one small JPEG (the picture
 * on top, a spectrogram of the last ~8 s below) with the numbers measured from that sound. Only while this browser is the
 * session owner's, the audio runs, the page is visible and the owner has not turned picture feedback off. One capture at a time.
 */
export function useSnapshots({ supabase, sessionId, signedIn, started, playing, audio, settings, field, controls, strudelPlays, strudelDrawn, debug }: {
  supabase: SupabaseClient;
  sessionId: string;
  signedIn: boolean;
  started: boolean;
  playing: SnapshotSource | null;
  audio: RefObject<{ tap: AnalyserNode } | null>;
  settings: RefObject<ListenerSettings>;
  /** the colour field, which holds the scenes canvas */
  field: RefObject<HTMLElement | null>;
  /** the listener's own slider (0..1) and mute */
  controls: RefObject<{ muted: boolean; volume: number }>;
  /** a Strudel pattern plays here */
  strudelPlays: boolean;
  /** Strudel's drawings are what the picture shows (visuals on, a pattern plays) */
  strudelDrawn: boolean;
  debug: boolean;
}) {
  const [isOwner, setIsOwner] = useState(false);
  const recorder = useRef<{ tap: AnalyserNode; rec: SoundRecorder } | null>(null);
  const busy = useRef(false);
  // the latest of what changes while a timer waits
  const live = useRef({ playing, strudelPlays, strudelDrawn, started, isOwner });
  live.current = { playing, strudelPlays, strudelDrawn, started, isOwner };

  useEffect(() => {
    if (!signedIn) { setIsOwner(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase.from("sessions").select("owner_id").eq("id", sessionId).maybeSingle();
        if (!cancelled) setIsOwner(Boolean(data) && data!.owner_id === u.user.id);
      } catch { /* not the owner as far as we can tell */ }
    })();
    return () => { cancelled = true; };
  }, [supabase, sessionId, signedIn]);

  const allowed = () => {
    const l = live.current;
    return l.isOwner && l.started && Boolean(audio.current) && document.visibilityState === "visible" && settings.current.image_feedback !== "off";
  };
  const recorderFor = () => {
    const tap = audio.current?.tap;
    if (!tap) return null;
    if (recorder.current?.tap !== tap) recorder.current = { tap, rec: new SoundRecorder(tap, { everyMs: SAMPLE_MS }) };
    return recorder.current.rec;
  };

  // listen to the output while the conditions hold (the recorder clears itself after a gap, e.g. a hidden page)
  useEffect(() => {
    if (!isOwner || !started) return;
    const timer = setInterval(() => { if (allowed()) recorderFor()?.sample(); }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [isOwner, started]);

  const stateId = playing?.id;
  useEffect(() => {
    if (!isOwner || !started || !stateId) return;
    const arrived = performance.now(); // where this sound starts in the recording
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false; // a newer state took over: a capture still awaiting its upload must not schedule another round
    const capture = async () => {
      const l = live.current;
      const rec = recorderFor();
      if (cancelled || busy.current || !rec || !l.playing || l.playing.id !== stateId || !allowed()) return;
      busy.current = true;
      try {
        const p = l.playing, c = p.state.colour;
        const base = isSounding(p.state) ? `hsl(${((c.h % 360) + 360) % 360}deg ${c.s * 100}% ${c.l * 100}%)` : "#000";
        const f = field.current;
        // The scenes canvas scales its resolution while the page settles, and a resize wipes it until the next frame is drawn: wait
        // for a painted frame, and give a blank scene a few more frames (a scene that is truly empty is captured as it is).
        const motion = f?.querySelector<HTMLCanvasElement>(".pl-motion") ?? null;
        for (let i = 0; i < 6; i++) {
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          if (!motion || !l.playing.state.colour.scene || l.playing.state.colour.scene === "none" || !isBlank(motion)) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        if (cancelled) return;
        const canvas = composeSnapshot({
          base,
          layers: [f?.querySelector<HTMLCanvasElement>(".pl-motion") ?? null, l.strudelDrawn ? f?.querySelector<HTMLCanvasElement>(".pl-strudel-cv") ?? null : null],
          frames: rec.frames,
          label: `turn ${p.turn} · ${l.strudelPlays ? "strudel" : "synth"}`,
          markAt: arrived,
        });
        let image = toJpegDataUrl(canvas, 0.72);
        if (image.length > MAX_IMAGE_CHARS) image = toJpegDataUrl(canvas, 0.5);
        if (image.length > MAX_IMAGE_CHARS) return;
        const { muted, volume } = controls.current;
        const { error } = await supabase.rpc("put_snapshot", { p_session: sessionId, p_state: l.playing.id, p_image: image, p_measured: rec.measured(arrived), p_volume: muted ? 0 : volume });
        if (error && debug) console.debug("snapshot not saved:", error.message);
      } catch (e) {
        if (debug) console.debug("snapshot failed:", e);
      } finally {
        busy.current = false;
      }
    };
    const run = async () => { await capture(); if (!cancelled) timer = setTimeout(() => void run(), REFRESH_MS); };
    // after a new state: let its transition finish and the sound settle, once; then refresh while it stays
    timer = setTimeout(() => void run(), Math.min(14, Math.max(8, (live.current.playing?.state.transition.time ?? 0) + 3)) * 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOwner, started, stateId, sessionId, supabase]);
  return { isOwner }; // the player also uses it to say "Your AI" to the owner
}
