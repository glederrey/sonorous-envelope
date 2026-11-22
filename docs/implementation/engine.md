# DSP engine

`packages/engine` is a pure DSP library: no DOM, no Node APIs, no allocation in the audio loop. The same code runs:
- in the browser, inside an AudioWorkletProcessor (real-time playback);
- in Node, through `renderOffline()` (analysis, later the mobile stream).

This guarantees that what the model gets feedback on is what the listener hears.

## EngineState
The complete, fully resolved state the engine plays. Produced on the server by mood mapping + override + limits. The override fields are the zod schemas in [mcp-tools.md](mcp-tools.md). Every field is present (no optionals).

```ts
interface EngineState {
  arp: { on: boolean; root: number /* MIDI */; scale: ScaleName; chord: number[]; pattern: Pattern;
         octaves: number; tempo: number; rate: Rate; gate: number; swing: number; density: number;
         jitterMs: number /* timing humanisation, from spontaneity */ };
  osc: { wave: Wave; detune: number; voices: number /* unison copies of one note, detuned; not different notes */;
         drive: number /* 0–1 soft saturation before the filter; roughness */;
         stack: number[] /* extra intervals in semitones, max 3, [] = single notes; each arp note plays as a chord */ };
  filter: { type: FilterType; cutoff: number; resonance: number };
  lfo: Array<{ target: LfoTarget; rate: number; depth: number; shape: LfoShape }>; // 0–2
  env: { attack: number; decay: number; sustain: number; release: number };
  drone: { on: boolean; notes: number[] /* MIDI */; wave: Wave; level: number };
  pad: { on: boolean; notes: number[] /* MIDI, max 5 */; wave: Wave; level: number; attack: number; release: number };
  bass: { on: boolean; root: number /* MIDI, from the slow mood */; scale: ScaleName; chord: number[];
          stepSeconds: number /* 1–2 s */; wave: Wave; level: number };   // background arpeggio, see mood-mapping.md
  fx: { delay: { time: number; feedback: number; mix: number }; reverb: { size: number; mix: number } };
  pan: { width: number /* 0 mono … 1 wide */ };
  volume: number;               // after limits
  colour: ResolvedColour;       // see mood-mapping.md
  transition: { time: number; curve: "smooth" | "sudden" };
}
```

## Engine API
```ts
class Engine {
  constructor(sampleRate: number, seed: number);
  setState(state: EngineState, seed: number): void;   // starts glide from current to target
  setListenerGain(gain: number): void;                // local volume/mute, 0 to 8 (1 = as mapped, 8 = +18 dB), 20 ms smoothing, inside the soft limiter
  setListenerDelay(amount: number, maxMix?: number): void; // local echo control 0–1 (0.5 = as mapped, 0 = no echo): delay mix × 2·amount, capped at maxMix (default 0.6)
  recordEvents(into: NoteEvent[]): void;             // offline analysis: collect every scheduled note
  process(left: Float32Array, right: Float32Array, frames: number): void;
}

function renderOffline(state: EngineState, opts: { seconds: number; sampleRate: number; seed: number;
                                                   from?: EngineState /* default: none, steady state */ }):
  { left: Float32Array; right: Float32Array; events: NoteEvent[] };
```
`renderOffline` also returns the note events it scheduled (time, MIDI note, velocity), which analysis uses for exact onset density and pitch range.

## Signal graph (per sample block)

```
 arp scheduler ──▶ voices (osc × voices, detuned) ──▶ amp env ─┐
 drone notes  ──▶ drone osc (slow attack, no env retrigger) ───┼─▶ filter (biquad) ─▶ tremolo ─▶ pan/width ─┐
 motif        ──▶ motif voice (own envelope, after the filter) ┘                                              │
                                                                                                             ▼
                                       out ◀── listener gain ◀── soft limiter ◀── volume ◀── reverb ◀── delay
```

