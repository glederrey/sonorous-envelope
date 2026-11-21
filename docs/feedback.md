# Feedback loop

The model needs to know what it actually produced in order to update it. `set_sound`, `strudel_mode`, `silence` and `get_feedback` return the same compact object, about 150 to 250 tokens (built by `buildFeedback`, `packages/shared/src/feedback.ts`; the exact rules are in [implementation/mcp-tools.md](implementation/mcp-tools.md), "Feedback object").

## What comes back

1. **What plays (`playing`).** Not an echo of what the model sent, but what is playing after the mood mapping and the limits, in the vocabulary the model can set, so it can check its choices arrived. While Strudel plays: `engine`, `bpm`, the code's length and the scene behind it. `clamped` lists what a rule changed (level held, the 0.9 volume cap).
2. **Perceptual audio features (`sound`).** Computed from an offline render of a few seconds of the synth state: words for brightness, density and movement, numbers for loudness (`loudness_db`) and roughness. Not for Strudel: the server never runs the model's code, so a Strudel state has no `sound` and no `reads_as`.
3. **Colour.** HSL rather than RGB, since hue, saturation and lightness map to perception, plus its motion (`still`, `drift`, `pulse`, `breathe`).
4. **Listener reactions (`reactions`)** since the last call: what the owner pressed (calmer, softer, more of this...), one short line per kind with how long ago. Delivered once (`set_sound` and `strudel_mode` claim them; `get_feedback` only peeks). Only in Attuned and Jukebox: nobody steers Self, so reactions are never returned there.
   **What the listener heard (`heard`)**, in every mode, Self included: readings the owner chose under "What I heard" (tense, tender, reproach...). The listener's own reading, next to the server's `reads_as`. Information, never steering.
5. **Listener controls (`controls`).** The owner's own player volume. Other listeners can only listen, so their settings are not reported. The same sound lands differently at volume 0.3 and 0.9, and the model should know which one it is dealing with.
6. **Mood estimate on the same axes as the intent (`reads_as`, `reads_why`).** An independent estimate of how the sound reads, so the model can compare directly: "you aimed for warmth 0.8, it reads as 0.5". Where an axis is 0.25 or more away, `reads_why` names the two parts of the sound that pull it.
7. **The Strudel report (`pattern`).** What the owner's player said about the code: whether it ran, its error, events per cycle.
8. **Context.** `mode` (the mode playing, and whether the owner locked it), `players` (how many players are open), `resting` (the sound faded because the last update was minutes ago), and `notes` (e.g. "no final update last turn", tempo glides, voice changes). After a mode change the first result also carries the new mode's rules (`guidance`).

## Example

```json
{"turn": 12,
 "intent":   {"warmth": 0.8, "closeness": 0.7, "joy": 0.6, "calm": 0.75, "spontaneity": 0.3},
 "playing":  {"scale": "D dorian", "tempo": 64, "wave": "triangle", "cutoff": 900, "resonance": 0.2, "detune": 4, "volume": 0.5, "drone": true,
              "pattern": "up", "rate": 1, "octaves": 1, "chord": false, "echo": 0.3, "reverb": 0.4},
 "colour":   {"h": 30, "s": 0.4, "l": 0.35, "motion": "drift"},
 "controls": {"volume": 0.6},
 "sound":    {"brightness": "low", "density": "sparse", "movement": "slow", "loudness_db": -24, "roughness": 0.2},
 "reads_as": {"warmth": 0.5, "closeness": 0.6, "joy": 0.55, "calm": 0.8, "spontaneity": 0.25},
 "reads_why": {"warmth": "held down by brightness, roughness"},
 "reactions": ["calmer, 40 s ago"],
 "mode": "Attuned",
 "players": 1,
 "notes": ["no final update last turn"]}
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

**Calibration source.** The cue table in [emotion-to-sound.md](emotion-to-sound.md) gives expected directions (faster, higher, brighter, more attack and roughness = more activation; major and rising = more joy), so the heuristics start from those and are checked on our own sounds.

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

## Tracking over time

Two biases are worth watching once there is real data:
- **Lukewarm bias.** Models may drift toward safe, middling moods. Log the distribution of intent per axis across sessions and flag a distribution that never leaves 0.3 to 0.7.
- **Intent vs reading.** Keep the analysis scores and a downsampled spectrum for each final state, so the estimator can be compared across conversations.

A blind check is also possible: a second model instance, given only the spectrogram or the feature summary, rates the mood without seeing the intent. Agreement with the first instance's intent is a measure of whether the sound carries the mood. This is a later experiment, not part of the first build.

## Timing

Feedback comes back on every call, including mid-turn ones, so the model can adjust within a turn. Listener reactions happen while the model isn't running, so they arrive on the first call of the next turn, or at once while `listen` waits (live tuning, Attuned and Jukebox: the model calls `listen` after its final `set_sound`, gets the press within seconds and answers it in the same message; see [mcp-tools.md](implementation/mcp-tools.md)).
