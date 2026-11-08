# Mood mapping

`moodToEngineState(mood: Mood): EngineState` in `packages/shared/src/mood-mapping.ts`. Pure and deterministic. The result is then overridden by the model's `synth` fields and finally passed through limits.

These formulas are a first guess, grounded in the cues in [emotion-to-sound.md](../emotion-to-sound.md). They must be tuned by listening. Keep them in one file with named constants so tuning is easy, and add a dev page (`/dev/mood`) with five sliders that plays the mapped result live.

Notation: `w` warmth, `c` closeness, `j` joy, `k` calm, `s` spontaneity, all in [0,1]. `lerp(a,b,t) = a + (b−a)·t`. `pick(list, t)` = `list[min(len−1, floor(t·len))]`.

## Harmony (mainly joy)
- **Base scale** by joy, from darkest to brightest (used where no chord-quality row below matches; those rows override it):
  `pick(["phrygian","harmonic_minor","minor","dorian","mixolydian","major","lydian"], j)`
- **Root:** D3 (MIDI 50), shifted by register: `root = 50 + round(lerp(-5, 7, 0.6·j + 0.4·(1−c)))`. Low joy and closeness sit lower; high joy rises.
- **Chord quality** by joy and calm (from the chord study). The first matching row wins and sets both scale and degrees; the chord then follows from them (a major scale with `[1,3,5,7]` is a maj7, dorian with `[1,3,5,7]` an m7, mixolydian a dominant 7, locrian with `[1,3,5]` a diminished triad):

  | Condition | Scale, degrees | Reads as |
  |---|---|---|
  | `j ≥ 0.55` and `k ≥ 0.5` | `w > 0.5 ? major : dorian`, `[1,3,5,7]` | maj7 (tenderness) or m7 (serenity) |
  | `j ≥ 0.55` and `k < 0.5` | `major`, `[1,3,5]`, plus 9 if `j > 0.8` | joy |
  | `0.4 ≤ j < 0.55` and `k < 0.4` | `mixolydian`, `[1,3,5,7]` | dominant 7: urgency, curiosity |
  | `j < 0.4` and `k ≥ 0.5` | `minor`, `[1,3,5]` | sadness |
  | `j < 0.4` and `k < 0.5` | `locrian`, `[1,3,5]` | diminished: fear (anger once roughness is added, see Timbre) |
  | none of the above | base scale; `j < 0.25 → [1,3,5]`, `j < 0.6 → [1,3,5,7]`, else `[1,3,5,9]` | a blend |

  Consent levels replace a disallowed scale by a fixed fallback (limits.md: locrian and phrygian become minor, chromatic becomes pentatonic), so in "ambient" the diminished row plays as minor.
- **Suspension:** add degree 4 if `s > 0.7`. This is a hypothesis to test: sus2 and sus4 are not in the chord study.
- **Octaves:** `1 + round(2·s·(1−k))`, min 1, max 3.

## Rhythm (mainly calm, spontaneity)
- **Tempo:** `lerp(150, 56, k)` BPM, then `× lerp(0.9, 1.1, j)`.
- **Rate:** `k > 0.75 → "1/4"`, `k > 0.45 → "1/8"`, else `"1/16"`. Triplets (`"1/8t"`) if `s > 0.6` and `k > 0.45`.
- **Pattern** (contour follows joy): `j ≥ 0.6 → "up"`, `j ≤ 0.4 → "down"`, else `"up_down"`; `"random"` if `s > 0.75`.
- **Notes per cycle:** `N = 3 + round(3·(1−k))`: 3 when calm, 6 when urgent, but never fewer than the chord has. The `chord` is extended to N degrees by continuing past the top (`[1,3,5,7]` with N=6 gives `[1,3,5,7,8,10]`). `octaves` then repeats that list upward, so the cycle is N × octaves long. (Tempo and rate above give about 1 note per second when calm and 10 when urgent, matching the cue table.)
- **Density:** `lerp(1.0, 0.6, s)` × `lerp(0.75, 1.0, 1−k)` (calm = sparser), clamp [0.35, 1].
- **Swing:** `0.4 · s`.
- **Jitter:** `min(30, lerp(0, 25, s) + 5·(1−j)·k)` ms. Sadness (low joy, calm) adds a small tremor; tenderness stays regular.
- **Gate:** `lerp(0.3, 0.95, 0.6·k + 0.4·w)` (calm and warm = legato; urgent and cold = staccato).
- **Arp on:** always, except when `k > 0.9 and j < 0.3` (very calm and low: drone only).

