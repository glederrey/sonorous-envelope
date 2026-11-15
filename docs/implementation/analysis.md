# Analysis

> **Built (2026-11-09).** `analyze(effective, seed)` in `packages/shared/src/analysis.ts` (not a separate package), called by `set_sound` before the state is stored; the result is in `states.analysis` (the column already existed) and `sound` and `reads_as` are in the feedback. The render is 6 s at 22 050 Hz, the first second skipped; `fft` is a small in-file radix-2. Differences from the plan below: 32 log-spaced bands instead of 64 mel bands for the flux; the mode estimate uses the notes the layers cycle through (a few seconds of events is too little for a key profile) plus the third above the lowest note, not only the key profiles; the closeness reverb term is the ratio of the quietest frame to the mean frame (tails and drones fill the gaps); constants are in `RANGES` and come from `pnpm calibrate`. Spectrogram image (step 10) is not built; `inspect` has `what: "history"` only. On any failure the call still returns, with the note `analysis unavailable this time`; silence states have no analysis. States written before this have none and are measured on the fly by `get_feedback`.
>
> **Calibration (200 random moods, `pnpm calibrate`; v0.19.1):** correlation of `reads_as` with the mood that was sent: warmth 0.85, closeness 0.95, joy 0.73, calm 0.90, spontaneity 0.89. `pnpm calibrate` also prints the bias (read − sent) and slope per axis and a round-trip table (warmth and joy at neutral other axes, through the stretch and the mapping, with and without a voice scale). Known gaps: with no voice and neutral warmth the mapping picks dorian at any high joy, so joy 0.8 reads 0.60; joy 0.2 reads about 0.13 high; warmth 0.9 reads 0.75. None is near zero; closeness and joy are the weakest and are the ones to revise first. It is a rough second opinion, not a measurement of emotion.

`analyze(effective: EngineState, seed: number) → Analysis` in `packages/analysis`. Called by `set_sound` after the state is stored.

## Render
- `renderOffline(effective, { seconds: 8, sampleRate: 22050, seed })` in steady state (the analysis ignores the tempo glide: it analyses the target, not the transition).
- Mix to mono for spectral features; keep stereo for width.
- The listener's local volume is not included (it isn't part of the state). Report its effect from the reactions instead.

## Frames
- STFT: window 1024 (Hann), hop 512 → ~43 frames/s.
- Magnitude spectrum per frame; also a 64-band mel spectrum (for the spectrogram and flux).

## Features

