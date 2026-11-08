# Feedback loop

The model needs to know what it actually produced in order to update it. Every `set_sound` and `get_feedback` call returns a compact summary of around 150 tokens.

## What comes back

1. **Effective settings.** Not an echo of what the model sent, but what is playing after the mood mapping, the listener's changes and the limits, plus the difference. Example: `volume 0.8 → 0.5 (listener limit)`.
2. **Perceptual audio features.** Computed from an offline render of a few seconds. Each is reported as an average and a range, because the LFO and arpeggiator make the sound move.
   - loudness (LUFS or dBFS)
   - brightness (spectral centroid)
   - roughness / dissonance
   - note density (onsets per second)
   - pitch range
   - spectral flux (how much it changes)
3. **Colour.** HSL rather than RGB, since hue, saturation and lightness map to perception. Plus how much it moves.
4. **Listener reactions** since the last call. This is the most important part: it is the only signal about how the expression landed.
5. **Mood estimate on the same axes as the intent.** An independent estimate of how the sound reads, so the model can compare directly: "you aimed for warmth 0.8, it reads as 0.5".
6. **Notes**, e.g. "no final update last turn" or "gesture skipped: listener muted gestures".

## Example

```json
{"intent":   {"warmth": 0.8, "closeness": 0.7, "joy": 0.6, "calm": 0.75, "spontaneity": 0.3},
 "reads_as": {"warmth": 0.5, "closeness": 0.6, "joy": 0.55, "calm": 0.8, "spontaneity": 0.25},
 "playing":  {"tempo": 64, "cutoff": 900, "volume": 0.5, "scale": "dorian"},
 "clamped":  {"volume": "0.7 → 0.5 by listener limit"},
 "sound":    {"loudness": -24, "brightness": "low", "roughness": 0.2, "density": "sparse"},
 "colour":   {"h": 30, "s": 0.4, "l": 0.35, "motion": "slow"},
 "listener": ["pressed calmer", "volume -30%"]}
```

## How the mood estimate is computed

Existing music-emotion models predict valence and arousal. Two of our axes map onto those:
- `joy` (despair ↔ joy) ≈ valence
- `calm` (urgency ↔ calm) ≈ inverted arousal

The other three need heuristics built from audio features:
- `warmth`: low spectral centroid, few high harmonics, low roughness
- `closeness`: loudness, dry/wet ratio, stereo width
- `spontaneity`: onset-timing irregularity, pattern entropy

### Existing tools

| Tool | What it gives | Notes |
|---|---|---|
| **Essentia** (MTG, Universitat Pompeu Fabra) | Low-level, rhythm and tonal features, plus pre-trained arousal/valence regressors and mood classifiers | The most mature option. Models are CC BY-NC-SA (fine for a personal project; commercial use needs a licence). |
| **Music2Emo** (Kang & Herremans, 2025) | Valence, arousal and mood categories from audio | Recent research model, combines dimensional and categorical labels. |
| **VibeNet** | Valence, energy, danceability, acousticness and more | Small distilled model, easy pip install. |
| **librosa** | Features only (centroid, chroma, tempo, onset strength…) | No emotion model, but the base for the heuristics. |

**Main caveat:** these models are trained on real recorded songs with full mixes and often vocals. A sparse synth arpeggio is far outside that data, so predictions may be noisy. Research also consistently finds arousal much easier to predict than valence.

**Approach:**
1. Transparent heuristics for all five axes first, from librosa features. The model can see why it got a given estimate.
2. Add an Essentia model for `joy` and `calm` and compare with the heuristics on our own sounds.
3. Keep the estimate clearly labelled as an estimate, so it informs the model instead of steering it.

## Spectrogram image (opt-in)

The model can read images in tool results, and a picture of the sound shows patterns that numbers flatten: the arpeggio's shape, the filter sweep, how dense or empty it is. But images cost tokens, so feedback starts without them.

Session setting `image_feedback`, changeable in the player (with the token cost shown next to it):
- `off` (default): no images.
- `on_request`: the model can call `inspect("spectrogram")`.
- `every_turn`: an image comes back with every final update.

Image format:
- A mel spectrogram of the last ~8 seconds, small (around 512×256).
- A strip underneath showing the colour field over the same time span, so one image covers both channels.
- Optional extras: chromagram (which notes are present), loudness curve.

## Timing

Feedback comes back on every call, including mid-turn ones, so the model can adjust within a turn. Listener reactions happen while the model isn't running, so they arrive on the first call of the next turn.
