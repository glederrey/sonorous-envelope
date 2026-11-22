# Analysis

The model needs to know what it actually produced in order to update it. `analyze(effective, seed) → Analysis` in `packages/shared/src/analysis.ts` renders the state offline and measures it. `set_sound` calls it before the state is stored; the result is in `states.analysis`, and `sound` and `reads_as` go into the feedback (the feedback object is in [mcp-tools.md](mcp-tools.md)). States stored without an analysis are measured on the fly by `get_feedback`. Silence states have none, and neither has a Strudel state: the server never runs the model's code, so it has no `sound` and no `reads_as`. On any failure the call still returns, with the note `analysis unavailable this time`.

Everything stays in TypeScript: the heuristics below are the estimate. There is no external or Python emotion model (Gael's decision, #153 closed as not planned); calibration continues in #166.

## Render
- `renderOffline` of the steady state (the analysis ignores the tempo glide: it measures the target, not the transition), at 22 050 Hz with a fixed seed, so it needs no player and does not depend on one. The first second is skipped. The length fits about ten arpeggio steps, between 6 and 14 s, so slow sounds have enough onsets to read.
- Mono for the spectral features; stereo kept for the width.
- The listener's volume is not included (it is not part of the state). The feedback reports it as `controls`.
- Render plus analysis should stay under 300 ms on Vercel.

## Features

| Feature | Computation | Reported as |
|---|---|---|
| Loudness | RMS over the render → dBFS: `20·log10(rms)` | `loudness_db`, integer |
| Brightness | Spectral centroid per frame (Hz), median over frames | words: < 400 very low, < 900 low, < 1800 medium, < 3500 high, else very high |
| Roughness | From the note events, not the audio. At every second note event the set is the notes sounding within 0.4 s plus the held ones (drone, pad), each with the partials of its own wave (up to the 6th). Plomp–Levelt dissonance (Sethares) of every pair, in units of a minor second at mid register on a sawtooth; the pairs add up and saturate: `1 − exp(−sum)` per set, averaged over the sets. Two held notes in a consonant interval (octave, third, fourth, fifth, sixth) do not count against each other | `roughness`, 0–1 |
| Density | Note events per second | words: 0 silent, < 2 sparse, < 6 medium, else dense |
| Movement | Mean spectral flux (positive differences of normalised frames over 32 log-spaced bands) | words: still, slow, moving, busy |
| Pitch range | Lowest and highest MIDI note in events | stored, not returned |
| Width | Mid/side energy ratio | stored, used for closeness |
| Onset irregularity | Rms distance of the gaps between onsets from a whole number of steps, scaled so a fifth of a step reads as fully irregular. Skipped steps do not count | stored, used for spontaneity |

Everything is stored in `states.analysis`; only the compact subset in mcp-tools.md is returned. The word thresholds and the `norm()` ranges are in `RANGES` (`analysis.ts`) and come from `pnpm calibrate`.

## Mood estimate (`reads_as`)
Independent of the mapping: computed only from the audio features and note events, never from the mood the model sent. Otherwise it would just echo the intent. All terms are normalised to [0,1] with the calibrated ranges, then clipped. Each value is rounded to 2 decimals.

Existing music-emotion models predict valence and arousal, and two axes map onto those: `joy` ≈ valence, `calm` ≈ inverted arousal. The other three have no model, so all five are transparent heuristics: the model can see why it got an estimate (`reads_why`). The starting point is the cue table in [emotion-to-sound.md](../emotion-to-sound.md) (faster, higher, brighter, more attack and roughness = more activation; major and rising = more joy), checked on our own sounds. Music models are trained on recorded songs with full mixes, and a sparse synth arpeggio is far outside that data, so a heuristic that can be inspected serves better than a model that cannot.

- **joy** (≈ valence): `0.5 + 1.25·(0.5·modeBrightness + 0.1·norm(centroid) + 0.1·norm(tempo) + 0.3·(1 − roughness) − 0.54)`. Brightness and tempo are arousal, so they only nudge joy. The gain of 1.25 around 0.5 widens a sum that compressed toward the middle.
  `modeBrightness = 0.25·key + 0.4·third + 0.2·sixth + 0.15·second`, from a pitch-class histogram of the notes the layers cycle through plus the notes of the arpeggio's scale (once each: the chord tones alone cannot tell dorian from aeolian). `key` is the Krumhansl–Kessler `major − minor` correlation mapped to [0,1]. `third`, `sixth` and `second` are the share of the bright interval (4, 9, 2 semitones) against the dark one (3, 8, 1) above the tonic, which is `state.arp.root`; none of the pair present is 0.5. Reading order at joy 0.6 on a voice: mixolydian, major, lydian, dorian, minor, phrygian.
- **tension:** `norm(clash, [0, 3.05]) ^ 0.6`, where `clash` is the mean over arpeggio onsets of the weights of the semitone (1), major seventh (1), tritone (0.8) and minor seventh/second (0.25) pairs inside one onset (a note and the stack started on it). Only what starts together counts, so the reading does not follow rate, density, calm or the voice. It feeds the smoothness term of joy.
- **calm** (≈ inverted arousal): `1 − (0.3·norm(density) + 0.2·norm(loudness) + 0.15·norm(flux) + 0.1·norm(centroid) + 0.15·norm(tempo) + 0.1·norm(roughness))`, with the density range 1 to 8 and the loudness range -31 to -24 dB.
- **warmth:** `1.112 − 0.071·ln(centroidHz) − 0.377·ln(centroidHz / pitchHz) + 0.188·roughness + 0.098·waveRichness`, a least-squares fit (`pnpm fit-warmth`, `scripts/fit-warmth.ts`) on random moods, moods with an adopted voice and a warmth sweep at neutral axes. `pitchHz` is the mean pitch of the notes played and held: the centroid over it is the brightness of the timbre whatever the register (the centroid alone took a voice spread over three octaves for a bright one). `waveRichness` is the sum of the partial amplitudes of the arp wave (sine 1, triangle 1.15, square 1.53, sawtooth 2.45). In `reads_why` the first term is `darkness` (1 − norm(centroid)): a dark sound lifts warmth.
- **closeness:** `0.605 − 1.12·width − 0.13·reverbRatio + 0.19·roughness`, a least-squares fit. `reverbRatio` is the energy in the decay tail after note offsets over the energy during notes. It is dominated by the stereo width, which the mapping sets from closeness, so a tester should still compare by ear.
- **spontaneity:** `0.5·onsetIrregularity + 0.3·patternEntropy + 0.2·norm(flux variance)`, with `patternEntropy` the normalised entropy of the interval sequence between successive notes. The mapping sets the timing looseness (`jitterMs`) up to 18 % of a step, so spontaneity is audible on slow sounds as well as measurable.

### Calibration
`pnpm calibrate` renders 200 random moods, prints the min/max/percentiles used for `norm()` and the correlation of `reads_as` with the mood that was sent, plus the bias and slope per axis and a round-trip table for warmth and joy. Correlations on the 200 moods: warmth 0.86, closeness 0.94, joy 0.73, calm 0.90, spontaneity 0.89. Closeness and joy are the weakest and the first to revise. Known gaps: with no voice and neutral warmth the mapping picks dorian at any high joy, so joy 0.8 reads 0.60; joy 0.2 reads about 0.13 high; warmth 0.9 reads 0.75 (the centroid saturates, so the reading cannot rise past about 0.75). It is a rough second opinion, not a measurement of emotion; if an axis correlates near zero it is useless and must be revised.

## Snapshot: the picture and the sound at the player
The model can read images in tool results, and a picture of the sound shows what numbers flatten: the arpeggio's shape, the filter sweep, how dense or empty it is. The server never renders it: the owner's player takes it from what it really shows and plays, so it also covers Strudel (which has no `reads_as`) and the listener's own output.

- **What it is.** One small JPEG (512 px wide): the picture the player shows on top (the base colour, the scenes canvas, and Strudel's drawings while they are what shows), a spectrogram of the last ~10 s of the player's output below (40 Hz to 12 kHz, low notes at the bottom), and the numbers measured from that output (`seconds`, `loudness_db`, `peak_db`, `centroid_hz`, `brightness`, `onsets_per_s`, `quiet_share`). The level is measured after the listener's volume (the tap sits at the player's output), so the result says not to compensate for it, and carries `listener_volume`.
- **Who takes it.** Only the owner's browser, while the audio runs and the page is visible, a few seconds after each new sound (its transition plus 3 s, between 6 and 14 s) and every 30 s after that. It is stored as one row per session (`snapshots`, replaced each time); only the owner can read it ([database.md](database.md)).
- **The owner sees it too.** When the model asks, the server stores a copy of the image it was given and the time (`snapshots.seen_image`, `seen_at`, via `mark_snapshot_seen`). The owner's panel "What the AI saw" shows that copy and how long ago the model looked, so the picture is exactly the one the model saw, not the newer live one.
- **How the model asks.** `inspect` with `what: "snapshot"`. The result says whether it is of the current sound or of an earlier one. Nothing comes back with `set_sound`: `every_turn` is not built.
- **Setting.** `image_feedback`: `on_request` (default) or `off`, switched by the owner with "Let the AI see the picture" in the player. With `off` the player takes nothing and `inspect` answers `image_feedback_off`.
- **Not the camera or the microphone.** The image is drawn from the player's own canvases and its audio output.

## Tracking over time
Two biases are worth watching once there is real data:
- **Lukewarm bias.** Models may drift toward safe, middling moods. Log the distribution of intent per axis across sessions and flag a distribution that never leaves 0.3 to 0.7.
- **Intent vs reading.** Keep the analysis scores for each final state, so the estimator can be compared across conversations.

A blind check is also possible: a second model instance, given only the snapshot or the feature summary, rates the mood without seeing the intent. Agreement with the first instance's intent measures whether the sound carries the mood. This is an experiment, not part of the build.

## Timing
Feedback comes back on every call, including mid-turn ones, so the model can adjust within a turn. Listener reactions happen while the model isn't running, so they arrive on the first call of the next turn, or at once while `listen` waits (live tuning, Attuned and Jukebox: the model calls `listen` after its final `set_sound`, gets the press within seconds and answers it in the same message; see [mcp-tools.md](mcp-tools.md)).
