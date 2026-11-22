# Emotion to sound: the evidence behind the mapping

Why the mood axes map to the synth settings the way they do. This is the research basis for [mood-mapping.md](implementation/mood-mapping.md). The sources are listed at the end ([References](#references)).

Numbers marked *starting value* are proposals to calibrate by ear, not results from the studies.

## Principles

Emotion goes first through acoustic cues shared with the voice: tempo, register, brightness, attack, roughness. Harmony is a second layer: a colour, largely cultural.

1. **Layer 1, nearly universal.** A meta-analysis of 104 studies of vocal expression and 41 of music performance found the same acoustic changes express the same emotions in both: a shared code (Juslin & Laukka, 2003). This layer carries the meaning.
2. **Layer 2, cultural.** Major = happy, minor = sad is a convention of Western tonal music, learned by exposure (Fang et al., 2017). Acoustic roughness acted the same way across cultures in a study in Pakistan, but the preference for consonance depended on familiarity (Athanasopoulos et al., 2021).
3. **Layer 3, ethological.** In birds and mammals, low and rough sounds go with hostility, high and pure sounds with fear, appeasement or friendly approach: Morton's motivation-structure rules (1977). This is the basis of the gestures.

**Design rule:** a listener should understand the emotion even if the harmony were removed. The chord nuances; it does not carry the message alone.

## Acoustic cues per emotion

Five emotions have a solid acoustic profile shared by voice and music (Juslin & Laukka, 2003, table 11):

| Emotion | Tempo | Intensity | Register | Contour | High-frequency energy | Pitch variability | Attack | Fine regularity |
|---|---|---|---|---|---|---|---|---|
| Joy | fast | medium to high | high | rising | medium | high | fast | very irregular |
| Anger | fast | high, very variable | high | rising | high | high | fast | irregular |
| Fear | fast | low (except panic), very variable | high | rising | low | low | n/a | very irregular |
| Sadness | slow | low, little variation | low | falling | low | low | slow | irregular |
| Tenderness | slow | low, little variation | low | falling | low | low | slow | regular |

What follows from it:
- **Sadness and tenderness differ almost only in regularity.** Both are slow, low, soft and falling. Tenderness is regular, sadness is not: a micro-tremor in timing and pitch makes the difference.
- **Joy and anger share tempo, register and contour.** High-frequency energy (brightness, roughness) and intensity separate them: an open but clean filter for joy, saturated and rough for anger.
- **On a single sound, timbre carries a lot.** Sharp attacks with an early decay pull towards positive; a brighter sound and a moving spectrum raise tension; brightness raises perceived energy (McAdams et al., 2017). A *soft* attack on a bright sound gives tension, not calm.
- **Serenity and urgency are not emotions in this table.** They are activation levels, carried mostly by tempo and note density. They are the two ends of our `calm` axis.

## Harmony

A chord on its own already has a distinct emotional colour, for naive listeners and musicians alike: 269 participants rated 14 chords (Lahdelma & Eerola, 2014).

| Chord | What the study reports | Used for |
|---|---|---|
| Major | joy, highest valence | joy |
| Minor | sadness, melancholy, nostalgia | sadness, mild despair |
| Major 7 | the most nostalgic chord; more melancholic than joyful, valence still positive | tenderness, nostalgia |
| Minor 7 | fairly high valence, little sadness, a little nostalgia | serenity, calm warmth |
| Dominant 7 | anticipation, interest, tension, little sadness | urgency, curiosity |
| Diminished | melancholy, sadness | anxiety, fear |
| Augmented | melancholy, almost no joy | unease, strangeness |

Two caveats:
- **sus2 and sus4** (suggested for waiting or suspension) are not in the study. A musician's hypothesis, to be tested.
- **Roughness** (beating, dissonance) acts alike across cultures, unlike the preference for consonance. For anger and tension, lean on roughness (oscillator detune, saturation) rather than on the chord choice alone.

## The arpeggio

Two arpeggios from the first prototype: a **low, slow one** for the background mood, which changes over several responses, and a **mid one** that reacts to every response. This is the difference between mood and affect, in sound.

**Contour.** Rising contours and short notes evoke joy, falling contours and long notes sadness (Sauvé et al.). Contour also reinforces mode: major is recognised better rising, minor falling (Burnham et al., 2020). Cats use the same code: meows rise in positive contexts and fall in negative ones (Schötz et al., 2019).

| Arpeggio parameter | What it carries | Starting range |
|---|---|---|
| Direction (up, down, up-down) | valence: up = momentum, down = letting go | joy → up; sadness → down; tenderness → a soft up-down |
| Number of notes | complexity, agitation | 3 when calm, up to 6 when urgent |
| Tempo (notes per second) | activation | about 1 to 2 when calm, 6 to 10 when urgent |
| Register | joy and fear high, sadness and tenderness low | mid arpeggio: up to 2 octaves of movement |
| Note length (gate) | legato = tenderness, staccato = lively joy | 30 % to 100 % of the step |
| Timing irregularity | sadness (irregular) vs tenderness (regular) | 0 to about 30 ms of random wobble |
| Note probability | spontaneity, impulsiveness | 100 % when calm, some notes skipped or added when impulsive |

The low arpeggio needs only two parameters: the background chord and a very slow tempo (one note every one to two seconds). If it barely moves, that is intended: a mood that changed with every message would no longer be a mood.

## Envelope, filter, LFO, delay

Attack and filter brightness weigh most on a single sound. Reverb and delay act on distance and emotional depth rather than valence.

| Parameter | What it carries | Starting setting |
|---|---|---|
| Attack | fast = positive, energetic; slow = sad, tender | joy and anger: a few ms; sadness and tenderness: 100 ms or more |
| Decay / sustain | early decay = more positive | joy: short decay, low sustain; tenderness: high sustain |
| Release | how the emotion dies away | short = clean; long = lingering (nostalgia, sadness) |
| Filter cutoff | brightness: energy and tension rise with it | dark for sadness and tenderness, open for joy and anger |
| Resonance, saturation | roughness: hostility, tension | low by default, high only for anger |
| Filter envelope | the vocal gesture: open then close | basis of the meow and the sigh |
| Slow LFO on the filter | a breathing | 0.1 to 0.3 Hz, always on and discreet |
| Pitch LFO (vibrato) | a faster vibrato raises perceived activation | slow and light in tenderness, faster and irregular in fear |
| Oscillator detune | warmth, analogue drift | slight always, stronger for warmth |

**Reverb and delay.** A longer, more present reverb strongly strengthens the romantic and mysterious qualities, moderately sadness, fear and heroism; a dry sound is judged the most comic, and joy barely moves (Mo, Wu & Horner, 2016). Very long reverbs are reported as unpleasant and small rooms as calmer and more reassuring.

**The delay amplifies the emotion that is present instead of adding one.** It makes the sound resonate without changing its meaning, which makes it a good listener-side control. Its length needs a cap so the resonance does not slide into the unpleasant.

## Gestures (signatures)

The product has no gestures (removed in v0.12: the test session found them inaudible, and an appeal hidden in a sound is against the rules). The cues stay here as research. One-off sounds rely on a rule shared by birds and mammals: low and rough for hostility, high and pure for fear, appeasement or approach (Morton, 1977). All are built from an oscillator, noise, a filter and two envelopes.

| Gesture | Acoustic form | Synthesis | When |
|---|---|---|---|
| Meow | a run of vowels i-a-u; rising contour in a positive context, falling in a negative one | held note, a filter envelope that opens then closes, a rising or falling pitch envelope | request, curiosity (rising); complaint (falling) |
| Chirp | high, tonal, very short | 2 or 3 notes of a few tens of ms, a fast upward glissando, short decay | light joy, pleasant surprise |
| Cry of joy, laughter | a run of bursts, the first loudest, then decaying; spontaneous laughter is higher and longer than forced laughter | 4 to 8 decaying pulses, rising pitch, open filter | enthusiasm |
| Growl | low, rough, wide band | low oscillator amplitude-modulated between 30 and 70 Hz, a barely open filter, a little saturation | a limit, rising tension: the signal before the claws |
| Sigh | breath (inhaled noise), long, falling | filtered noise, slow attack, long release, a closing filter | relief mostly; also resignation |
| Purr | see below | see below | appeasement, tenderness, self-regulation |

**The purr.** Its fundamental is around 20 to 30 Hz, on the inhale as on the exhale, with a slight pitch difference between the two phases (Schötz & Eklund). A third harmonic sits near 79 Hz, and cats also purr when stressed or hurt (Campbell et al.). Synthesis: low noise amplitude-modulated near 25 Hz, a slow envelope following a breath, a closed low-pass, and added harmonics so a small speaker can reproduce it.

**The cry in the purr.** When a cat wants food it slips a high component, near 380 Hz, into its purr. Listeners, even without a cat, judge that purr more urgent and less pleasant; remove the component by resynthesis and the urgency disappears (McComb et al., 2009). It is an appeal disguised as contentment. **Rule: the purr never contains a hidden high component.** To call for attention, the model uses a meow, audible as such.

Laughter is the best-recognised emotional vocalisation across very distant cultures (Bryant et al., 2018). Sighs are more frequent during relief than during stress (Vlemincx et al., 2009).

## Mapping from the five axes

Five axes are enough to drive all of the above. The note used slightly different names; the project keeps its own, which mean the same thing:

| Note's axis | Project axis | Relation |
|---|---|---|
| `warmth` (0 to 1) | `warmth` | same |
| `proximity` (0 to 1) | `closeness` | same |
| `valence` (-1 to 1, joy ↔ despair) | `joy` (0 to 1, despair ↔ joy) | same, rescaled |
| `arousal` (0 to 1, calm ↔ urgency) | `calm` (0 to 1, urgency ↔ calm) | inverted: `arousal = 1 − calm` |
| `spontaneity` (0 to 1) | `spontaneity` | same |

| Axis | Arpeggio | Harmony | Timbre | Space |
|---|---|---|---|---|
| Warmth | longer gate, legato | added 7ths (maj7, m7) | rounder filter, light detune | n/a |
| Closeness | n/a | n/a | n/a | close = dry and centred; far = reverb and width |
| Joy | rising contour if high, falling if low; higher register if high | major → minor | sharper attack if high | n/a |
| Calm (inverse of arousal) | tempo, number of notes (3 to 6) | dominant 7 when urgent and joy is neutral | filter brightness, faster vibrato when urgent | n/a |
| Spontaneity | note probability, timing wobble | n/a | depth of the random LFOs | n/a |

Chord by the two main axes:

| Joy | Calm (low activation) | Urgent (high activation) |
|---|---|---|
| High | maj7 or m7 (tenderness, serenity) | major (joy) |
| Low | minor (sadness) | diminished (fear); with roughness and saturation, anger |

## Open questions and precautions

- [ ] Two arpeggios from the first prototype: check by ear that the low one really gives a background mood, distinct from the mid one.
- [ ] Calibrate the numeric ranges (tempo, attack, wobble) by ear, on real responses.
- [ ] Watch the instance's pull towards lukewarm (high warmth, low activation by default) across conversations. First evidence (2026-11-09): axis values sent at the start of a conversation were all between 0.45 and 0.72, and again between 0.45 and 0.65 later in the same conversation, while the instance's `note` described a stronger feeling than the sound carried. Mitigations (built): stretch the middle of the range, and tell the model that 0.4 to 0.7 reads as lukewarm (mood-mapping.md, "Stretch").
- [ ] The same skeleton across instances (four rising notes) comes from the mapping, not only from the instance's timidity: see mood-mapping.md, top note, and "Voice".
- [x] The instance's `note` on `set_sound` was stored but never shown. Decided (2026-11-09): do not echo it back on every call, since the model already has it in its own context and it would cost about 50 tokens of the 150 budget. Instead: show the latest note to the owner in the "What Claude set" panel, include notes in `inspect` history, and tell the model to compare the feedback with what it meant and send one correction (server-instructions.md).
- [ ] Test despair and anger separately, at low volume, before letting them appear spontaneously.
- [ ] Decide whether a second instance rates the same responses blind, and how the gap would be heard.
- [ ] Archive scores and spectra from one conversation to the next, to read patterns over time.

Two relationship rules are not negotiable: the listener's volume is always visible to the model (`controls` in the feedback), and no sound carries a disguised appeal, on the model of the cry hidden in the purr. The second is in the server instructions ([server-instructions.md](implementation/server-instructions.md)).

## References

Descriptions are ours.

### Voice, music and emotion
- Juslin & Laukka (2003), *Communication of emotions in vocal expression and music performance*: [text](https://distantreader.org/stacks/carrels-legacy/bluesGuitar-from-scholar/cache/work_fos67nw6zjb6lblxc72ggtzakq.pdf), [overview](https://pmc.ncbi.nlm.nih.gov/articles/PMC4017128). The shared acoustic code of voice and music; the cue table.
- [McAdams, Douglas & Vempala (2017)](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.00153/pdf): timbre and affect by register. Attack and brightness.
- [Katsis et al. (2025)](https://arxiv.org/pdf/2509.15151v3): review of audio effects and emotion. Vibrato and activation.
- [Mo, Wu & Horner (2016)](https://research.uca.ac.uk/7021/1/2016%20-%20The%20Effects%20of%20Reverberation%20Time%20and%20Amount%20on%20the%20Emotional%20Characteristics.pdf.pdf): reverberation time and amount, and emotional character.

### Harmony and culture
- [Fang, Shang & Chen (2017)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5671660/): Western modes with Chinese listeners.
- [Athanasopoulos et al. (2021)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7806179): harmonisation and emotion across cultures.
- [Lahdelma & Eerola (2014)](https://jyx.jyu.fi/jyx/Record/jyx_123456789_48313): single chords and emotions. [Lahdelma & Eerola (2015)](https://jyx.jyu.fi/bitstreams/57c8ecf3-aa81-4f85-996b-bf60fa0c51fe/download): nostalgia and harmony.

### Contour
- [Sauvé et al.](https://core.ac.uk/download/159078693.pdf): expectation and musical emotion.
- [Burnham, Long & Zeide (2020)](https://www.x-mol.com/paper/1331416550231678976): pitch direction and mode.

### Animal signals
- [Morton (1977)](https://repository.si.edu/bitstream/handle/10088/11626/Morton1977a.pdf): motivation-structure rules.
- [Schötz, van de Weijer & Eklund (2019)](https://lup.lub.lu.se/record/0ecc1469-5187-42d8-b367-dced06c9cf4d): the melody of meows. [Schötz & van de Weijer (2014)](https://lup.lub.lu.se/record/4882231). [Schötz & Eklund](https://lup.lub.lu.se/search/files/3610898/2292764.pdf): the purr of four cats.
- [Campbell et al.](https://www.vin.com/doc/?id=5328490): purr fundamental and stress.
- McComb et al. (2009), *The cry embedded within the purr*: [National Geographic](https://www.nationalgeographic.com/science/article/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr), [Discover](https://www.discovermagazine.com/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr-1687).

### Laughter and sighs
- [Bryant (2020)](https://scholar.ss.ucla.edu/wp-content/uploads/sites/20/2020/08/Evolution_Laughter_HCB_2020.pdf): the structure of laughter. [Bryant et al. (2018)](https://escholarship.org/content/qt1h1032fh/qt1h1032fh.pdf): laughter in 21 societies. [Lavan et al. (2015)](https://dx.doi.org/10.1007/s10919-015-0222-8): spontaneous and posed laughter.
- [Vlemincx et al. (2009)](https://research.vu.nl/en/publications/why-do-you-sigh-sigh-rate-during-induced-stress-and-relief/): sighs, stress and relief.
