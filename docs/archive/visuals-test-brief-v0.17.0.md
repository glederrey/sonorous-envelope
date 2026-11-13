# Test brief: Sonorous Envelope v0.17.0 (30 visuals, the picture in three parts)

Read this whole file before you start. You are testing what the picture does and how well it carries a feeling. The sound is not the subject of this round.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. On the internal face (the default) the sound and picture are how the model feels, and the model says nothing about them unless asked.

## What is new

### The picture has three parts
1. **Base colour**: one flat colour from the mood, always on.
2. **Gradient**: slow moving lights over the base. They never follow the beat, and an orbit takes at least about 6 s. Four extra cues live in it: a vignette (a close mood darkens the edges, a distant one only the corners), a vertical lean (joy lifts the lights, sorrow lets them sink), the shape (`colour.shape`: `glow` gathers the lights round the middle, `sweep` rides them round a ring, `wash` spreads them) and a hue that wanders a little.
3. **Visuals**: the scene, where the beat shows.

The listener has two buttons in the player, "Gradient: on/off" and "Visuals: on/off" (saved on the device). Both off leaves the flat base colour. The old "Still picture" button is gone. The motion's own wash and glow (the brightness pulse and the white spot) are gone.

### 30 scenes
motes, ripples, rain, snow, embers, aurora, waves, fireflies, stars, bubbles, leaves, seeds, tide, smoke, clouds, fire, warp, caustics, lightning, sunbeam, cracks, ink, circuit, digital, scope, vines, fireworks, reeds, network, flock.

New since v0.16.0 (all of them except the ones that existed before the visuals branch): smoke, clouds, fire, warp, caustics, lightning, sunbeam (slanted warm light shafts with dust, the lean is random per session), cracks (a hit on the beat and fractures), ink (drops of ink in water, chosen by the model only, no mood picks it), plus reworked aurora, scope, vines, reeds, network and flock (70 to 120 birds at least, up to 75% more).

### The mood picks a scene, and it is only a suggestion
When the model sends no `scene`, the mood picks one: sad rain, melancholy leaves, nostalgia sunbeam, anger embers, cold anger cracks, awe aurora, joy motes, calm content waves, tender fireflies, hopeful fire, eager warp, dreamy caustics, dread lightning, playful bubbles, serene stars, lonely snow, free seeds, peaceful tide, pensive clouds, brooding smoke, analytical circuit, alert digital rain, driven scope, determined vines, elated fireworks, longing reeds, curious network, restless a flock. A neutral mood gets none. The model can set any scene in `colour.scene` (and `density`, `speed`, `sync`), and then the mood does not pick.

### Other changes
- The flash rule for large elements is lifted (the owner's decision). Small elements are still capped (10% of the view, at most 400). State changes still glide over at least 1 s.
- The public Safety page is removed. The landing page has two cards for the two ways to make sound, a "30 visuals" mention, and "Add to your AI" as the section name.
- The canvas draws at the device's own resolution and steps down on a slow device.

## Setup

1. Reconnect the connector, call start_session, give the user the player link. The user opens it on a phone and on a laptop and taps "Start listening".
2. Ask the user to watch the picture, not to listen. Do not announce or describe what you set (internal face).

## Tests

For each test record pass or fail, plus what the user saw. For any failure give the exact tool output.

### A. The mood picks a scene
1. Send moods one at a time, with no `scene`, waiting about 10 s each, and ask the user which scene they see: sad, lonely, melancholic, nostalgic, angry, cold anger (low warmth, high tension, low joy and calm), tender, hopeful, eager, dreamy, dread, awe, serene, restless. Pass: the scene matches the list above for at least 11 of 14, and the user finds the picture fits the feeling.
2. `result.playing.colour` mirrors what you set, and a scene the mood picked is not reported back as something you set.
3. A neutral mood (all axes 0.5) shows no scene.

### B. The model sets any scene
4. With a sad mood, set `scene: "fire"`. Pass: fire appears and stays while the mood changes (until you change it).
5. Set `scene: "ink"`. Pass: ink drops appear. Set `scene: "none"`: the scene fades out.
6. Try every scene name once. Pass: no error from the schema, and the user sees 30 different pictures. Note any that look broken, empty or too faint on the current background.
7. `density` 0.1 and 1, `speed` 0.1 and 1, on smoke, flock, fireworks and rain: more and less of it, quicker and slower. Pass: the difference is visible.
8. `sync`: beat, phrase, free. Pass: with beat the scene follows the tempo, with free it keeps its own pace.

### C. The three parts
9. Gradient off: the colours stop moving, the scene keeps playing. Visuals off: the scene disappears, the colours keep moving. Both off: one flat colour. Reload the page: the choice is kept.
10. In a quiet, close mood (closeness 0.9) the edges are darker than in a distant one (closeness 0.1), with the visuals off.
11. High joy: the lights sit higher. Low joy: lower. With the visuals off and No hue not available, judge by feel and say so.
12. `colour.shape`: glow, sweep and wash look different (the lights gather, ride a ring, spread).
13. The gradient never pulses on the beat: watch for 30 s at about 120 BPM. Pass: nothing flashes with the beat except things in the scene.

### D. Transitions and silence
14. Change from one scene to another (snow to aurora). Pass: the old scene fades out and is not redrawn from nothing first.
15. `silence`: the picture, including the background colour, fades to black and does not redraw the scene twice.
16. Pick a new mood: colours glide, no jump.

### E. Quality, on a phone and a laptop
17. Does any scene stutter or feel low in resolution (smoke, clouds, aurora, fire, flock, ink are the heaviest)? Give the device.
18. Is any scene hard to see on a bright background (smoke, clouds, aurora, sunbeam)? Which colours?
19. Flock: are there enough birds, and do groups split and come together again?
20. Warp: do the rings follow the tempo, and are they too fast at a high tempo?
21. Sunbeam: do the shafts lean differently between sessions, never flatter than 40° from the horizontal?
22. Cracks: do the fractures grow on the beat and fade?

### F. The site
23. The landing page: the hero shows chips (A synthesizer, A colour field, 30 visuals, Strudel). Below it only three sections: "Two ways to make sound" (two cards), "Hear what to expect" and "Keep the player open".
24. The header has Add to your AI, Connector and Two faces. "Add to your AI" opens a page with the connector URL, Claude steps, and outlines for ChatGPT, GitHub Copilot in VS Code and Microsoft Copilot Studio (only Claude is tested). The "Add to your AI" button in a player opened by a guest goes there, and so does "Step by step" in the hero.
25. The Connector page has "The tools" and "How it works" as two separate sections.
26. `/safety` returns a 404 and nothing links to it.

## Report

For each test: pass, fail or partial, what was seen, and anything surprising. End with the three scenes the user liked most and the three they would cut or change first.
