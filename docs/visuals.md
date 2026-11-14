# Visual options: notes

Status, 2026-11-11: **beat-synced motion built.** The picture follows the tempo (`grid.beat`, `beatsAt`, `BeatClock`; engine.md), is drawn on a canvas over the CSS gradient from a pure frame model (`packages/shared/src/visual.ts`), carries the mood in its form (below), has three scenes (`motes`, `ripples`, `rain`) with `density`, `speed` and `sync`, and the flash rule is now a luminance budget (safety.md) instead of a 3 Hz cap. Calibrate by eye on `/dev/visuals` (the five landing emotions side by side, tempo, scene, sync, and a no-hue switch). Not built: presets, a shape layer beyond the scenes, the owner's visual-intensity setting, porting the landing page's own field to the canvas.

Status, 2026-11-13 (later): **three parts.** The picture is the base colour (always on), a slow gradient (colour play: the moving lights, never faster than about 6 s an orbit, off the beat, swelling over the phrase) and the visuals (the scene, where the beat shows). The motion's own wash and glow are gone. The gradient has four more parts, all slow and off the beat: a vignette (closeness: a close mood darkens the edges and closes in, a distant one only the corners), a vertical lean (joy lifts the lights and sorrow lets them sink, with a slow rise and settle over the phrase), the shape (`colour.shape`: `glow` gathers the lights round the middle, `sweep` rides them round a ring that turns slowly, `wash` leaves them spread), and a hue that wanders about 18° over three phrases (the matched lightness is blended between 5° steps so it never flickers). With the canvas on, the CSS under it is one flat colour (the primary); the two-colour linear, radial or conic field is only the fallback when the canvas is off. The listener has "Gradient" and "Scenes" buttons in the player, saved per device; both off leaves the base colour.

