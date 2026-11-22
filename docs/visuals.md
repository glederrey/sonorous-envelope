# The picture

What the colour field shows and how it is drawn. The model sets `colour` (mode, hue, saturation, lightness, a secondary colour, `motion`, `texture`, `shape`, and the scene fields `scene`, `density`, `speed`, `sync`); in `follow` mode everything comes from the mood (mood-mapping.md, "Colour"). The schema is in mcp-tools.md.

## How it is built
The picture has three parts, all a pure function of the state plus time, so two listeners see the same thing (randomness is seeded like the engine's):
1. **The base colour**, always on: one flat CSS colour (the primary), glided over the state's transition. A two-colour linear, radial or conic field (`colour.shape`: `wash`, `glow`, `sweep`) is only the fallback when the canvas is off.
2. **A slow gradient** ("colour play"): moving lights that never go faster than about 6 s an orbit and are off the beat. A vignette follows closeness (a close mood darkens the edges and closes in), a vertical lean follows joy (joy lifts the lights, sorrow lets them sink), `shape` gathers them round the middle (`glow`), rides them round a turning ring (`sweep`) or leaves them spread (`wash`), and the hue wanders about 18° over three phrases.
3. **The visuals**: a scene, where the beat shows. Drawn on a canvas by a pure frame model (`packages/shared/src/visual.ts`, `scene-kit.ts`, `scenes.ts`; the painter is `apps/web/components/player/visual-canvas.tsx`) from `grid.beat` through `beatsAt` and `BeatClock` (engine.md, "Shared timeline").

The player has "Gradient" and "Scenes" buttons, saved per device; both off leaves the base colour. `prefers-reduced-motion` turns the moving picture off. While Strudel plays with "Strudel visuals" on, this picture is not drawn: the Strudel view takes its place (the canvas keeps the level and the beat for it; [implementation/strudel.md](implementation/strudel.md), "The picture").

**No library draws it.** Particle and scene libraries (tsparticles, p5, PixiJS, three.js) own the loop and the drawing, so the tests cannot see what they draw and every listener would not necessarily see the same frame. The pure frame model stays the single source of truth and Canvas 2D paints it. The noise the scenes use is a small smooth value noise on the engine's own `hash01` (`scene-kit.ts`). A library would only be worth it for a per-pixel scene (a fluid or a real shader).

**Calibrate by eye on `/dev/visuals`**: the emotions side by side with a no-hue switch (they must read apart by form alone), tempo, scene, sync, and a gradients set with a Colour play switch.

## Scenes
Thirty scenes. When the model sets none, `moodToScene` scores each region of the axes (stretched by `stretchMood`) and takes the strongest; below 0.3 it returns nothing. The scene is marked `sceneAuto` and is not reported back to the model in `playing.picture` (only what it set). The model's own `scene` replaces it, `none` turns it off. Density follows how strongly the mood fits, speed follows calm and tension.

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

`MOOD_PROTOTYPES` (`mood-mapping.ts`) holds the axes that give each of the 14 test emotions its scene; a test pins all of them. A tester should send these values:

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

The model can set `scene`, `density`, `speed` and `sync` in `colour`; the rest is the mood's. Above 180 BPM the beat motion runs at half-time (a bar is 4 beats; 4/4 is assumed). In beat sync the first beat of each bar hits hardest; phrase sync (4 bars) has no per-beat bump. The beat shows in the form as well as the brightness: the glow swells, motes grow, streaks stretch, rings thicken.

## Colour play and flashing
Each moving light is painted at the lightness that changes the field's relative luminance least (`matchedLayer`, `colour-math.ts`), and its real worst-case swing per unit of opacity (`Layer.k`) is what counts, so the colour can be strong and pulse with the music while the brightness stays still. A test checks the declared swing against the real luminance change of the blend over random fields.

The flash rule is lifted for the large elements (Gael, 2026-11-13): nothing scales the wash, the glow, the layers or the veils to a luminance swing any more, and saturated red is not special-cased. Small items (motes, rings, streaks) still share a budget in `capFrame`: at most 10% of the view and 400 items. See [implementation/limits.md](implementation/limits.md). A scene that thins to fit (digital rain) drops its tails evenly by cell, not in order, so the right side is not cut.

## Standing behaviours
- **Narrow views crop, they do not squeeze.** Veil scenes sample the middle part of the design square when the view is narrower than tall, and scenes that spread items (aurora, fire, cracks, lightning, sunbeam) spread them by 1/aspect about the middle, so a phone shows fewer bands and flames of the same shape. Flock, circuit, network and scope work in real pixels. The vignette is an ellipse of the view.
- **Light scenes on a bright base.** Aurora, sunbeam, stars, fireflies, fireworks, embers, warp, motes, lightning, cracks, smoke and clouds get a dark veil under them (`lightSceneDim`): `visualFrame` darkens the base the scenes and the lights are computed against, so they pick their light variants. It is not reported in `clamped`.
- **A `veil` layer** is a field of 0 to 1 over the view in one colour, as fine as the picture is wide (up to 380 cells across for caustics, 260 for smoke, 200 for fire), blended between the two steps around now so the motion is smooth. `toneLayer` (`colour-math.ts`) gives its colour and the most opaque it may be.
- **Colour glides in the canvas too.** `blendColour` (`visual.ts`) glides hue (short arc), saturation, lightness, the second colour and the feel from the previous colour to the state's own over its transition, by the server's clock. A scene change keeps its crossfade of at least 1.5 s; after a silence the old scene fades out in 0.6 s from the level it was painted at, and one below 0.05 is dropped at once. A fade in from nothing starts when the state arrives on the device. Nothing shows at level 0, so no scene starts there.
- **The picture's opacity follows the level to the power 1.7**, so it keeps up with the sound.
- **`mode: "follow"`** keeps a scene, density, speed or sync sent in the same call.
- **`?debug`** (`?debug=1`, `?debug=true`) writes the picture's `[picture]` lines (new state, level fades, scene changes, beat jumps, the Strudel view) with `console.info`, in any build.
- **Known weak spot:** aurora is the heaviest to draw; on a 4x throttled CPU it was the only scene that made the canvas shrink.

## Comfort
- `prefers-reduced-motion`: no drift, pulse or particles; colour still changes, glided over at least 3 seconds.
- Contrast: the controls on top keep at least 4.5:1 whatever the model draws (the player puts them on a scrim).
- No text, faces or recognisable imagery: the field is atmosphere.
