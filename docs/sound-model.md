# Sound and colour model

The model describes a mood, not a sequence of notes. The player turns that description into a living loop. There are three layers:

1. **Mood axes** (required): what the model wants to express.
2. **Synth override** (optional): exact settings when the model wants control the mapping doesn't give it.
3. **Gestures** (optional): short one-off sounds over the background.

Plus colour, which by default follows the sound.

## 1. Mood axes

Each axis goes from 0 to 1.

| Axis | 0 | 1 |
|---|---|---|
| `warmth` | cold | warm |
| `closeness` | distant | close |
| `joy` | despair | joy |
| `calm` | urgency | calm |
| `spontaneity` | measured | spontaneous |

The server maps the axes to synth settings. This mapping is a design choice and needs testing with real listeners. A first guess:

- **warmth:** waveform (sine and triangle warm, square and saw cold), filter cutoff, detune, reverb colour
- **closeness:** volume, dry vs reverb, stereo width, register (closer = mid and lower)
- **joy:** mode (major and lydian towards joy, minor and phrygian towards despair), register, brightness
- **calm:** tempo, note rate, LFO speed, attack time, density
- **spontaneity:** pattern randomness, swing, step probability, timing jitter

Axes alone keep the model consistent and easy to use, but the mapping then decides what "warmth" sounds like. The override layer gives the model a way out.

## 2. Synth override

Any of these fields replaces what the mood mapping produced.

### Arpeggiator
- `root`: note name, e.g. `D3`
- `scale`: major, minor, dorian, phrygian, lydian, pentatonic, whole-tone, chromatic…
- `chord`: degrees to arpeggiate, e.g. `[1, 3, 5, 7]`
- `pattern`: up, down, up-down, random, as-played
- `octaves`: 1–4
- `tempo`: BPM
- `rate`: note division, e.g. 1/8, 1/16
- `gate`: 0–1, note length relative to step
- `swing`: 0–1
- `density`: probability that each step plays

### Oscillator
- `wave`: sine, triangle, sawtooth, square
- `detune`: cents between voices
- `voices`: 1–3

### Filter
- `type`: lowpass, highpass, bandpass
- `cutoff`: Hz
- `resonance`: Q

### LFOs (up to 2)
- `target`: cutoff, pitch (vibrato), amp (tremolo), pan
- `rate`: Hz
- `depth`: 0–1
- `shape`: sine, triangle, square, random (sample & hold)

### Envelope
- `attack`, `decay`, `sustain`, `release`

### Drone (optional sustained layer)
- `on`, `notes`, `wave`, `level`

### Effects and mix
- `delay`: time, feedback, mix
- `reverb`: size, mix
- `volume`: 0–1 (clamped by listener limit)

## 3. Gestures

Short sounds played once over the background, like R2-D2's chirps. A starting set:

- `purr`: low, rolling, contented
- `chirp`: short rising notes, curiosity or delight
- `sigh`: falling filtered noise, tiredness or relief
- `hum`: brief sustained tone, thinking
- `pluck`: a single bright note, "aha"
- `breath`: soft noise swell, pause

Each gesture has an `intensity` (0–1). The server instructions should keep gestures rare: they mean more when they are infrequent.

## Transition

- `time`: seconds to glide from the previous state
- `curve`: smooth or sudden (sudden only if the listener allows it)

## Colour

- `mode`: `follow` (derived from the sound) or `own` (set by the model)
- `hue`, `saturation`, `lightness`: HSL
- `secondary`: optional second colour for a gradient
- `motion`: still, drift, pulse (pulse synced to an LFO)
- `texture`: flat, grain, soft noise

Default mapping in `follow` mode:
- Hue follows warmth and joy.
- Lightness follows filter cutoff.
- Saturation follows overall intensity.
- Pulse follows the cutoff or amp LFO.

These mappings are cultural defaults, not universal truths. Treat colour as atmosphere, not a fixed code.

## Example call

```json
{
  "mood": {"warmth": 0.8, "closeness": 0.7, "joy": 0.6, "calm": 0.75, "spontaneity": 0.3},
  "synth": {"filter": {"cutoff": 900}, "drone": {"on": true, "notes": ["D2", "A2"], "level": 0.2}},
  "gesture": {"type": "purr", "intensity": 0.4},
  "colour": {"mode": "follow"},
  "transition": {"time": 6, "curve": "smooth"},
  "final": true
}
```
