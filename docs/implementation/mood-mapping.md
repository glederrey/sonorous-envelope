# Mood mapping

`moodToEngineState(mood: Mood): EngineState` in `packages/shared/src/mood-mapping.ts`. Pure and deterministic. The result is then overridden by the model's `synth` fields and finally passed through limits.

These formulas are a first guess, grounded in the cues in [emotion-to-sound.md](../emotion-to-sound.md). They must be tuned by listening. Keep them in one file with named constants so tuning is easy, and add a dev page (`/dev/mood`) with five sliders that plays the mapped result live.

> **Built (first outside test, 2026-11-09), tune by ear.** The mapping below makes every instance that sends only the five axes sound alike: the same four notes, going up, a bit hesitant. The cause is arithmetic, not taste. At the values instances actually send (0.45 to 0.72 on every axis) the formulas give: chord `[1,3,5,7]` (joy ≥ 0.55, calm ≥ 0.5), `N = 3 + round(3·(1−k))` = 4 notes at calm 0.6, `octaves = 1 + round(2·s·(1−k))` = 1, pattern `up` or `up_down` (`random` needs spontaneity > 0.75), rate `1/8`, and density `lerp(1, 0.6, s) × lerp(0.75, 1, 1−k)` ≈ 0.68, so about a third of the steps are skipped, which is the hesitation people hear. Thresholds and rounding collapse the whole middle band onto one shape. The sections "Stretch" and "Voice" at the end, and the marked changes to Rhythm below, are the fix. Tune all numbers by ear.

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

  No consent levels any more: every scale is allowed as mapped.
- **Suspension:** add degree 4 if `s > 0.7`. This is a hypothesis to test: sus2 and sus4 are not in the chord study.
- **Octaves:** `1 + round(3·(1−c)·(0.5 + 0.5·s))`, min 1, max 4 (was `1 + round(2·s·(1−k))`, max 3). Closeness narrows or widens the span: close and measured gives 1 octave, distant and spontaneous gives 3 to 4.
- **Open voicing:** if `c < 0.4`, spread the chord: a `[1,3,5,7]` becomes `[1,5,7,10]` (the third moves up an octave), so the arpeggio does not stay a tight block of four neighbours.

## Rhythm (mainly calm, spontaneity)
- **Tempo:** `lerp(150, 56, k)` BPM, then `× lerp(0.9, 1.1, j)`.
- **Rate:** `k > 0.75 → "1/4"`, `k > 0.45 → "1/8"`, else `"1/16"`. Triplets (`"1/8t"`) if `s > 0.6` and `k > 0.45`.
- **Pattern** (spontaneity chooses the family, joy the contour inside the measured one):
  - `s ≤ 0.4`: contour follows joy, as before: `j ≥ 0.6 → "up"`, `j ≤ 0.4 → "down"`, else `"up_down"`.
  - `0.4 < s ≤ 0.6`: `"as_played"` over a chord order permuted once from the session's voice seed (below), so the notes do not simply climb and do not reorder on every update (the per-state `seed` changes each time).
  - `s > 0.6`: `"random"` (was `s > 0.75`).
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
- **Volume:** the constant `MASTER_VOLUME` (0.5), whatever the mood. Loudness belongs to the listener's slider.
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
- **Slow mood** (follows the stretched values, like everything else after step 0 of limits.md): per axis, `slow = lerp(slow, mood, 0.25)`, updated on every `final: true` update and not on mid-turn ones, starting from the first mood of the session. Stored on the state row (`slow_mood`). 0.25 is a starting value: it takes about four responses to cover most of a change. It barely moves by design.
- **Chord:** the chord-quality rules applied to `slow`, at root − 12.
- **Steps:** one note every `lerp(1, 2, slow.calm)` s, pattern `up_down`, gate 1, wave `sine` if `slow.warmth > 0.5` else `triangle`, level `lerp(0.1, 0.25, slow.calm)`.
- If the bass layer and the drone sound muddy together, drop the mapped drone (it stays available through the override). Check by ear.

## Colour (follow mode)
`ResolvedColour = { h, s, l, secondary?, motion, texture, pulseHz }`
- **Hue:** a walk round the wheel, no emotion attached: `t = 0.45·w + 0.3·j + 0.25·(1−k)`, `h = (250 − 300·t) mod 360` (blue, cyan, green, yellow, orange, red, magenta), so moods that sound different also look different. It is only a default; Claude can send any hue (0 to 360). Low joy desaturates rather than changing hue.
- **Saturation:** `lerp(0.15, 0.6, 0.5·j + 0.5·(1−k))`.
- **Lightness:** `lerp(0.12, 0.45, 0.6·j + 0.4·(cutoff normalised))`. The page stays dark overall; never above 0.6.
- **Secondary:** hue + 25°, lightness − 0.08, for a slow gradient.
- **Motion:** `k > 0.7 → "still"` or `"drift"`, else `"pulse"` synced to LFO 1, with `pulseHz = min(LFO1.rate, 1.0)`. Never above 3 Hz (limits.md enforces it). The pulse only ever follows the cutoff LFO. An `amp` LFO at audio-like rates (20 to 80 Hz, planned) is sound only and never drives the colour: a pulse at that rate would break the 3 Hz rule.
- **Texture:** `"grain"` if `w < 0.3`, else `"soft_noise"` if `s > 0.6`, else `"flat"`.