| Feature | Computation | Reported as |
|---|---|---|
| Loudness | RMS over the whole render → dBFS: `20·log10(rms)`. (Proper LUFS with K-weighting is a later improvement.) | `loudness_db`, integer |
| Brightness | Spectral centroid per frame (Hz), median over frames | words: < 400 very low, < 900 low, < 1800 medium, < 3500 high, else very high |
| Roughness | From the note events, not the audio: for each pair of simultaneously sounding notes (incl. drone and first 6 harmonics with 1/n amplitudes), Plomp–Levelt dissonance (Sethares' formula); average over time, normalised so a minor second at mid register ≈ 1 | `roughness`, 0–1 |
| Density | Note events per second (arp + gestures) | words: 0 silent, < 2 sparse, < 6 medium, else dense |
| Movement | Mean spectral flux (positive differences of normalised mel frames) + LFO depth·rate contribution | words: still, slow, moving, busy (thresholds tuned on reference moods) |
| Pitch range | Lowest and highest MIDI note in events | stored, not returned by default |
| Width | Mid/side energy ratio | stored, used for closeness estimate |
| Onset irregularity | Std dev of inter-onset intervals / mean | stored, used for spontaneity |

Store everything in `states.analysis`; return only the compact subset described in mcp-tools.md.

## Mood estimate (`reads_as`)
Independent of the mapping: computed only from the audio features and note events, never from the mood the model sent. Otherwise it would just echo the intent.

All terms normalised to [0,1] with ranges calibrated on the reference moods, then clipped.

- **joy** (≈ valence, v0.19.1): `0.5 + 1.25·(0.5·modeBrightness + 0.1·norm(centroid) + 0.1·norm(tempo) + 0.3·(1 − roughness) − 0.5)`. Brightness and tempo are arousal, so they only nudge joy (third outside test: a minor mood on a square wave with an open filter had read 0.52 against 0.2 sent). The gain of 1.25 around 0.5 widens a sum that compressed toward the middle (slope of read on sent 0.36 over random moods, now 0.66).
  `modeBrightness` (v0.19.1) = `0.25·key + 0.4·third + 0.2·sixth + 0.15·second`, from a pitch-class histogram of the notes the layers cycle through plus the notes of the arpeggio's scale (once each: the chord tones alone cannot tell dorian from aeolian). `key` is the Krumhansl–Kessler `major − minor` correlation mapped to [0,1]. `third`, `sixth` and `second` are the share of the bright interval (4, 9, 2 semitones) against the dark one (3, 8, 1) above the **tonic**, which is `state.arp.root`; none of the pair present is 0.5. Before, the tonic was the lowest pitch, so a dorian voice swung between 0.2 and 0.8 on which note was lowest (joy 0.6 read 0.27). Reading order at joy 0.6 on a voice: mixolydian 0.81, major 0.79, lydian 0.79, dorian 0.57, minor 0.45, phrygian 0.40.
- **tension:** `norm(clash, [0, 3.05]) ^ 0.6`, where `clash` is the mean over arpeggio onsets of the weights of the semitone (1), major seventh (1), tritone (0.8) and minor seventh/second (0.25) pairs inside one onset (a note and the stack started on it). Only what starts together counts, so the reading does not follow rate, density, calm or the voice (measured on four voices and three rates: identical). The stack levels read 0, 0.22, 0.45, 0.73, 1.0 for tension 0.1, 0.3, 0.5, 0.7, 0.9. It feeds the smoothness term of joy.
- **calm** (≈ inverted arousal): `1 − (0.3·norm(density) + 0.2·norm(loudness) + 0.15·norm(flux) + 0.1·norm(centroid) + 0.15·norm(tempo) + 0.1·roughness)`, with the density range 1 to 8 and the loudness range -31 to -24 dB (closeness keeps the wide loudness range). Changed after the third outside test: calm 0.12 sent had read 0.48; it now reads about 0.3 for the most urgent mood. Correlations on 200 moods: warmth 0.72, closeness 0.42, joy 0.57, calm 0.91, spontaneity 0.54.
- **warmth (v0.19.1):** `3.0 − 0.345·ln(centroidHz) − 0.62·roughness − 0.11·highFreqRatio` (high-frequency ratio scaled by 8, clamped), a least-squares fit on 300 random moods plus a sweep of warmth at neutral other axes (the v0.17.1 fit, `2.65 − 0.33·ln − 0.52·roughness − 0.06·hf`, read 0.15 to 0.3 low there: sent 0.9 read 0.53). Round trip at neutral axes now: sent 0.2, 0.4, 0.6, 0.8, 0.9 read 0.21, 0.30, 0.62, 0.75, 0.75. Sent 0.8 and above stretch to the same sound (the centroid saturates at about 325 Hz), so the reading cannot rise past about 0.75 whatever is sent; random-mood bias went from −0.19 to 0.00. Before: `1 − (0.45·norm(centroid) + 0.3·highFreqRatio + 0.25·roughness)`. The v0.17.0 test read warmth 0.66 for 0.2 sent. Correlation with the mood sent on 200 moods: 0.86 (was 0.72). In `reads_why` its first term is labelled `darkness` (value 1 − norm(centroid)), not `brightness`: a dark sound lifts warmth, and "lifted by brightness" told the model the opposite (v0.19.2).
- **closeness (v0.17.1):** `0.59 − 1.12·width − 0.13·reverbRatio + 0.19·roughness`, a least-squares fit (held-out r 0.96, in the calibration 0.95; was 0.48 with `0.4·norm(loudness) + 0.35·(1 − reverbRatio) + 0.25·(1 − width)`). The test read closeness 0.51 for 0.1 sent. `reverbRatio` is the energy in the decay tail after note offsets over the energy during notes. It is dominated by the stereo width, which the mapping sets from closeness, so a tester should still compare by ear.
- **spontaneity:** `0.5·norm(onsetIrregularity) + 0.3·patternEntropy + 0.2·norm(flux variance)`, with `patternEntropy` = normalised entropy of the interval sequence between successive notes.

Return each rounded to 2 decimals.

### Calibration
- Write a script `pnpm calibrate` that renders 200 random moods, computes features, and prints the min/max/percentiles used for `norm()`. Commit the resulting constants.
- Report in the README how well `reads_as` tracks intent on those 200 moods (correlation per axis). It doesn't need to be high: it is meant as an independent second opinion. But if correlation is near zero for an axis, the estimate for that axis is useless and should be revised.

### Later: learned models
Essentia's arousal/valence models or Music2Emo could replace the heuristics for joy and calm. They need Python and are trained on real songs, so they run as a separate service and are compared against the heuristics before switching.

## Spectrogram image (milestone 10)
- Mel spectrogram of the 8 s render: 64 mel bands × ~344 frames, log magnitude, scaled to 512 × 192 px, perceptual colour map (e.g. magma).
- Under it, a 512 × 24 px strip showing the colour field over the same 8 s (sampled from the colour motion).
- Encode as PNG with `pngjs`, return as an MCP image content block (`mimeType: "image/png"`, base64).
- Caption text block: `"Last 8 s: mel spectrogram (low pitches at the bottom), colour strip below."`
- Typical size: ~30–60 KB. Generate on demand only; don't store images.

## Performance
- Render + analysis < 300 ms on Vercel (8 s × 22 050 Hz ≈ 176 k samples; ~344 FFTs of 1024 points).
- If a call times out, return feedback without `reads_as` and `sound`, with the note `"analysis unavailable this time"`.

## Timing reading on slow sounds (2026-11-10)
Round 6: on a slow sound (one note a second) spontaneity read 0.03 whatever was sent, for two reasons. The mapping made timing looseness a fixed 25 ms at most, which is inaudible against a one-second step; it is now up to 18 % of the step (`jitterMs` in mood-mapping.ts, capped at 150 ms). And the measurement had too few onsets to read from, and counted a skipped step (a two-step gap) as irregular timing. The render now lasts long enough for about ten steps (6 to 14 s), and irregularity is the rms distance of the gaps from a whole number of steps, so skipped steps do not count, scaled so a fifth of a step reads as fully irregular. The correlation of `reads_as.spontaneity` with the sent value went from 0.54 to 0.80 (`pnpm calibrate`).

`reads_as` is made by the server, which renders the state offline with a fixed seed: it needs no player and does not depend on one, and says nothing about how a listener hears it. The instructions say so.
