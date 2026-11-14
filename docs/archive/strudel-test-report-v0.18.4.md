# Strudel picture: fixes after the v0.18.4 test round

Tested on desktop and phone (devtools, 360 px), external face, Strudel on.

## Results

| # | Test | Result | What the tester saw |
|---|------|--------|---------------------|
| 1a | No old scene after `strudel_mode` off + `set_sound` (straight away) | Fail | "auroras showed up. But very faintly. Cross-fade from strudel." The aurora showed faintly, and the stars cross-faded from the Strudel picture instead of fading in from black. |
| 1b | Same, with a pause (about 6 s) before `set_sound` | Fail | "There was no pause. It went directly to the internal synth with the auroras. Then fade to the stars." The aurora showed fully, then faded to the stars. No black in between. |
| 2 | Closing sequence (`strudel_mode` off, closing `set_sound` with new scene, `silence` end) | Fail on the first part, pass on the second | "Stars showed up. Then, the waves faded to black normally." The old scene (stars) showed first, before the closing scene (waves). The final fade-out was fine. |
| 3 | Controls panel over code (360 px, 1,207-char pattern) | Partial | The panel on the Strudel view is about 95% opaque, but "behind the show control it's blurred, behind the control panel it's not." On the normal visuals (warp scene), "the panel is still fully opaque." |

## Fixes to make

### 1. Old synth scene still shows when Strudel ends (tests 1a, 1b, 2)
This is the same bug as in v0.18.3 and the fix did not take effect. In all three cases the aurora or stars (the synth's old scene) showed before the new scene.

- Repro A: `strudel_mode {on: false}`, then `set_sound` with a new scene. Run it back to back and with a few seconds in between.
- Repro B: `strudel_mode {on: false}`, closing `set_sound`, `silence {end: true}`.
- Actual: the picture goes to the synth's old scene (full aurora, or a faint one), then cross-fades to the new scene. In run 1a the stars cross-faded from the Strudel picture instead of from black.
- Expected: leaving Strudel always goes to black. A new scene sent after that fades in from black over about 2 s. The old synth scene never shows, whether or not a `set_sound` follows.
- Suggestion: when Strudel ends, drop the old synth scene from the picture. Show black until a scene is set. If a `set_sound` scene arrives later (even many seconds later), fade it in from black. If the owner's player has no scene when Strudel ends, stay black rather than reviving the old one.
- Note: a run without any `set_sound` after `strudel_mode` off passed in v0.18.3. It was not retested here.

### 2. Controls panel: same opacity and blur on both views (test 3)
- On the Strudel view the panel is about 95% opaque, as wanted, but the picture behind it is not blurred. Only the "Show controls" button blurs its background. Apply the 8 to 12 px backdrop blur to the open panel too.
- On the normal visuals the panel is still fully opaque. Set it to the same about 95% so the two views match.
- "Show controls" is fine.

## Still open from earlier rounds (optional)
- The synth visuals switch faster than the synth audio fades in after Strudel.
- Spiral at minimum stretch looks lopsided.
- `colour: {mode: "follow"}` has no effect while Strudel is on.
- `players` shows 1 with two windows open.
