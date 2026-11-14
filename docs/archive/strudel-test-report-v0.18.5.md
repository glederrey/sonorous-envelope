# Strudel picture: fixes after the v0.18.5 test round

Tested on desktop and phone (devtools, 360 px), external face, Strudel on. `?debug` was not used.

## Results

| # | Test | Result | What the tester saw |
|---|------|--------|---------------------|
| 1 | No old scene after Strudel ends, `set_sound` straight away | Partial | "It didn't go to black. But to the green background color. However, the auroras didn't show up." The aurora is gone, which is the main fix. But the picture goes to the green colour-field background, not black, and the stars fade in from that. |
| 2A | Same, `set_sound` after about 3 s | Fail | Green in between for roughly 2 to 3 seconds, not black. By his answers to "did the aurora show?" and "did the stars fade in?" (both "yes"), the aurora showed and then the stars. Brief expectation: black, then the stars only. |
| 2B | Same, `set_sound` after about 8 s | Partial | "Green stayed for 4 secs. Then I saw the auroras and in the end the stars replaced them." The sequence and the 4 s timing match the brief, but the background is green, not black. |
| 3 | Closing sequence | Fail | "Fade to green, not black. Stars showed up and then the waves replaced them, then fading to black." The old scene (stars) showed first, the picture went to green, and the waves replaced the stars instead of fading in from black. The final fade-out to black was fine. |
| 4 | Controls panel over code (360 px, 1,207-char pattern) | Partial | Strudel view: no code ghosting through any row (pass), but the picture behind the panel is not blurred, and it is "a bit transparent". Normal scene (warp): "still fully opaque." |

## Fixes to make

### 1. The "black" the picture falls back to is the green colour field (tests 1, 2A, 2B, 3)
- When Strudel ends, the picture shows the colour-field background (green, hue about 88) for about 2 to 4 seconds. The brief says black. Either the expected black must really be black (no colour wash while there is no scene), or the brief should say green. The tester reads the green as "not black", so make it black.
- Scene fade-in: after that gap, the new scene should fade in over about 2 s from that background. Test 1 does this; test 3 does not (see 3).

### 2. Old scene still shows in the closing sequence (test 3)
- Repro: `strudel_mode` off, a closing `set_sound` with a new scene (waves), then `silence` with end.
- Actual: green, then the old stars show, then the waves replace them, then fade to black.
- Expected: the old scene never shows. The closing scene fades in from black and fades out at the end.
- The straight-away case in test 1 is fixed (the aurora no longer shows). The closing case is a different path: apply the same fix there. The old scene is probably still held for a moment when the closing `set_sound` arrives while the synth is paused or just resumed.

### 3. Old scene on a pause of about 3 s (test 2A)
- With a 3 s pause the aurora still showed, then the stars. Check this against the 8 s case, where an aurora fade-in is the expected behaviour. The brief's two pauses make the cut-off unclear: decide how long the old scene may wait before it is allowed to appear, and make the behaviour the same each time.

### 4. Controls panel on the Strudel view (test 4)
- No code ghosts through the rows: good.
- The picture behind the panel is still not blurred. "Show controls" is blurred; the open panel is not. Apply the 8 to 12 px backdrop blur to the open panel.
- It still looks "a bit transparent" next to the normal scene. Pick one value for both views and apply it to both. Right now the normal scene is fully opaque and the Strudel view is about 95%.
- On the normal scene the panel is still fully opaque, which differs from the Strudel view. Make the two views match.

## Still open from earlier rounds (optional)
- The synth visuals switch faster than the synth audio fades in after Strudel.
- Spiral at minimum stretch looks lopsided.
- `colour: {mode: "follow"}` has no effect while Strudel is on.
- `players` shows 1 with two windows open.
