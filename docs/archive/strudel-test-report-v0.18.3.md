# Strudel picture: fixes after the v0.18.3 test round

Tested on desktop (laptop) and phone (devtools), external face, Strudel on.

## Results

| # | Test | Result | What the tester saw |
|---|------|--------|---------------------|
| 1 | No stale scene when Strudel ends | Fail (run 1), pass (run 2) | Run 1 (`strudel_mode` off, then `set_sound` with a new scene right after): "it first went to 0 visuals. Then, auroras showed up, started to fade out while the snow faded in." Run 2 (no `set_sound`): the stars came in and the aurora did not show. |
| 2 | Closing sequence | Partial | "It switched to the blank background, then added the visual. But it was a bit too quick. (not sure there was much of a fade). No sunbeam though." |
| 3 | Controls panel and "Show controls" | Partial | Panel on the Strudel view is slightly transparent, with code ghosting through and no visible blur. On the normal visuals it is fully opaque. "Show controls" is fine on a bright scene. |

## Fixes to make

### 1. Stale scene still shows when `set_sound` follows `strudel_mode` off (test 1, run 1)
- Repro: `strudel_mode {on: false}` and, in the same turn, `set_sound` with a different scene (aurora to stars).
- Actual: picture goes black, the old aurora appears, then crossfades out while the new scene fades in.
- Expected: the old scene must never appear. Leaving Strudel should crossfade from the blank background straight to the newest scene.
- Suggestion: when Strudel ends, drop the cached scene and use the latest `set_sound` scene, even if that call arrives a moment after the stop. If a scene change arrives within the exit transition, replace the target scene instead of showing the old one.

### 2. Closing sequence: the switch to the closing scene is too abrupt (test 2)
- The stale sunbeam no longer shows, which is good.
- But the picture goes to a blank background and the new visual is added with barely any fade.
- Expected: a visible, smooth fade from the blank background into the closing scene (roughly 1 to 2 s, the same feel as the Strudel visuals fade-in), then the closing scene fades out with the end of the session.
- The tester did not say whether the final fade-out into the end looked right. Re-check it.

### 3. Controls panel opacity (test 3)
- Use the same opacity on the normal visuals and on the Strudel view: about 0.95.
- On the Strudel view the code ghosts through and the blur is not visible. Check that the backdrop blur is applied there too.
- "Show controls" stays more transparent than the open panel. It is fine as it is.

## Still open from earlier rounds (optional)
- The synth visuals switch faster than the synth audio fades in after Strudel.
- Spiral at minimum stretch looks lopsided.
- `colour: {mode: "follow"}` has no effect while Strudel is on.
- `players` shows 1 with two windows open.