## Timbre (mainly warmth)
- **Wave:** `w > 0.66 → "sine"`, `w > 0.4 → "triangle"`, `w > 0.2 → "sawtooth"`, else `"square"`.
- **Voices / detune:** `voices = w > 0.5 ? 2 : 1`; `detune = lerp(2, 14, w)` cents (gentle chorus warmth).
- **Filter:** lowpass. `cutoff = 2^lerp(log2(400), log2(6000), 0.5·(1−w) + 0.35·j + 0.15·(1−k))` Hz. `resonance = lerp(0.7, 6, (1−w)·(1−k))`.
- **Envelope:** `attack = lerp(0.005, 0.3, k·(0.6 + 0.4·w))` (fast for joy and anger, 100 ms or more for sadness and tenderness); `decay = lerp(0.5, 0.15, j)` (joy: short decay); `sustain = lerp(0.2, 0.65, 0.5·w + 0.5·k)` (tenderness: high sustain); `release = min(2, lerp(0.1, 1.5, k) · lerp(1, 1.3, 1−j))` (lingering for sadness).
- **Roughness (`osc.drive`, 0 to 1, soft saturation before the filter):** `drive = 0.8 · max(0, 0.6−j)/0.6 · max(0, 0.6−k)/0.6 · max(0, 0.9−w)/0.9`, so it is exactly 0 whenever joy ≥ 0.6, calm ≥ 0.6 or warmth ≥ 0.9. Anger is low joy, urgent, cold and rough; the same corner with warmth stays fearful (darker, no drive). Counted in harshness (limits.md), so only "expressive" and "anything" allow it. Detune also widens: `detune += 10·drive` cents.

## Space (mainly closeness)
- **Volume:** `lerp(0.25, 0.6, c)` (before limits).
- **Reverb:** `mix = lerp(0.5, 0.12, c)`, `size = lerp(0.9, 0.5, c)`.
- **Delay:** `time = min(0.75, 60/tempo · 0.75)` s (dotted eighth), `feedback = min(0.6, lerp(0.45, 0.15, c))`, `mix = lerp(0.35, 0.1, c) · (0.5 + 0.5·k)`. The delay amplifies the emotion that is present instead of adding one, so it is not tied to a single axis. The caps keep the resonance from becoming unpleasant. The listener's own delay control is added on top (limits.md).
- **Width:** `lerp(1.0, 0.3, c)` (close = narrower, centred).

## Movement (LFOs)
- **LFO 1 → cutoff** (a permanent, discreet breathing): `rate = lerp(0.3, 0.1, k)` Hz, `depth = lerp(0.15, 0.5, s)`, shape `sine` (`random` if `s > 0.75`).
- **LFO 2 → amp (tremolo):** only if `k < 0.4`: `rate = lerp(6, 3, k/0.4)`, `depth = 0.15 + 0.2·(1−k)`.
- **Vibrato:** if `w > 0.7` replace LFO 2 with `pitch`, `rate = lerp(4, 6.5, 1−k)` Hz (slow and light when calm and tender, faster when urgent), `depth = lerp(0.1, 0.2, 1−k)` (only when LFO 2 isn't used for tremolo).

## Drone
- **On** if `k > 0.5 or j < 0.3`.
- **Notes:** root − 12 and root − 5 (fifth below the root's octave); if `j < 0.3` use root − 12 and root − 9 (minor third colour, darker).
- **Wave:** `"sine"` if `w > 0.5` else `"triangle"`. **Level:** `lerp(0.1, 0.3, k)`.

## Background (bass) layer
A low, slow arpeggio for the background mood (sound-model.md, "Two arpeggios"). It is the mood; the foreground arpeggio above is the affect.
- **Slow mood:** per axis, `slow = lerp(slow, mood, 0.25)`, updated on every `final: true` update and not on mid-turn ones, starting from the first mood of the session. Stored on the state row (`slow_mood`). 0.25 is a starting value: it takes about four responses to cover most of a change. It barely moves by design.
- **Chord:** the chord-quality rules applied to `slow`, at root − 12.
- **Steps:** one note every `lerp(1, 2, slow.calm)` s, pattern `up_down`, gate 1, wave `sine` if `slow.warmth > 0.5` else `triangle`, level `lerp(0.1, 0.25, slow.calm)`.
- If the bass layer and the drone sound muddy together, drop the mapped drone (it stays available through the override). Check by ear.

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
- Chord quality: for each row of the table, a mood inside its region gives the listed scale and degrees; boundaries use the first matching row.
- Contour: `joy ≥ 0.6` never gives a falling pattern; `joy ≤ 0.4` never gives a rising one.
- Roughness: `drive` is 0 whenever `joy ≥ 0.6`, `calm ≥ 0.6` or `warmth ≥ 0.9`.
- Background layer: the slow mood moves exactly 25 % of the remaining distance per final update, never changes on a non-final update, and converges to a constant mood.
- Release and attack stay inside their ranges at every corner of the cube.
