# Visual options: notes

Status, 2026-11-11: **beat-synced motion built.** The picture follows the tempo (`grid.beat`, `beatsAt`, `BeatClock`; engine.md), is drawn on a canvas over the CSS gradient from a pure frame model (`packages/shared/src/visual.ts`), carries the mood in its form (below), has three scenes (`motes`, `ripples`, `rain`) with `density`, `speed` and `sync`, and the flash rule is now a luminance budget (safety.md) instead of a 3 Hz cap. Calibrate by eye on `/dev/visuals` (the five landing emotions side by side, tempo, scene, sync, and a no-hue switch). Not built: presets, a shape layer beyond the scenes, the owner's visual-intensity setting, porting the landing page's own field to the canvas.

Status, 2026-11-13: **emotions in the picture** (roadmap #20, branch `visuals-emotions`). Twenty-two scenes now (`motes`, `ripples`, `rain`, `snow`, `embers`, `aurora`, `waves`, `fireflies`, `stars`, `bubbles`, `leaves`, `seeds`, `tide`, `smoke`, `circuit`, `digital`, `scope`, `vines`, `fireworks`, `reeds`, `network`, `flock`) and a moving, multi-colour gradient under all of them ("Colour play"), a finer rain, large soft layers inside the flash budget, scene crossfades, a session-stable seed, and a default scene chosen by the mood when the model sets none. See "Emotions in the picture" below.

### Emotions in the picture
**Libraries (decision 2026-11-13).** None draws the picture. Particle and scene libraries (tsparticles, p5, PixiJS, three.js) own the loop and the drawing, so the flash budget (`capFrame`) and the tests cannot see what they draw, and every listener would not necessarily see the same frame. The pure frame model stays the single source of truth; Canvas 2D paints it. The noise the scenes use is a 6-line smooth value noise on the engine's own `hash01` (`scene-kit.ts`), seeded, so nothing was added to the dependencies. A library would be worth it only for a per-pixel scene (a fluid or a real shader), which the budget also makes pointless at 0.09 opacity.

**Where the code is.** `scene-kit.ts` (types, `hash01`, `noise1`), `scenes.ts` (one pure function per scene), `visual.ts` (motion, budget, `drawFrame`, crossfade `from`), `mood-mapping.ts` (`moodToScene`, hue), `visual-canvas.tsx` (painter and crossfade timing), `/dev/visuals` (the ten emotions, with a no-hue switch: they must read apart by form alone).

| Emotion | Scene | Form |
|---|---|---|
| sad | rain | thin, straight, slow drops; a mist at the foot |
| angry (icy) | rain | the same drops slanted by the tension, fast |
| angry | embers | many sharp sparks, flickering and jerking, orange whatever the hue; the hue itself is pulled to red |
| melancholic, nostalgic | leaves | pointed leaves with a midrib, turning over as they fall, autumn colours |
| lonely | snow | slow flakes, nearly straight; a flurry when joy or spontaneity rise |
| tender | fireflies | soft lights wandering and glowing on and off |
| playful, excited | bubbles | thin rings rising and wobbling |
| hopeful | fireflies | (as tender) soft lights that each glow on and off |
| free, light | seeds | dandelion tufts drifting across and bobbing |
| peaceful | tide | a line of foam that comes up and slides back, with lines below it down to the bottom (never an empty strip) |
| brooding | smoke | billowing plumes of soft haze (matched to the field's brightness) with fine filaments that all rise from the bottom, dense and sharp there, wider, fainter and more scattered higher up (light on a dark field, dark on a bright one) so it reads on any colour |
| analytical | circuit | right-angled traces (a different board per session and cycle) with pulses that move one segment per beat, in steps |
| alert | digital | many columns of falling blocks, heads with fading tails, stepwise, like the Matrix |
| driven | scope | an oscilloscope: a bright beam draws the figure and leaves a fading trail over a faint afterglow; by density and seed: a swept waveform or a sawtooth built from harmonics (sparse), a turning Lissajous or a spirograph (middle), a breathing rose or a star (dense); beat kicks the size and flares the beam |
| determined | vines | plants that sprout from an edge or the inside, branch, curl and put out leaves, then wither, drop their leaves and draw back; another starts elsewhere |
| elated | fireworks | rockets and bursts staggered across each bar, one to five at once by how elated (small items only, no wash or glow) |
| longing | reeds | straw-coloured stems anchored at the bottom with seed heads; they sway, and a gust crosses the field every few bars and bends them |
| curious | network | nodes that wander, fade out and come back somewhere else, so the links keep changing; linked while close (fading with distance); on beats a few links carry a bright point |
| restless | flock | boids (separation, alignment, cohesion, cruise, noise, a wandering goal and obstacle) in a deterministic simulation: flocks form, split, merge and swell from small to large; white on a dark field, dark on a bright one |
| serene | stars | a twinkling sky, now and then a shooting star |
| happy | motes | bright lights that rise |
| content, relief | waves | parallel lines across the whole view in perspective, all running one way at one pace, swing held under the gap so they never cross; they vanish at the top, the bottom, both or neither by the mood (calm: both, bright: top, low: bottom, tense: neither) |
| awe | aurora | two curtains of colour, one behind the other, in two hues that blend where they overlap; the front one's lower edge ripples with folds that travel along it, bands of brightness that slide sideways, and bright rays on an even grid that slide together along the edge (never crossing) and swell and shrink |
| nervous | ripples | rings that scatter |
| neutral | none | nothing (a quiet sound is the honest answer) |

`moodToScene` scores each region of the axes and takes the strongest; below 0.3 it returns nothing. The scene is marked `sceneAuto` and is not reported back to the model in `playing.picture` (only what it set). The model's own `scene` replaces it, `none` turns it off. Density follows how strongly the mood fits, speed follows calm and tension.

**Colour play (2026-11-13).** Under every scene (unless the motion is `still`) four large lights (five for a tense mood), each with its own centre, amplitude, direction and size, circling on orbits of 10 to 40 beats that never close (a slow noise wanders them), breathing in size over the phrase and jumping a little on each beat. Before: two or three of other hues drift on slow orbits and swell, with their hue leaning a few degrees, on the beat (slowly over four bars in phrase sync). A calm mood keeps them near the field's own hue; a tense one pushes them towards the complement; joy widens them. They give the multi-colour, moving gradient. **Why this is not a flash:** a flash is a change of brightness. Each light is painted at the lightness that changes the field's relative luminance least (`matchedLayer`, `colour-math.ts`), and its real worst-case swing per unit of opacity (`Layer.k`, typically 0.01 to 0.09) is what counts in the 0.09 budget, instead of the white bound of 1. So the colour can be strong and can pulse with the music while the brightness stays still. A test checks the declared swing against the real luminance change of the blend over random fields. A light that is or would pass through saturated red does not pulse. The aurora's curtain works the same way (that is why it can be strongly coloured now). What cannot be done under the rule: a brightness flash, however the colours are mixed.

**Lab.** `/dev/visuals`, Set = gradients shows the moving colours alone, larger, with a Colour play switch to compare.

**Budget.** The aurora's curtain, the mist under the rain and the hearth light under the embers are large elements: they count in the 0.09 luminance swing with the wash and the glow (the motion's own wash and glow step back to a quarter when a scene has layers). The aurora gets the whole budget (the motion's own glow steps back to 8%) and adds its rays as small items, which have their own budget; that is what makes it visible. A fog scene was tried (flat banks) and removed: at 0.09 it was invisible, and with small elements it was only motes with fewer motes. It could come back if the bound changes. If they are too faint to carry the emotion, that is a decision for Gael (a different bound, or the layer colour counted by its real luminance), not something to tune around. A change of scene is a crossfade of at least 1.5 s (the state's transition time, up to 8 s), so the swap itself is never a step.

**Known weak spots.** Aurora is the heaviest to draw (36 columns per ribbon); on a 4x throttled CPU it was the only scene that made the canvas shrink. The rain depth and splashes are tuned by eye on the lab only; the player has not been tried with a real session.

### How the mood shapes the motion
Starting values, tuned by eye, not backed by evidence. They come from the same stretched axes as the sound (`moodToFeel`), so the picture cannot disagree with the sound, and none of them is only a hue.
| Axis | In the picture |
|---|---|
| calm | how hard it follows the beat (`depth`): calm leans to a slow swell over 4 bars, low calm to a pulse on each beat |
| joy | `lift`: high joy opens the glow on the beat and lets motes rise; low joy contracts it and lets them sink |
| tension | `jitter`: the glow jumps a little each beat, the pulse gets a quick decay and an off-beat accent |
| warmth | `soft`: soft edges and sine swells; cold is harder-edged |
| closeness | `near`: bigger glow and bigger motes, thicker rings |
| spontaneity | `irreg`: uneven timing and placement |
The model can set `scene`, `density`, `speed` and `sync` in `colour`; the rest is the mood's. Above 180 BPM the beat motion runs at half-time (a bar is 4 beats; 4/4 is assumed). Original and earlier notes follow.

Earlier status: first step built (2026-11-10): `colour.shape` (`wash`, the linear default, `glow`, a radial light, `sweep`, a conic turn) and `motion: breathe` (a soft light that swells and settles over 10 s). In follow mode a close, warm mood (closeness above 0.7, warmth above 0.5) is a glow; the model can ask for any shape. Pure CSS, `prefers-reduced-motion` turns the motion off, nothing near the 3 Hz rule (`hardCaps` keeps `pulseHz` at 0 unless the motion is `pulse`). Scenes, shapes and particles below are still ideas; the owner's visual-intensity setting waits for the limits piece. Original notes:

Status of the rest: ideas, not built. Today the colour field is one background gradient (colour to secondary), a motion (still, drift, pulse) and a texture (flat, grain, soft noise). Gael wants more room for the model to express itself visually: shapes, gradients, moving things. These are notes to decide from, not a spec.

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
- The beat shows in the shape as well as the brightness, because the flash budget holds the brightness swing down (and saturated red gets none): the glow swells, motes grow, streaks stretch and brighten, rings thicken. In beat sync the first beat of each 4-beat bar hits hardest (4/4 assumed). Phrase sync has no per-beat bump. Motes come in three kinds (large soft, medium, small sharp; more sharp ones with tension) and rain has depth (near drops are longer, brighter and faster).
- Everything is a pure function of the state plus time, so two listeners see the same thing. Randomness is seeded like the engine's.

## Safety and comfort (these stay rules)
- Nothing flashes: large elements together swing the relative luminance by under 0.1, saturated red does not pulse, small elements stay under 10% of the view (safety.md, limits.md). This applies to every element together, not each one alone.
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
