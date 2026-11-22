import { midiToHz } from "./music";
import { oscSample } from "./oscillator";
import { arpPlan, RATE_BEATS } from "./ramp";
import type { EngineState, NoteEvent, Wave } from "./types";

// Motifs (roadmap #128): a short phrase the model plays over the sound, once, on the first bar at least 2.5 s after the state, in the state's own wave. Like a gesture
// it is a one-shot with a single id: a state carries it, every device plays it at the same moment on the shared timeline, a device
// that arrives late plays nothing (never half, never again). The phrase is mixed after the filter and before the fx.

const MAX_VOICES = 8;
const MAX_NOTES = 8, MAX_REPEAT = 4;
const LATE_S = 0.5;       // a device that applies the state later than this after the phrase started skips it
const LEAD_S = 2.5;       // the phrase starts on the first bar at least this long after the state was written: players get a new state
                          // about a second after it is written (their poll), so a bar a few hundred ms away would be missed everywhere
const ATTACK_S = 0.015, RELEASE_S = 0.3, SOUNDING = 0.9, DETUNE_CENTS = 7;
const GAIN = 0.45;        // with level 0.6 this sits just above the arpeggio at the same master volume
const ENV_FLOOR = 1e-4;

class MVoice {
  active = false; dt = 0; ph = [0, 0]; mul = [1, 1]; wave: Wave = "sine";
  env = 0; atk = 0; relC = 0; held = 0; releasing = false; velocity = 0; age = 0;
}

export class MotifVoice {
  private voices: MVoice[] = Array.from({ length: MAX_VOICES }, () => new MVoice());
  private at: number[] = []; private midi: number[] = []; private len: number[] = [];
  private next = 0;
  private lastId: number | null = null;
  private wave: Wave = "sine"; private level = 0.6;
  private d = Math.pow(2, DETUNE_CENTS / 1200);

  constructor(private sr: number, private events: NoteEvent[] | null = null) {}
  setEvents(e: NoteEvent[] | null) { this.events = e; }

  /** A state arrived at sample `t`, written `elapsed` seconds ago by the server's clock. A motif with a new id replaces the notes that
   *  have not started yet; one with the same id, or none, changes nothing (a phrase that plays is never cut). */
  apply(s: EngineState, t: number, elapsed: number) {
    const m = s.motif;
    if (!m || m.id === this.lastId || s.engine === "strudel") return;
    this.lastId = m.id;
    this.at.length = 0; this.midi.length = 0; this.len.length = 0; this.next = 0;
    const notes = m.notes.slice(0, MAX_NOTES);
    if (!notes.length) return;
    const rb = RATE_BEATS[s.arp.rate], plan = arpPlan(s);
    const g = s.grid?.beat ?? (s.grid?.arp ?? 0) * rb;
    const lead = LEAD_S * Math.max(20, s.arp.tempo) / 60;      // LEAD_S in beats, at the state's tempo (a glide only moves it a little)
    const start = Math.ceil((g + lead - 1e-6) / 4) * 4;        // the first bar at least LEAD_S after the state's creation
    const tau = (beat: number) => plan.timeOfBeats(start + beat - g); // seconds since creation at `beat` into the phrase
    if (elapsed > tau(0) + LATE_S) return;
    this.wave = s.osc.wave;
    this.level = Number.isFinite(m.level) ? Math.min(1, Math.max(0, m.level)) : 0.6;
    const repeat = Math.min(MAX_REPEAT, Math.max(1, Math.round(m.repeat || 1)));
    const sr = this.sr;
    let b = 0;
    for (let r = 0; r < repeat; r++) {
      for (let i = 0; i < notes.length; i++) {
        const d = Math.min(4, Math.max(0.25, m.beats[i] ?? 1));
        if (notes[i] >= 0) {
          const on = t + (tau(b) - elapsed) * sr, len = (tau(b + d * SOUNDING) - tau(b)) * sr;
          if (on + len >= t) { this.at.push(on); this.midi.push(notes[i]); this.len.push(Math.max(1, len)); } // all in the past: skip
        }
        b += d;
      }
    }
  }

  private trigger(midi: number, lenSamples: number, at: number) {
    const sr = this.sr;
    let v: MVoice | undefined;
    for (const c of this.voices) if (!c.active) { v = c; break; }
    if (!v) { v = this.voices[0]; for (const c of this.voices) if (c.age < v.age) v = c; }
    v.active = true; v.dt = midiToHz(midi) / sr; v.ph[0] = 0; v.ph[1] = 0; v.mul[0] = 1 / this.d; v.mul[1] = this.d;
    v.wave = this.wave; v.env = 0; v.atk = 1 / Math.max(1, ATTACK_S * sr); v.relC = Math.exp(-1 / ((RELEASE_S / 5) * sr));
    v.held = Math.max(1, Math.round(lenSamples)); v.releasing = false; v.velocity = this.level; v.age = at;
    this.events?.push({ time: at / sr, midi, velocity: this.level, layer: "motif" });
  }

  /** One sample (mono, before the fx). `t` = sample counter. */
  process(t: number): number {
    while (this.next < this.at.length && t >= this.at[this.next]) {
      this.trigger(this.midi[this.next], this.len[this.next], this.at[this.next]); this.next++;
    }
    let out = 0;
    for (const v of this.voices) {
      if (!v.active) continue;
      if (!v.releasing) {
        v.env = Math.min(1, v.env + v.atk);
        if (--v.held <= 0) v.releasing = true;
      } else { v.env *= v.relC; if (v.env < ENV_FLOOR) { v.active = false; continue; } }
      let s = 0;
      for (let k = 0; k < 2; k++) {
        const dt = v.dt * v.mul[k];
        s += oscSample(v.wave, v.ph[k], dt);
        v.ph[k] += dt; if (v.ph[k] >= 1) v.ph[k] -= 1;
      }
      out += (s / Math.SQRT2) * v.env * v.velocity;
    }
    return out * GAIN;
  }
}
