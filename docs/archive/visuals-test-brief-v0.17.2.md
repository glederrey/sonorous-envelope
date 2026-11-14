# Test brief: Sonorous Envelope v0.17.2 (fixes to the v0.17.1 picture)

Read this whole file before you start. You are testing what the picture does and that the fixes from the v0.17.1 report hold. The sound is not the subject of this round.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. On the internal face (the default) the sound and picture are how the model feels, and the model says nothing about them unless asked.

## What changed since v0.17.1

- **Bright base (yellow) under a light scene:** the dark veil of v0.17.1 was painted first and then washed out by the gradient's lights. The base the scenes and lights work against is now the darkened one, so aurora, sunbeam, stars, fireflies, fireworks and warp should read on a bright yellow base.
- **The colour glides in the picture too.** Before, the base colour glided but the scene and the lights jumped to the new mood at once. Now they glide over the state's transition. This is the suspected cause of the scene redraw at the end of a session when the closing sound changes the mood (run 2 of last round) and of the abrupt colour jump (run 3).
- **Aurora:** no hard vertical bars at the foot of the curtains, gentler striations, fainter rays.
- **Caustics, smoke and fire** are built finer.
- **Digital rain** covers the whole width. **Fireworks** speed 0.1 is now clearly slow. **Motes** are never hard-edged. **Leaves** are more varied (narrow, oval, broad, round, and lobed maple leaves).
- **`mode: "follow"`** now keeps a scene (and density, speed, sync) sent in the same call.

## Setup

1. Reconnect the connector, call start_session, give the user the player link. The user opens it on a phone and a laptop and taps "Start listening". Open the browser console on one of them (in a development build it logs `[picture] mount`, `state`, `beat jump` and `unmount`; skip this on production).
2. Ask the user to watch the picture, not to listen. Do not announce or describe what you set (internal face).

## Tests

For each test record pass, fail or partial, plus what the user saw. For any failure give the exact tool output.

### D. The end of a session and mood changes (first)
1. D17 run 2 again. Set the scene `bubbles`. Send a closing `set_sound` that changes the mood a lot (for example from joyful to sad) with an 8 s transition. One second later call `silence` with `end: true` and `fade: 15`. Pass: the bubbles keep moving and the colours keep gliding, with no redraw and no jump, when the end command is sent and again about 7 s later when the fade starts; then everything fades. Fail: say at which moment it restarts or jumps.
2. D17 run 3. A mood change, then plain `silence` one second later with an 8 s transition running. Pass: the background keeps gliding, no jump.
3. D17 run 1 (the closing sound changes only the tempo) must still pass.
4. Mood change snow to aurora (no `scene` sent, so the mood picks): the background glides fully and the old scene crossfades into the new one without a redraw.
5. Plain `silence`: music and picture still fade together.

### B. The bright base
6. Bright yellow base (`mode` own, hue 55, saturation 0.9, lightness 0.75). Run aurora, sunbeam, stars, warp, fireflies and fireworks. Pass: all are clearly visible, on a darker base than the yellow. Say which are still weak. Also check smoke and clouds still look as before.
7. The awe mood (aurora) on its own: is the background still too bright?

### C. Scenes
8. Aurora, on a dark base and on the awe mood: no hard vertical bars at the foot of the curtains; the rays are soft.
9. Caustics, smoke and fire at full size on the laptop: are the lines still dashed or stair-stepped? Any stutter (give the device)?
10. Digital rain: columns reach the right side of the screen, on the laptop and the phone.
11. Fireworks: speed 0.1 against 1, same density: 0.1 should be clearly slower, and the sparks drift out slowly.
12. Motes: none hard-edged. Leaves: several different shapes, including a lobed one.
13. The moods in the table below, one at a time, still pick the scene listed (all 14 passed last round).

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


### D2. Smaller
14. `mode: "follow"` together with `scene: "fire"` in one call: the mood gets the colours back and fire stays.
15. `reads_as` for tender (warmth 0.9, joy 0.6) and cold anger (warmth 0.1): the same as last round or closer (last round tender warmth read 0.59, tender joy 0.28, cold anger warmth 0.47). Joy is still the weakest estimate (correlation about 0.54 with the mood sent) and was not changed.
16. Guest player "Add to your AI" button (not tested yet), with a guest session.

### Still open, please answer
- `players` with a real second device (not devtools in the same browser).
- Phrase sync (warp): is the swell about 4 bars (about 9 s at 110 BPM)?

## Report

For each test: pass, fail or partial, what was seen, and anything surprising. End with the three scenes the user liked most and the three they would cut or change first.