Status, 2026-11-13: **emotions in the picture** (roadmap #20, branch `visuals-emotions`). Thirty scenes now (`motes`, `ripples`, `rain`, `snow`, `embers`, `aurora`, `waves`, `fireflies`, `stars`, `bubbles`, `leaves`, `seeds`, `tide`, `smoke`, `clouds`, `fire`, `warp`, `caustics`, `lightning`, `sunbeam`, `cracks`, `ink`, `circuit`, `digital`, `scope`, `vines`, `fireworks`, `reeds`, `network`, `flock`) and a moving, multi-colour gradient under all of them ("Colour play"), a finer rain, large soft layers inside the flash budget, scene crossfades, a session-stable seed, and a default scene chosen by the mood when the model sets none. See "Emotions in the picture" below.

### Emotions in the picture
**Libraries (decision 2026-11-13).** None draws the picture. Particle and scene libraries (tsparticles, p5, PixiJS, three.js) own the loop and the drawing, so the flash budget (`capFrame`) and the tests cannot see what they draw, and every listener would not necessarily see the same frame. The pure frame model stays the single source of truth; Canvas 2D paints it. The noise the scenes use is a 6-line smooth value noise on the engine's own `hash01` (`scene-kit.ts`), seeded, so nothing was added to the dependencies. A library would be worth it only for a per-pixel scene (a fluid or a real shader), which the budget also makes pointless at 0.09 opacity.

**Where the code is.** `scene-kit.ts` (types, `hash01`, `noise1`), `scenes.ts` (one pure function per scene), `visual.ts` (motion, budget, `drawFrame`, crossfade `from`), `mood-mapping.ts` (`moodToScene`, hue), `visual-canvas.tsx` (painter and crossfade timing), `/dev/visuals` (the ten emotions, with a no-hue switch: they must read apart by form alone).

| Emotion | Scene | Form |
|---|---|---|
| sad | rain | thin, straight, slow drops; a mist at the foot |
| angry | embers | many sharp sparks, flickering and jerking, orange whatever the hue; the hue itself is pulled to red |
| melancholic | leaves | pointed leaves with a midrib, turning over as they fall, autumn colours |
| lonely | snow | slow flakes, nearly straight; a flurry when joy or spontaneity rise |
| tender | fireflies | soft lights wandering and glowing on and off |
| playful, excited | bubbles | thin rings rising and wobbling |
| hopeful | fire | tongues of flame with an eroded, flickering edge in three layers (red body, orange middle, hot core), sparks rising; palette by session: campfire, blue gas, green copper |
| free, light | seeds | dandelion tufts drifting across and bobbing |
| peaceful | tide | a line of foam that comes up and slides back, with lines below it down to the bottom (never an empty strip) |
| pensive | clouds | banks and puffs of two scales of noise drifting slowly across, thinner towards the top and bottom; a `veil` like the smoke |
| eager | warp | a starfield rush with depth: far stars crawl, near ones streak, a few big stars rush up; white, blue, magenta and gold; a nebula behind, a core at the drifting vanishing point, a ring of light on each beat |
| dreamy | caustics | the net of light on a pool floor: two ridged noises on rotated axes sliding past each other; a veil |
| nostalgic | sunbeam | slanted shafts of warm light (one `veil` layer, stripes along a slanted axis, leaning 30° to 50° from the vertical either way, rolled again each time the scene starts on a device, that drift and breathe) with dust specks that glow only inside a shaft |
| cold anger | cracks | a hit on the beat and jagged fractures racing out and forking, cold blue-white, lingering and fading; one impact every 3 to 8 beats |
| (set by the model only) | ink | drops of ink bloom in still water, unfurl into tendrils and thin out as the next lands; one `veil` layer |
| dread | lightning | dark storm cloud and now and then a jagged bolt with a flash of the sky, then a softer one a beat later (never more than about twice a second) |
| brooding | smoke | one to five plumes (by density): a thin thread leaves the bottom, then folds into soft translucent sheets that curl and billow, spreading and thinning as they rise; one `veil` layer (a density field of plume mask times the creases of a domain-warped noise), light on a dark field and dark on a really bright one |
| analytical | circuit | right-angled traces (a different board per session and cycle) with pulses that move one segment per beat, in steps |
| alert | digital | many columns of falling blocks, heads with fading tails, stepwise, like the Matrix |
| driven | scope | an oscilloscope: a bright beam draws the figure and leaves a fading trail over a faint afterglow; by density and seed: a swept waveform or a sawtooth built from harmonics (sparse), a turning Lissajous or a spirograph (middle), a breathing rose or a star (dense); beat kicks the size and flares the beam |
| determined | vines | plants that sprout from an edge or the inside, branch, curl and put out leaves, then wither, drop their leaves and draw back; another starts elsewhere |
| elated | fireworks | rockets and bursts staggered across each bar, one to five at once by how elated (small items only, no wash or glow) |
| longing | reeds | straw-coloured stems anchored at the bottom with seed heads; they sway, and a gust crosses the field every few bars and bends them |
| curious | network | nodes that wander, fade out and come back somewhere else, so the links keep changing; linked while close (fading with distance); on beats a few links carry a bright point |
| restless | flock | boids, 70 to 120 by density as the minimum and up to 75% more, picked anew each epoch (separation, alignment, cohesion, cruise, noise, a wandering goal and obstacle) in a deterministic simulation: flocks form, split, merge and swell from small to large; white on a dark field, dark on a bright one |
| serene | stars | a twinkling sky, now and then a shooting star |
| happy | motes | bright lights that rise |
| content, relief | waves | parallel lines across the whole view in perspective, all running one way at one pace, swing held under the gap so they never cross; they vanish at the top, the bottom, both or neither by the mood (calm: both, bright: top, low: bottom, tense: neither) |
| awe | aurora | a curtain of soft light from a rippling lower edge: a bright base fading upward, dense vertical striations that slide along it, a second fainter colour high above; two `veil` layers plus a few thin rays (a vivid light glow on a dark sky, a deep vivid colour on a bright one) |
| nervous | ripples | rings that scatter |
| neutral | none | nothing (a quiet sound is the honest answer) |

`moodToScene` scores each region of the axes and takes the strongest; below 0.3 it returns nothing. The scene is marked `sceneAuto` and is not reported back to the model in `playing.picture` (only what it set). The model's own `scene` replaces it, `none` turns it off. Density follows how strongly the mood fits, speed follows calm and tension.

**Colour play (2026-11-13).** Under every scene (unless the motion is `still`) four large lights (five for a tense mood), each with its own centre, amplitude, direction and size, circling on orbits of 10 to 40 beats that never close (a slow noise wanders them), breathing in size over the phrase and jumping a little on each beat. Before: two or three of other hues drift on slow orbits and swell, with their hue leaning a few degrees, on the beat (slowly over four bars in phrase sync). A calm mood keeps them near the field's own hue; a tense one pushes them towards the complement; joy widens them. They give the multi-colour, moving gradient. **Why this is not a flash:** a flash is a change of brightness. Each light is painted at the lightness that changes the field's relative luminance least (`matchedLayer`, `colour-math.ts`), and its real worst-case swing per unit of opacity (`Layer.k`, typically 0.01 to 0.09) is what counts in the 0.09 budget, instead of the white bound of 1. So the colour can be strong and can pulse with the music while the brightness stays still. A test checks the declared swing against the real luminance change of the blend over random fields. A light that is or would pass through saturated red does not pulse. The aurora's curtain works the same way (that is why it can be strongly coloured now). What cannot be done under the rule: a brightness flash, however the colours are mixed.

**Lab.** `/dev/visuals`, Set = gradients shows the moving colours alone, larger, with a Colour play switch to compare.

**Budget (historical, lifted 2026-11-13).** Large elements (the aurora's curtain, mist, smoke, clouds, the wash and the glow) used to share a 0.09 luminance swing; `capFrame` no longer scales them. Small items still have their own budget (10% of the view, 400 items), which is what keeps the aurora's rays and the other thin things in check.

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

**Veil layers (2026-11-13).** A `veil` layer is a field of 0 to 1 over the view in one colour, as fine as the picture is wide (up to about 150 cells across), built ten steps per beat for smoke (fewer for clouds and aurora) and blended between the two steps around now, so the motion is smooth; the painter smooths it up. `toneLayer` (`colour-math.ts`) gives its colour and the most opaque it may be. Since the flash cap was lifted (2026-11-13) the budgets given to it are artistic, not a limit.

### v0.17.1 (2026-11-14): fixes from the v0.17.0 test
- **Narrow views crop, they do not squeeze.** Veil scenes sample the middle part of the design square when the view is narrower than tall (`veil()` in `scenes.ts`), and aurora, fire, cracks, lightning and sunbeam spread their items by 1/aspect about the middle (`cover()`), so a phone shows fewer bands and flames of the same shape. Flock, circuit, network and scope work in real pixels and are unchanged.
- **Vignette** is measured in screen space (an ellipse of the view), so all four edges darken on a phone.
- **Light scenes on a bright base.** Aurora, sunbeam, stars, fireflies, fireworks, embers, warp, motes, lightning and cracks get a uniform dark veil under them (`lightSceneDim`, up to 0.6 opacity, from a relative luminance of 0.42). It is not reported in `clamped`.
- **Warp** has no wash of its own: the nebula is the field's own hue and only glows round the core.
- **Caustics and smoke** are built at up to 180 cells across (was 150), and the painter smooths them at high quality.
- **Fireflies and motes** sit on an evenly spread sequence (R2), so none overlap. Flock birds are small beating wings, and its `speed` scales the simulation rate. Fireworks have trails and a burst flash, up to 8 at once, and a slow speed is much slower. Cracks hit exactly on a beat (every beat at density 1, every 4th at 0) and each lasts under 3 beats. Digital rain draws half-width katakana and digits. Leaves vary from narrow to broad. Aurora rays are softer.
- **Mood to scene.** `MOOD_PROTOTYPES` (`mood-mapping.ts`) holds the axes that give each of the 14 test emotions its scene; a test pins all of them and the table is below. A tester should send these values. Cold anger and dread no longer take the red of plain anger.
- **Picture buttons** are "Gradient" and "Scenes", side by side, outlined in teal with a check when on.
- **Fade.** The picture's opacity follows the level to the power 1.7, so it keeps up with the sound.

| Mood | Scene | warmth | closeness | joy | calm | spontaneity | tension |
|---|---|---|---|---|---|---|---|
| sad | rain | 0.3 | 0.4 | 0.1 | 0.8 | 0.2 | 0.05 |
| lonely | snow | 0.2 | 0.1 | 0.15 | 0.85 | 0.2 | 0 |
| melancholic | leaves | 0.75 | 0.7 | 0.25 | 0.8 | 0.3 | 0.05 |
| nostalgic | sunbeam | 0.8 | 0.6 | 0.4 | 0.5 | 0.4 | 0 |
| angry | embers | 0.5 | 0.4 | 0.12 | 0.12 | 0.6 | 0.85 |
| cold anger | cracks | 0.1 | 0.3 | 0.12 | 0.12 | 0.6 | 0.85 |
| tender | fireflies | 0.9 | 0.9 | 0.6 | 0.75 | 0.3 | 0 |
| hopeful | fire | 0.7 | 0.5 | 0.75 | 0.6 | 0.4 | 0 |
| eager | warp | 0.5 | 0.2 | 0.62 | 0.3 | 0.6 | 0.1 |
| dreamy | caustics | 0.3 | 0.5 | 0.6 | 0.7 | 0.75 | 0 |
| dread | lightning | 0.3 | 0.4 | 0.15 | 0.65 | 0.3 | 0.75 |
| awe | aurora | 0.5 | 0.1 | 0.7 | 0.9 | 0.3 | 0 |
| serene | stars | 0.5 | 0.2 | 0.5 | 0.9 | 0.2 | 0 |
| restless | flock | 0.5 | 0.4 | 0.45 | 0.45 | 0.95 | 0.1 |
