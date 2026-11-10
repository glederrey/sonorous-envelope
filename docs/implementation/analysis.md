# Analysis

> **Built (2026-11-09).** `analyze(effective, seed)` in `packages/shared/src/analysis.ts` (not a separate package), called by `set_sound` before the state is stored; the result is in `states.analysis` (the column already existed) and `sound` and `reads_as` are in the feedback. The render is 6 s at 22 050 Hz, the first second skipped; `fft` is a small in-file radix-2. Differences from the plan below: 32 log-spaced bands instead of 64 mel bands for the flux; the mode estimate uses the notes the layers cycle through (a few seconds of events is too little for a key profile) plus the third above the lowest note, not only the key profiles; the closeness reverb term is the ratio of the quietest frame to the mean frame (tails and drones fill the gaps); constants are in `RANGES` and come from `pnpm calibrate`. Spectrogram image (step 10) is not built; `inspect` has `what: "history"` only. On any failure the call still returns, with the note `analysis unavailable this time`; silence states have no analysis. States written before this have none and are measured on the fly by `get_feedback`.
>
> **Calibration (200 random moods, `pnpm calibrate`):** correlation of `reads_as` with the mood that was sent: warmth 0.72, closeness 0.41, joy 0.54, calm 0.89, spontaneity 0.54. None is near zero; closeness and joy are the weakest and are the ones to revise first. It is a rough second opinion, not a measurement of emotion.

`analyze(effective: EngineState, seed: number) → Analysis` in `packages/analysis`. Called by `set_sound` after the state is stored.

## Render
- `renderOffline(effective, { seconds: 8, sampleRate: 22050, seed })` in steady state (no glide: analyse the target, not the transition).
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

- **joy** (≈ valence): `0.5·modeBrightness + 0.1·norm(centroid) + 0.1·norm(tempo) + 0.3·(1 − roughness)`. Changed after the third outside test: brightness and tempo are arousal, so they only nudge joy; a minor mood on a square wave with an open filter had read 0.52 against 0.2 sent.
  `modeBrightness` from a pitch-class histogram of note events: correlate with Krumhansl–Kessler major and minor key profiles; `major − minor` correlation mapped to [0,1].
- **calm** (≈ inverted arousal): `1 − (0.3·norm(density) + 0.2·norm(loudness) + 0.15·norm(flux) + 0.1·norm(centroid) + 0.15·norm(tempo) + 0.1·roughness)`, with the density range 1 to 8 and the loudness range -31 to -24 dB (closeness keeps the wide loudness range). Changed after the third outside test: calm 0.12 sent had read 0.48; it now reads about 0.3 for the most urgent mood. Correlations on 200 moods: warmth 0.72, closeness 0.42, joy 0.57, calm 0.91, spontaneity 0.54.
- **warmth:** `1 − (0.45·norm(centroid) + 0.3·highFreqRatio + 0.25·roughness)`, with `highFreqRatio` = energy above 3 kHz / total.
- **closeness:** `0.4·norm(loudness) + 0.35·(1 − reverbRatio) + 0.25·(1 − width)`, with `reverbRatio` estimated as energy in the decay tail after note offsets / energy during notes.
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
