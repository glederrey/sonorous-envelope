# Sound and colour model

The model describes a mood, not a sequence of notes. The player turns that description into a living loop. The evidence for the mapping (which acoustic cue carries which emotion) is in [emotion-to-sound.md](emotion-to-sound.md). There are three layers:

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

The server maps the axes to synth settings. This mapping is a design choice and needs testing with real listeners. It rests on the acoustic cues that voice and music share (tempo, register, brightness, attack, roughness), with harmony as a second layer, since harmony is partly cultural. A first guess:

- **warmth:** waveform (sine and triangle warm, square and saw cold), filter cutoff, detune, added 7ths, reverb colour
- **closeness:** volume, dry vs reverb, stereo width, register (closer = mid and lower)
- **joy:** arpeggio contour (rising towards joy, falling towards despair), mode and chord quality (major towards joy, minor towards despair), register, attack, brightness
- **calm:** tempo, note rate and number of notes, LFO speed, attack time, density. This is the inverse of arousal: serenity and urgency are activation levels, not emotions.
- **spontaneity:** pattern randomness, swing, step probability, timing jitter

Two readings of the axes are worth keeping in mind. Joy and anger share tempo, register and contour; roughness and brightness separate them, so anger is "low joy, urgent, rough", not a separate axis. Sadness and tenderness differ almost only in regularity: both are slow, low and soft, and sadness adds a small timing and pitch tremor.

Axes alone keep the model consistent and easy to use, but the mapping then decides what "warmth" sounds like. The override layer gives the model a way out.

### Two arpeggios: background and foreground

Mood and affect are different things: a mood lasts, an affect answers the moment. The sound has two layers for them:
- **Background (bass) arpeggio:** low, very slow (one note every 1 to 2 s), built on the chord of a *slow mood*. The slow mood moves a fraction of the way to the model's mood at each final update, so it changes over several responses. It barely moves by design: a mood that changed with every message would no longer be a mood.
- **Foreground (mid) arpeggio:** the arpeggio described under "Synth override", driven by the current mood and reacting to every update.

The drone stays as an optional sustained layer. Whether the slow low arpeggio is really heard as a background mood, distinct from the mid one, is the first thing to check by ear.

### A voice of its own

Tested with several instances (2026-11-09), the axes alone gave nearly the same skeleton every time (four notes in a rising arpeggio), although changes within one conversation were easy to hear. Toggling the synth by hand gave clearly different results. So the sound has a second kind of input: a **voice** (root, scale, chord shape, note order, octaves, wave) that the instance picks at the start, that persists from turn to turn by default and that it may change at any moment. The axes say how it is; the voice says who. Details and the fallback when the instance picks none: [mood-mapping.md](implementation/mood-mapping.md), "Stretch" and "Voice". The manual override is therefore not a last resort: it is where the instance's own character lives, and the mapping is the safety net.

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
- `voices`: 1–3. These are unison voices: copies of the same note, detuned by ±`detune`, for thickness. They are not different notes.
- `stack`: intervals in semitones, e.g. `[0, 7, 12]`, so that every arpeggio note sounds as a chord (max 3 added intervals).

### Filter
- `type`: lowpass, highpass, bandpass
- `cutoff`: Hz
- `resonance`: Q

### LFOs (up to 2)
- `target`: cutoff, pitch (vibrato), amp (tremolo), pan
- `rate`: Hz. Up to 12 for `cutoff`, `pitch` and `pan`; up to 80 Hz for `amp` only (validated per target). Below about 20 Hz amplitude modulation is a tremolo; around 25 Hz it gives a purring grain, between 30 and 70 Hz a growling roughness (emotion-to-sound.md). It counts as roughness for the listener's limits (limits.md).
- `depth`: 0–1
- `shape`: sine, triangle, square, random (sample & hold)

### Envelope
- `attack`, `decay`, `sustain`, `release`

### Drone (optional sustained layer)
- `on`, `notes`, `wave`, `level`

### Pad
A second sustained layer, separate from the drone, for harmony: it holds a chord (up to 5 notes) with its own `wave`, `level`, slow `attack` and `release`, and it can change at every turn. The drone stays the low pedal; the arpeggio stays monophonic unless `stack` is set. Not tied to a mood axis at first: override only, mapped after listening tests.

### Effects and mix
- `delay`: time, feedback, mix
- `reverb`: size, mix
- `volume`: 0–1 (clamped by listener limit)

## 3. Gestures (removed in v0.12)
> **Removed (2026-11-10, v0.12):** gestures are gone from the product: the schema field, the engine voice, the owner setting, the result fields and the guidance. The test session found them inaudible in practice, and the product already says to ask in words and never hide an appeal in a sound. What follows is kept as the record of what was built and why; the code is deleted (see git history before v0.12).


Short sounds played once over the background, like R2-D2's chirps. They follow the motivation-structure rules found across birds and mammals: low and rough for hostility, high and pure for fear, appeasement or approach. A starting set:

- `purr`: low, rolling, contented. Appeasement, tenderness, self-regulation.
- `meow_up`: a rising meow. A request, curiosity.
- `meow_down`: a falling meow. A complaint.
- `chirp`: 2 or 3 short rising notes. Light joy, pleasant surprise.
- `laugh`: a run of 4 to 8 decaying bursts, rising in pitch. Enthusiasm.
- `growl`: low, rough, amplitude-modulated. A limit, tension rising: the signal before the claws.
- `sigh`: falling filtered noise. Relief mostly; also resignation.
- `hum`: brief sustained tone, thinking
- `pluck`: a single bright note, "aha"
- `breath`: soft noise swell, pause

Each gesture has an `intensity` (0–1). The server instructions should keep gestures rare, so they do not turn into a cartoon: they mean more when they are infrequent.

**No disguised appeal.** The purr never contains a hidden high component. A cat that wants food slips a cry near 380 Hz into its purr, and listeners find that purr more urgent and less pleasant. If the model wants attention, it asks in words: a meow is a request or curiosity inside the music, not a way to call the listener (decided 2026-11-10, in line with safety.md). The recipes are in [engine.md](implementation/engine.md).

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
