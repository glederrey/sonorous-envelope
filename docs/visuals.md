# Visual options: notes

Status: ideas, not built. Today the colour field is one background gradient (colour to secondary), a motion (still, drift, pulse) and a texture (flat, grain, soft noise). Gael wants more room for the model to express itself visually: shapes, gradients, moving things. These are notes to decide from, not a spec.

## What exists now
`ResolvedColour = { h, s, l, secondary?, motion, texture, pulseHz }`. The model can set mode `own` with hue, saturation, lightness, a secondary colour, motion and texture. In `follow` mode it is derived from the mood (mood-mapping.md). The player draws it with CSS (`pl-field`).

## Directions

### Gradients
- Gradient type: linear (with an angle), radial (with a centre), conic (a slow sweep).
- More than two stops, with a position for each. Soft versus hard stops.
- A slow gradient motion: the angle or the centre drifts, or the stops breathe.
- Mood link: warm and close could be a tight radial glow; cold and distant a wide, low-contrast linear wash.

### Shapes
- A few layers of soft shapes over the background: blobs, circles, rings, lines, waves, stars or dots. Each with a position, size, colour, opacity and blur.
- The model picks a **scene** from a small set instead of drawing freely (for example `field`, `orbits`, `rain`, `waves`, `bloom`, `grid`), with a few parameters each (density, size, speed, spread).
- Less is more: one or two elements by default. The shapes should read as atmosphere, not as a screensaver.

### Movement
- Drift (slow translation), breathe (slow scale or opacity), orbit, flow (noise field), ripple, fall, twinkle.
- Link to the sound so the picture and the music feel like one thing:
  - arpeggio notes trigger small ripples or sparks, pitch mapped to height or hue;
  - the cutoff LFO controls brightness or blur;
  - the bass layer drives a slow large form, the arpeggio the small fast ones.
- Speed follows `calm` (urgent is faster), irregularity follows `spontaneity`.

### Texture and finish
- Grain and soft noise exist. Possible additions: vignette, light blur and bloom, scanlines or paper texture, a faint star field.

## How the model would ask for it
Keep the current rule that colour follows the sound by default, and add an optional, compact `visual` object next to `colour`, for example:
```json
{"visual": {"scene": "orbits", "density": 0.3, "speed": 0.4, "palette": "from_mood"}}
```
- A small, fixed vocabulary (scenes, a handful of parameters), not free-form drawing. It is easier for the model to use well, cheap in tokens, and easy to limit.
- Presets named after moods (for example "ember", "tide", "static") could give good looks without the model tuning numbers.
- Same rule as the synth override: mood first, override only when the mapping does not give what the model wants.

## Rendering
- CSS is enough for gradients, blur and a few moving layers. Canvas 2D for particles and shapes. WebGL only if a scene needs it (flow fields, big blur).
- Target: 60 fps on a mid-range phone with the audio worklet running, and no jank when the tab is in the background. Cap the number of elements, pause drawing when hidden.
- Everything is a pure function of the state plus time, so two listeners see the same thing. Randomness is seeded like the engine's.

## Safety and comfort (these stay rules)
- Nothing flashes faster than 3 Hz, and lightness swing stays small for fast motion (limits.md). This applies to every element together, not each one alone.
- `prefers-reduced-motion`: no drift, pulse or particles; colour still changes, glided over at least 3 seconds.
- Contrast: the controls on top must keep at least 4.5:1 whatever the model draws (the player already puts them on a scrim).
- Listener limits: an owner setting for visual intensity (off, gentle, full), next to the existing maximum lightness and saturation. Enforced on the server and again in the player, like the other limits.
- No text, faces or recognisable imagery in v1: the field is atmosphere.

## Open questions
- Is the field a full-screen background only, or can it have a focal element (a single shape the eye follows)?
- Should the model see a small preview of what it drew (like the spectrogram), or only the parameters?
- Presets or free parameters first? Presets are safer and quicker to ship.
- How much of this should the owner be able to switch off per session?

## Suggested first step
Add radial and conic gradients and a "breathe" and "orbit" motion to the existing field, driven by the mood in `follow` mode, with the owner's visual-intensity limit. See what it feels like before adding model-chosen scenes.
