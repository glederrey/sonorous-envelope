# Mood mapping

`moodToEngineState(mood: Mood): EngineState` in `packages/shared/src/mood-mapping.ts`. Pure and deterministic. The result is then overridden by the model's `synth` fields and finally passed through limits.

These formulas are a first guess. They must be tuned by listening. Keep them in one file with named constants so tuning is easy, and add a dev page (`/dev/mood`) with five sliders that plays the mapped result live.

Notation: `w` warmth, `c` closeness, `j` joy, `k` calm, `s` spontaneity, all in [0,1]. `lerp(a,b,t) = a + (b−a)·t`. `pick(list, t)` = `list[min(len−1, floor(t·len))]`.

## Harmony (mainly joy)
- **Scale** by joy, from darkest to brightest:
  `pick(["phrygian","harmonic_minor","minor","dorian","mixolydian","major","lydian"], j)`
- **Root:** D3 (MIDI 50), shifted by register: `root = 50 + round(lerp(-5, 7, 0.6·j + 0.4·(1−c)))`. Low joy and closeness sit lower; high joy rises.
- **Chord degrees:** `j < 0.25 → [1,3,5]`, `j < 0.6 → [1,3,5,7]`, else `[1,3,5,9]`. Add degree 4 if `s > 0.7` (a suspended, open colour).
- **Octaves:** `1 + round(2·s·(1−k))`, min 1, max 3.

## Rhythm (mainly calm, spontaneity)
- **Tempo:** `lerp(150, 56, k)` BPM, then `× lerp(0.9, 1.1, j)`.
- **Rate:** `k > 0.75 → "1/4"`, `k > 0.45 → "1/8"`, else `"1/16"`. Triplets (`"1/8t"`) if `s > 0.6` and `k > 0.45`.
- **Pattern:** `s < 0.3 → "up_down"`, `s < 0.6 → "up"`, else `"random"`.
- **Density:** `lerp(1.0, 0.6, s)` × `lerp(0.75, 1.0, 1−k)` (calm = sparser), clamp [0.35, 1].
- **Swing:** `0.4 · s`.
- **Jitter:** `lerp(0, 25, s)` ms.
- **Gate:** `lerp(0.35, 0.85, k)` (calm = longer, legato notes).
- **Arp on:** always, except when `k > 0.9 and j < 0.3` (very calm and low: drone only).

## Timbre (mainly warmth)
- **Wave:** `w > 0.66 → "sine"`, `w > 0.4 → "triangle"`, `w > 0.2 → "sawtooth"`, else `"square"`.
- **Voices / detune:** `voices = w > 0.5 ? 2 : 1`; `detune = lerp(2, 14, w)` cents (gentle chorus warmth).
- **Filter:** lowpass. `cutoff = 2^lerp(log2(400), log2(6000), 0.5·(1−w) + 0.35·j + 0.15·(1−k))` Hz. `resonance = lerp(0.7, 6, (1−w)·(1−k))`.
- **Envelope:** `attack = lerp(0.005, 0.25, k·w)`, `decay = 0.3`, `sustain = lerp(0.2, 0.6, w)`, `release = lerp(0.1, 1.5, k)`.

## Space (mainly closeness)
- **Volume:** `lerp(0.25, 0.6, c)` (before limits).
- **Reverb:** `mix = lerp(0.5, 0.12, c)`, `size = lerp(0.9, 0.5, c)`.
- **Delay:** `time = 60/tempo · 0.75` (dotted eighth), `feedback = lerp(0.45, 0.15, c)`, `mix = lerp(0.35, 0.1, c) · (0.5 + 0.5·k)`.
- **Width:** `lerp(1.0, 0.3, c)` (close = narrower, centred).

## Movement (LFOs)
- **LFO 1 → cutoff:** `rate = lerp(0.6, 0.05, k)` Hz, `depth = lerp(0.15, 0.5, s)`, shape `sine` (`random` if `s > 0.75`).
- **LFO 2 → amp (tremolo):** only if `k < 0.4`: `rate = lerp(6, 3, k/0.4)`, `depth = 0.15 + 0.2·(1−k)`.
- **Vibrato:** if `w > 0.7` replace LFO 2 with `pitch`, rate 4.5 Hz, depth 0.15 (only when LFO 2 isn't used for tremolo).

## Drone
- **On** if `k > 0.5 or j < 0.3`.
- **Notes:** root − 12 and root − 5 (fifth below the root's octave); if `j < 0.3` use root − 12 and root − 9 (minor third colour, darker).
- **Wave:** `"sine"` if `w > 0.5` else `"triangle"`. **Level:** `lerp(0.1, 0.3, k)`.

## Colour (follow mode)
`ResolvedColour = { h, s, l, secondary?, motion, texture, pulseHz }`
- **Hue:** blend of warmth and joy on a cold–warm wheel: `h = lerp(220, 30, 0.7·w + 0.3·j)` (blue → orange). Low joy desaturates rather than changing hue.
- **Saturation:** `lerp(0.15, 0.6, 0.5·j + 0.5·(1−k))`.
- **Lightness:** `lerp(0.12, 0.45, 0.6·j + 0.4·(cutoff normalised))`. The page stays dark overall; never above 0.6.
- **Secondary:** hue + 25°, lightness − 0.08, for a slow gradient.
- **Motion:** `k > 0.7 → "still"` or `"drift"`, else `"pulse"` synced to LFO 1, with `pulseHz = min(LFO1.rate, 1.0)`. Never above 3 Hz (limits.md enforces it).
- **Texture:** `"grain"` if `w < 0.3`, else `"soft_noise"` if `s > 0.6`, else `"flat"`.

In `own` mode, the model's HSL values replace hue/saturation/lightness; motion and pulse limits still apply.

## Override merge
Deep-merge the model's `synth` object over the mapped state, field by field. Arrays (`chord`, `lfo`, `drone.notes`) replace, not merge. Note names convert to MIDI. Record which fields were overridden in the state's `intent` (for the session details page).

## Unit tests to write
- Monotonicity: increasing `calm` never increases tempo; increasing `closeness` never decreases volume; increasing `warmth` never makes the wave harsher.
- Bounds: every output within the engine's valid ranges for all corners of the [0,1]^5 cube and 1000 random points.
- Snapshot tests for 6 reference moods (neutral, warm-close-calm, cold-distant, joyful-spontaneous, despair-calm, urgent).