In `own` mode, the model's HSL values replace hue/saturation/lightness; motion and pulse limits still apply.

## Stretch
Instances send cautious values, mostly between 0.4 and 0.7, so they all land on the same stretch of the mapping. Two measures, both needed:
- **Stretch the middle.** Before mapping, each axis goes through `stretch(x) = clamp(0.5 + 1.6·(x − 0.5), 0, 1)`: 0.4 becomes 0.34, 0.7 becomes 0.82. It is monotonic and keeps 0.5 where it is. It runs before the mood floor (limits.md step 1), so a floor is never lowered by it. The feedback `intent` still shows the values the model sent.
- **Ask for the full range.** The server instructions tell the model that 0.4 to 0.7 reads as lukewarm and that it should commit to its values (server-instructions.md, planned wording).

## Voice
A voice is the part of the sound that says who is playing, as opposed to how it is doing: root note, scale, chord shape, note order, number of octaves and wave. It makes instances differ from one another, which the five axes alone cannot do.
- **The instance chooses it** (`voice` on `start_session`, optionally replaced later with `voice` on `set_sound`). Same fields and limits as the matching ones in `synth` (`arp.root`, `arp.scale`, `arp.chord`, `arp.pattern`, `arp.octaves`, `osc.wave`, later `osc.stack`). It is stored on the session (`sessions.voice`).
- **It persists by default** from turn to turn, which gives the unity of a voice. The axes keep driving everything else (tempo, rate, filter, envelope, space).
- **It is never a prison.** `set_sound` can replace it at any time, for instance when the conversation turns (anger, disrespect, a change of subject). A replacement uses a longer transition, like any big change.
- **Voice seed:** `voiceSeed = hash(session id)`, fixed for the session. It drives the fallback voice and the `as_played` permutation. It is separate from the per-state seed of `set_sound`, which only drives the engine's randomness.
- **Fallback when the instance chooses none:** a default voice drawn from the voice seed, so two instances that send the same axes still differ: root offset of up to ±3 semitones, one of a few chord shapes (closed, open, with a 9th, suspended), a note order and an octave count. The fallback keeps the joy contour rule and the consent fallbacks; an explicit voice does not.
- **Merge order:** mapped → voice → `synth` of this call → limits. Only the safety rules in limits.md apply afterwards (no consent ceilings any more).
- **Limits do not change.** Safety is enforced after the merge, as before. A voice is expressive freedom, not a way around a listener's settings.

## Override merge
Deep-merge the model's `synth` object over the mapped state, field by field. Arrays (`chord`, `lfo`, `drone.notes`) replace, not merge. Note names convert to MIDI. Record which fields were overridden in the state's `intent` (for the session details page).

## Unit tests to write
- Monotonicity: increasing `calm` never increases tempo; the volume is the constant `MASTER_VOLUME` whatever the mood; increasing `warmth` never makes the wave harsher.
- Bounds: every output within the engine's valid ranges for all corners of the [0,1]^5 cube and 1000 random points.
- Snapshot tests for 6 reference moods (neutral, warm-close-calm, cold-distant, joyful-spontaneous, despair-calm, urgent).
- Chord quality: for each row of the table, a mood inside its region gives the listed scale and degrees; boundaries use the first matching row.
- Contour: with `spontaneity ≤ 0.4`, `joy ≥ 0.6` never gives a falling pattern and `joy ≤ 0.4` never gives a rising one. (Above 0.4 spontaneity chooses `as_played` or `random`, so the contour test no longer applies.)
- Variety: 200 random moods drawn from [0.4, 0.7]^5 must not all give the same (chord, pattern, octaves) triple; at least 6 distinct triples. This is the regression test for "four rising notes".
- Stretch: `stretch` is monotonic, fixes 0.5, and stays in [0,1]; a mood floor is still met after stretch.
- Voice: a session voice survives later `set_sound` calls that send no voice; a new voice replaces it; the seeded fallback is deterministic per session id and differs between ids.
- Roughness: `drive` is 0 whenever `joy ≥ 0.6`, `calm ≥ 0.6` or `warmth ≥ 0.9`.
- Background layer: the slow mood moves exactly 25 % of the remaining distance per final update, never changes on a non-final update, and converges to a constant mood.
- Release and attack stay inside their ranges at every corner of the cube.

## What is built (v0.1.3)
`stretchMood` runs in `set_sound` before the mood floor; the transition-distance check stretches the previous mood too. The voice is stored in `sessions.voice` (migration 0004), sent with `start_session` or replaced with `set_sound` (`{}` clears it; a replacement gets a transition of at least 8 s). Mapping order in `service.ts` (`mapSound`): `moodToEngineState(stretched mood, slow mood, voiceSeed)` → voice → the call's `synth` → limits. The fallback character (`characterFor`: root ±3, chord shape closed/open/ninth/suspended, octaves ±1) applies inside `moodToEngineState` whenever a seed is given, and the explicit voice overrides it field by field. `as_played` shuffles the chord once from the voice seed. The `/dev/mood` page is not built.