- The motif voice (below) joins the mix after the filter, so it stays audible when the filter is dark: after the filter and the amp LFO, before the delay and reverb, so the master volume (0.9 at most) and the limiter still apply to it.
- LFO targets: `cutoff` (multiplies cutoff by 2^(depth·2·lfo) i.e. ±2 octaves at depth 1), `pitch` (±depth·50 cents vibrato), `amp` (tremolo, gain 1 − depth·(0.5+0.5·lfo)), `pan`.
- LFO rate: `cutoff`, `pitch` and `pan` stay capped at 12 Hz. `amp` goes up to about 80 Hz, which turns a tremolo into a grain: about 25 Hz is the purring texture, 30 to 70 Hz the growling one (emotion-to-sound.md). The `amp` LFO must be computed per sample, not once per 128-frame block: a block is 2.7 ms, so a 70 Hz wave sampled that way is badly aliased. A `random` shape at these rates is sample-and-hold on the LFO's own clock. The colour pulse never follows it (mood-mapping.md, "Colour").
- Soft limiter: `tanh` with drive normalised so a −6 dBFS sine passes almost unchanged; then a hard clamp at ±0.98.

## Building blocks
- **PRNG:** mulberry32, seeded from `seed`. All randomness (random patterns, step density, jitter, random LFO, reverb diffusion init) comes from it. Separate PRNG streams per consumer (derive with `seed ^ constant`) so adding a consumer doesn't change others.
- **Oscillators:** polyBLEP saw and square; triangle and sine computed directly from the phase (the triangle's harmonics fall off fast enough that aliasing is negligible). Up to 3 voices per note, detuned symmetrically by ±detune cents, random start phase.
- **Filter:** RBJ cookbook biquad (LP/HP/BP), coefficients recomputed every 32 samples from the smoothed cutoff and Q. Clamp cutoff to [20, 0.45·sampleRate].
- **Envelope:** linear attack, exponential decay/release (time constant = time/5), retriggered per arp note.
- **Arpeggiator:** builds the note list from root, scale, chord degrees and octaves; orders by pattern (`up`, `down`, `up_down` without repeating ends, `random` from PRNG, `as_played` = chord order). Step length from tempo and rate (`1/8t` = 2/3 of 1/8). Swing delays every second step by `swing · 0.33 · step`. Each step plays with probability `density`. Note length = `gate · step`. Jitter = uniform ±`jitterMs`. Max 6 simultaneous voices; steal the oldest.
- **Bass layer:** a second, slower arpeggiator on its own voices (2 voices, no jitter, gate 1). It uses the same note scheduling code with `stepSeconds` instead of tempo and rate. It follows the *slow mood*, not the current one (mood-mapping.md).
- **Drive:** `tanh(x·(1 + 4·drive)) / tanh(1 + 4·drive)` before the filter. At `drive = 0` it is the identity (skip it).
- **Drone:** sustained notes with a 3 s fade in/out on change, level independent of the arp, lightly detuned.
- **Pad:** a chord of up to 5 sustained notes with its own wave, level, attack and release, separate from the drone. It changes with every state: notes already sounding fade out over `release` while the new ones fade in over `attack`, so a change is a crossfade, not a cut. It goes through the same filter and effects as the drone.
- **Stack:** with `osc.stack = [0, 7, 12]`, each arp note starts one voice per interval, all with the same envelope. At most 3 extra intervals, so up to 4 notes per step.
- **Delay:** stereo ping-pong, feedback low-passed at 4 kHz, max time 1.5 s.
- **Reverb:** Freeverb-style (8 combs + 4 allpasses per channel), `size` → room size 0.5–0.95, damping 0.4, `mix` wet/dry.

## Glide between states
When `setState` is called:
- Continuous params (cutoff, resonance, volume, levels, mixes, LFO rate/depth, detune, delay feedback, width, tempo) glide over `transition.time` with an ease-in-out curve (`smooth`) or 30 ms (`sudden`). Use one-pole smoothing towards a moving target computed from the curve.
- Tempo changes apply at the next step boundary, gliding the step length.
- Discrete params (scale, chord, root, pattern, wave, voices, filter type, LFO target/shape): take effect on the next note. Notes already sounding keep their old settings and ring out through their release, which makes the change an overlap rather than a cut. (A dual voice pool with equal-power crossfade was dropped as unnecessary; revisit if changes sound abrupt.)
- Delay time is smoothed slowly (one pole, about 2000 samples), so a change glides in pitch instead of clicking.
- Colour glides over the same time in the UI layer.

## AudioWorklet wrapper
- `engine-worklet.ts` registers `sonorous-engine`. Messages over `port`: `{type:"state", state, seed}`, `{type:"gain", value}`.
- The main thread creates the `AudioContext` on the first user tap (browsers require it), loads the worklet module, connects to destination.
- Process block = 128 frames; the engine must handle any block size.
- No allocation inside `process`: pre-allocate voice pools, buffers and delay lines at construction (max delay 1.5 s, reverb buffers, 6 arp voices, 4 drone voices, 2 bass voices, ×2 for crossfades). With the stack, the arp voices become `6 × 4` (a stack counts per note, and the oldest note's voices are stolen together), plus 5 pad voices (×2 for the crossfade). Voices that are not used cost nothing, but measure the phone target again with stack at 4 and a 1/16 rate.

## Performance targets
- Real-time: < 15% of one core on a mid-range phone at 48 kHz (to re-check with stack, pad and a 80 Hz amp LFO).
- Offline: 8 s at 22.05 kHz renders in < 150 ms in Node on Vercel.

## Determinism test
Rendering the same state with the same seed twice must produce bit-identical buffers. Browser vs Node may differ in the last float bits (Math functions), so compare the analysis features within tolerance, not raw samples.

## Motif voice (#128)
`EngineState.motif?: { id, notes (MIDI, -1 a rest), beats, repeat (1 to 4), level (0 to 1) }` (`motif.ts`, class `MotifVoice`, called from `Engine.applyState` and `process`). A short phrase the model plays over the sound, once. It is a one-shot, deduplicated by `id`, never replayed for a late joiner.
- **When.** Applying a state whose `motif.id` differs from the last one seen schedules it for the first bar (multiple of 4 beats) at least 2.5 s after the state was written (`LEAD_S`, counted in beats at the state's tempo from `grid.beat`): players receive a state about a second after it is written (their poll), so a bar closer than that would be missed. A device that applies the state more than 0.5 s after the phrase began (`LATE_S`, a late joiner or a reload) skips it entirely, never half.
- **Never half, never again.** If the state is applied later than 0.25 s after the phrase's start (a late joiner, a reload), nothing plays. The id is remembered either way, so re-applying the same state (a rest and return, a duplicate poll) does not replay it. A later state without a motif, or with the same id, does not touch a phrase that plays; a new id replaces the notes not yet started (a note already sounding rings out).
- **Notes.** Back to back, each sounding for 90% of its beats, rests silent, the whole phrase `repeat` times with no gap. Each note is the state's `osc.wave`, two unison voices detuned by 7 cents either way, attack 15 ms, release 300 ms (time constant release/5, as the layers), at most 8 voices at once (the oldest is stolen). Gain `0.45 * level` (default 0.6: just above the arpeggio at the same master volume). No LFO pitch and no seeded randomness: phases start at 0, so the same state, seed and elapsed give the same samples.
- **Events.** Each note pushes a `NoteEvent` with `layer: "motif"` at its onset (the analysis and the tests see them). The server's analysis render is made without the motif.
- **Tests** (`packages/engine/test/engine.test.ts`, "motifs"): notes on the first bar after the 2.5 s lead-in at the state's tempo, bar boundary, repeat, tempo glide, deterministic, silence before and sound after, late joiner, same id, new id, no motif following, master cap.

## Shared timeline (#34)
Devices playing the same session now play the same notes at the same moments (within the accuracy of the clock estimate, tens of milliseconds). The server renders no audio for it.
- **Server:** every state carries `effective.grid = { arp, bass }`, the step counters (fractions) at the moment it was written, counted from the start of the session (`nextGrid` in `shared/src/grid.ts`: the previous counters plus the time since the previous state divided by that state's step length). The echo is Claude's, no longer per listener, so it was never a source of difference.
- **Beats for the visuals:** the grid also carries `beat`, the beats (quarter notes at the arpeggio's tempo) counted from the start of the session. The step counter `arp` cannot give this, because a step is a different number of beats after a rate change. `beatsAt(state, tau)` (`packages/engine/src/ramp.ts`) reads it `tau` seconds after the state was written, through the same tempo ramp as the notes. Invariant, kept by `nextGrid`: `beat - arp * R` is a whole number of steps, where `R` is the beats per step of the new state's rate. A state starts at a fractional step and its notes fire when the step counter crosses an integer, so without the invariant a rate change leaves the beat a fixed fraction of a step away from the notes for the rest of the session. `nextGrid` moves the continuous beat to the nearest value that holds it (at most half a step). Rows stored before `beat` fall back to `arp * R`, which holds it. A bar is 4 beats (4/4 is assumed; there is no meter). The player follows `beatsAt` with `BeatClock` (`apps/web/lib/beat-clock.ts`): it takes whole beats at once and closes only the fraction at a bounded speed, so the picture never runs through anti-phase, and it draws `beatsAt(serverNow - outputLatency)`, the beat the ear is hearing. Tests: `the shared timeline` in `shared.test.ts` compares real engine onsets to `beatsAt` (a fractional write, a rate change, a glide).
- **Randomness per step:** the choice for step `k` (skipped or not, which note for `random`, jitter) comes from a hash of the session's grid seed (`voiceSeedOf(session id)`) and `k`, not from a stream consumed in order. A device that joins late needs no replay. The note for the non-random patterns is `cycle[k mod length]`; a skipped step skips its note, it no longer shifts the following ones (this changes how `density` sounds slightly).
- **Grid follows the state, not the glide:** the density and jitter that decide the steps use the state's own values. The tempo glides, but not through the smoothed parameters: the step rate is a linear ramp from the tempo that played when the state was written (`grid.fromTempo`, set by the server in `nextGrid`) to the state's own tempo over `grid.glide` seconds, the transition it was written with (stored in the grid because the player rewrites `transition` when a sound rests) (`packages/engine/src/ramp.ts`). A state applied without a clock (a sound resting or coming back) keeps the steps running and starts no new glide. The step count after a time and the time of a step are closed-form (a quadratic and its square-root inverse), used by `Layer.align`/`sync`/`advance` and by the server's `nextGrid`, so a device that joins mid-glide plays the same notes at the same moments as one that played from the start (engine test). No ramp for a sudden transition, a transition under 0.5 s, a delayed state, a change under 0.5 BPM, or a state stored before the glide existed (no `glide` in its grid).
- **Rate glides too (#156):** the arpeggio's rate used to jump at the start of a tempo glide (a Faster step went 1/4 to 1/16 at once while the tempo took 8 s). `nextGrid` now also writes `grid.fromRate`, the rate that plays when the state is written (taken from the plan of the state before, so mid-step it is the rate playing then). When the state glides (`grid.glide` at least 0.5 s, `fromTempo` set, not Strudel) and `fromRate` differs from its own rate, the rate goes from `fromRate` through the straight rates (1/4, 1/8, 1/16) strictly between the two in beat length, to its own (`ratePath`). Switch `i` of `m` is nominally at `i / (m + 1)` of the glide, then moved forward to the next bar line (absolute beat a multiple of 4) if that is before the glide ends, else to the next whole beat, and always after the previous switch. The tempo ramp and `beatsAt` do not change, only how many steps fit in the beats. `arpPlan(state)` (`ramp.ts`) gives the closed-form `stepsAt`, `timeOfStep`, `timeOfBeats` and `rateAt`, and is what `Layer`, the motif and `nextGrid` use; for a state without a rate glide it is the old ramp exactly. A whole beat is a whole number of steps of every rate, and `nextGrid` starts a stepping state on a step of `fromRate` (`R` is that rate), so the step counter is a whole number at every switch and a late joiner computes the same step times. During a segment a step's length (gate, swing) follows the segment's rate. States without `fromRate` (stored before, saved or frozen ones) play as before.
- **Player:** keeps the server-clock offset from the request with the shortest round trip of the last twelve, and gives the engine `elapsed` (seconds since the state was written, minus a delay) when it applies a state and when the listener taps Start, so the grid lands where the server's clock puts it. Every poll (5 s) it sends `sync`: the engine moves a grid only if it is more than 40 ms off, so network jitter does not make the beat wobble.
- **Not shared:** LFO and drone phases, voice start phases and the reverb tail are per device (random starting phases are not audible as a difference in the notes).
- **How to check:** open the same session on two devices next to each other with `?debug=1`; the arpeggio should lock, notes and timing. A slow drift apart over minutes means the resync tolerance is too wide or the clock estimate is poor.
