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
  osc: { wave: Wave; detune: number; voices: number };
  filter: { type: FilterType; cutoff: number; resonance: number };
  lfo: Array<{ target: LfoTarget; rate: number; depth: number; shape: LfoShape }>; // 0–2
  env: { attack: number; decay: number; sustain: number; release: number };
  drone: { on: boolean; notes: number[] /* MIDI */; wave: Wave; level: number };
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
  setListenerGain(gain: number): void;                // local volume/mute, applied after everything, 20 ms smoothing
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
- Soft limiter: `tanh` with drive normalised so a −6 dBFS sine passes almost unchanged; then a hard clamp at ±0.98.

## Building blocks
- **PRNG:** mulberry32, seeded from `seed`. All randomness (random patterns, step density, jitter, random LFO, gesture variation, reverb diffusion init) comes from it. Separate PRNG streams per consumer (derive with `seed ^ constant`) so adding a consumer doesn't change others.
- **Oscillators:** polyBLEP saw and square; triangle by integrating polyBLEP square (leaky); sine via phase accumulator. Up to 3 voices per note, detuned symmetrically by ±detune cents, random start phase.
- **Filter:** RBJ cookbook biquad (LP/HP/BP), coefficients recomputed every 32 samples from the smoothed cutoff and Q. Clamp cutoff to [20, 0.45·sampleRate].
- **Envelope:** linear attack, exponential decay/release (time constant = time/5), retriggered per arp note.
- **Arpeggiator:** builds the note list from root, scale, chord degrees and octaves; orders by pattern (`up`, `down`, `up_down` without repeating ends, `random` from PRNG, `as_played` = chord order). Step length from tempo and rate (`1/8t` = 2/3 of 1/8). Swing delays every second step by `swing · 0.33 · step`. Each step plays with probability `density`. Note length = `gate · step`. Jitter = uniform ±`jitterMs`. Max 6 simultaneous voices; steal the oldest.
- **Drone:** sustained notes with a 3 s fade in/out on change, level independent of the arp, lightly detuned.
- **Delay:** stereo ping-pong, feedback low-passed at 4 kHz, max time 1.5 s.
- **Reverb:** Freeverb-style (8 combs + 4 allpasses per channel), `size` → room size 0.5–0.95, damping 0.4, `mix` wet/dry.

## Gestures
Each is a short synthesised sound with its own envelope, played once when a state arrives with a new `gesture.id`. Intensity scales level (and, where noted, length). All under 2.5 s.

| Gesture | Recipe |
|---|---|
| `purr` | Sine at root − 2 octaves, amplitude-modulated at 22–28 Hz (random in range), plus low-passed noise at 300 Hz; 0.8–1.6 s, slow attack 0.15 s |
| `chirp` | 2–3 short sine blips rising (root+12 → +19 → +24 semitones), 60 ms each, 40 ms apart, slight pitch bend up within each |
| `sigh` | Band-passed noise, centre sweeping 1.8 kHz → 400 Hz over 1.2 s, attack 0.3 s, long release |
| `hum` | Triangle at root + fifth, gentle vibrato 5 Hz, 1–1.5 s, soft attack and release |
| `pluck` | Karplus–Strong string at root + 2 octaves, decay 0.8 s |
| `breath` | Pink noise through low-pass at 1.2 kHz, swell up 0.6 s and down 0.8 s |

## Glide between states
When `setState` is called:
- Continuous params (cutoff, resonance, volume, levels, mixes, LFO rate/depth, detune, delay feedback, width, tempo) glide over `transition.time` with an ease-in-out curve (`smooth`) or 30 ms (`sudden`). Use one-pole smoothing towards a moving target computed from the curve.
- Tempo changes apply at the next step boundary, gliding the step length.
- Discrete params (scale, chord, root, pattern, wave, voices, filter type, LFO target/shape): crossfade. Run the old and new voice pools in parallel for `min(transition.time, 2 s)` and crossfade equal-power. Filter type changes crossfade two filter instances.
- Delay time changes crossfade two delay lines (avoids pitch artefacts).
- Colour glides over the same time in the UI layer.

## AudioWorklet wrapper
- `engine-worklet.ts` registers `sonorous-engine`. Messages over `port`: `{type:"state", state, seed}`, `{type:"gain", value}`.
- The main thread creates the `AudioContext` on the first user tap (browsers require it), loads the worklet module, connects to destination.
- Process block = 128 frames; the engine must handle any block size.
- No allocation inside `process`: pre-allocate voice pools, buffers and delay lines at construction (max delay 1.5 s, reverb buffers, 6 arp voices + 4 drone voices + 1 gesture voice, ×2 for crossfades).

## Performance targets
- Real-time: < 15% of one core on a mid-range phone at 48 kHz.
- Offline: 8 s at 22.05 kHz renders in < 150 ms in Node on Vercel.

## Determinism test
Rendering the same state with the same seed twice must produce bit-identical buffers. Browser vs Node may differ in the last float bits (Math functions), so compare the analysis features within tolerance, not raw samples.
