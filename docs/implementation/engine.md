# DSP engine

`packages/engine` is a pure DSP library: no DOM, no Node APIs, no allocation in the audio loop. The same code runs:
- in the browser, inside an AudioWorkletProcessor (real-time playback);
- in Node, through `renderOffline()` (analysis, later the mobile stream).

This guarantees that what the model gets feedback on is what the listener hears.

## EngineState
The complete, fully resolved state the engine plays. Produced on the server by mood mapping + override + limits. Every field is present (no optionals).

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
  gesture: null | { type: GestureType; intensity: number; id: string /* to play once */ };
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
 gesture      ──▶ gesture synth (own envelope) ────────────────┘   (gesture bypasses the filter, see below)  │
                                                                                                             ▼
                                       out ◀── listener gain ◀── soft limiter ◀── volume ◀── reverb ◀── delay
```

- Gestures go to the mix after the filter, so they stay audible when the filter is dark, then through delay and reverb.
- LFO targets: `cutoff` (multiplies cutoff by 2^(depth·2·lfo) i.e. ±2 octaves at depth 1), `pitch` (±depth·50 cents vibrato), `amp` (tremolo, gain 1 − depth·(0.5+0.5·lfo)), `pan`.
- LFO rate: `cutoff`, `pitch` and `pan` stay capped at 12 Hz. `amp` goes up to about 80 Hz, which turns a tremolo into a grain: about 25 Hz is the purring texture, 30 to 70 Hz the growling one (emotion-to-sound.md). The `amp` LFO must be computed per sample, not once per 128-frame block: a block is 2.7 ms, so a 70 Hz wave sampled that way is badly aliased. A `random` shape at these rates is sample-and-hold on the LFO's own clock. Gestures keep their own modulation (purr 25 Hz, growl 40 Hz); this is for the continuous layer. Consent and harshness limits apply (limits.md), and the colour pulse never follows it (mood-mapping.md, "Colour").
- Soft limiter: `tanh` with drive normalised so a −6 dBFS sine passes almost unchanged; then a hard clamp at ±0.98.

## Building blocks
- **PRNG:** mulberry32, seeded from `seed`. All randomness (random patterns, step density, jitter, random LFO, gesture variation, reverb diffusion init) comes from it. Separate PRNG streams per consumer (derive with `seed ^ constant`) so adding a consumer doesn't change others.
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

## Gestures
Each is a short synthesised sound with its own envelope, played once when a state arrives with a new `gesture.id`. Intensity scales level (and, where noted, length). All under 2.5 s. The shapes follow the motivation-structure rules (emotion-to-sound.md): low and rough for hostility, high and pure for fear, appeasement or approach, rising for a request, falling for a complaint.

| Gesture | Recipe |
|---|---|
| `purr` | Sine at root − 2 octaves, amplitude-modulated at 22–28 Hz (random in range), plus low-passed noise at 300 Hz; 0.8–1.6 s, slow attack 0.15 s |
| `meow_up` | Sawtooth through a low-pass at 2 kHz with a formant-like band-pass sweeping 900 → 1600 Hz; pitch glides root+12 → root+19 over 0.5 s, small vibrato at 6 Hz, attack 60 ms, release 150 ms. A request or curiosity. |
| `meow_down` | Same voice, pitch glides root+19 → root+9 over 0.6 s, a little rougher (drive 0.2). A complaint. |
| `chirp` | 2–3 short sine blips rising (root+12 → +19 → +24 semitones), 60 ms each, 40 ms apart, slight pitch bend up within each |
| `laugh` | 4 to 8 bursts of a triangle at root+12, each 80 ms with a fast decay, 120 ms apart, pitch rising about 1 semitone per burst, level decaying 15 % per burst. Enthusiasm. |
| `growl` | Sawtooth at root − 2 octaves with drive 0.7, amplitude-modulated at 40 Hz with a random 20 % wobble, low-passed at 700 Hz, 0.8 to 1.5 s, attack 0.2 s. Rough, low, a limit. Not allowed in "ambient" or "expressive" (limits.md). |
| `sigh` | Band-passed noise, centre sweeping 1.8 kHz → 400 Hz over 1.2 s, attack 0.3 s, long release |
| `hum` | Triangle at root + fifth, gentle vibrato 5 Hz, 1–1.5 s, soft attack and release |
| `pluck` | Karplus–Strong string at root + 2 octaves, decay 0.8 s |
| `breath` | Pink noise through low-pass at 1.2 kHz, swell up 0.6 s and down 0.8 s |

### Purr and the hidden cry
The purr is a pure contented sound, so it has hard properties that tests check:
- The pulse is a 25 Hz amplitude modulation (22 to 28 Hz). Its third harmonic is the strong spectral line near 75 to 80 Hz.
- There is **no tonal component above about 250 Hz**. A cat that wants food slips a cry near 380 Hz into its purr and listeners hear that purr as more urgent and less pleasant. The model must not be able to do this by accident, so the noise is low-passed at 300 Hz with a steep slope and the carrier stays two octaves below the root.
- Test (`purr.test.ts`): render the purr offline, take the spectrum, assert that no bin above 250 Hz is within 30 dB of the strongest peak, and that the strongest peak is below 120 Hz.

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
- No allocation inside `process`: pre-allocate voice pools, buffers and delay lines at construction (max delay 1.5 s, reverb buffers, 6 arp voices + 4 drone voices + 1 gesture voice, 2 bass voices, ×2 for crossfades). With the planned stack and pad: arp voices become `6 × 4` (a stack counts per note, and the oldest note's voices are stolen together), plus 5 pad voices (×2 for the crossfade). Voices that are not used cost nothing, but measure the phone target again with stack at 4 and a 1/16 rate.

## Performance targets
- Real-time: < 15% of one core on a mid-range phone at 48 kHz (to re-check with stack, pad and a 80 Hz amp LFO).
- Offline: 8 s at 22.05 kHz renders in < 150 ms in Node on Vercel.

## Determinism test
Rendering the same state with the same seed twice must produce bit-identical buffers. Browser vs Node may differ in the last float bits (Math functions), so compare the analysis features within tolerance, not raw samples.

## Shared timeline (roadmap #34, built)
Devices playing the same session now play the same notes at the same moments (within the accuracy of the clock estimate, tens of milliseconds). Option (a) of the roadmap, without server-rendered audio.
- **Server:** every state carries `effective.grid = { arp, bass }`, the step counters (fractions) at the moment it was written, counted from the start of the session (`nextGrid` in `shared/src/grid.ts`: the previous counters plus the time since the previous state divided by that state's step length). The echo is Claude's, no longer per listener, so it was never a source of difference.
- **Randomness per step:** the choice for step `k` (skipped or not, which note for `random`, jitter) comes from a hash of the session's grid seed (`voiceSeedOf(session id)`) and `k`, not from a stream consumed in order. A device that joins late needs no replay. The note for the non-random patterns is `cycle[k mod length]`; a skipped step skips its note, it no longer shifts the following ones (this changes how `density` sounds slightly).
- **Grid follows the state, not the glide:** the density and jitter that decide the steps use the state's own values. The tempo glides, but not through the smoothed parameters: the step rate is a linear ramp from the tempo that played when the state was written (`grid.fromTempo`, set by the server in `nextGrid`) to the state's own tempo over its transition (`packages/engine/src/ramp.ts`). The step count after a time and the time of a step are closed-form (a quadratic and its square-root inverse), used by `Layer.align`/`sync`/`advance` and by the server's `nextGrid`, so a device that joins mid-glide plays the same notes at the same moments as one that played from the start (engine test). No ramp for a sudden transition, a transition under 0.5 s, a delayed state or a change under 0.5 BPM.
- **Player:** keeps the server-clock offset from the request with the shortest round trip of the last twelve, and gives the engine `elapsed` (seconds since the state was written, minus a delay) when it applies a state and when the listener taps Start, so the grid lands where the server's clock puts it. Every poll (5 s) it sends `sync`: the engine moves a grid only if it is more than 40 ms off, so network jitter does not make the beat wobble.
- **Not shared:** LFO and drone phases, voice start phases and the reverb tail are per device (random starting phases are not audible as a difference in the notes).
- **How to check:** open the same session on two devices next to each other with `?debug=1`; the arpeggio should lock, notes and timing. A slow drift apart over minutes means the resync tolerance is too wide or the clock estimate is poor.

