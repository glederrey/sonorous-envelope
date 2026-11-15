# Handoff: the scene and panel problems still open after v0.18.5

For Gael and Opus, to work on the next day. Written by Claude (Sonnet) after four rounds of blind fixes that did not work. Read this before changing anything: the main lesson is that **I could not reproduce the player flow here, so every fix was a guess from a report**. Step 1 below is to build a way to see it.

Test results of this round: `docs/archive/strudel-test-report-v0.18.5.md`. Earlier rounds: `docs/archive/strudel-test-report-v0.18.1.md` to `v0.18.4.md` (same folder), briefs next to them.

## What is wrong (as the tester sees it)

1. **When Strudel ends, the picture falls back to the green colour field, not to black.** Seen in every test of v0.18.5 (green for 2 to 4 s). The brief and Gael want black.
2. **The synth's old scene still shows when Strudel ends** unless the next `set_sound` comes within about a second or two:
   - `strudel_mode` off + `set_sound` straight away: aurora gone (good), but a green gap and the stars fade in from green.
   - same with a pause of about 3 s: the aurora showed, then the stars.
   - same with a pause of about 8 s: green for 4 s, aurora fades in, stars replace it (the behaviour the 4 s hold was designed to give, except for the green).
   - closing sequence (`strudel_mode` off, closing `set_sound` waves, `silence` end): green, then the old stars, then the waves replace them, then the end fade (the end fade is fine).
3. **The controls panel over the Strudel view is "a bit transparent" and the picture behind it is not blurred.** Over a normal scene the same panel looks fully opaque. "Show controls" blurs fine.

Gael's instruction for what is expected: leaving Strudel always goes to black; the old synth scene never shows; a new scene fades in from black over about 2 s; the closing scene fades in from black and fades out with the end.

## Why I think it fails (hypotheses, only the first two have real evidence)

### A. The "black" is the colour field, not black (strong evidence)
`.pl-field` paints the session's colour (hue/saturation/lightness from the state; green was hue about 88). The canvas paints the scenes over it. When the canvas paints nothing (level 0, or the hold I added in `visual-canvas.tsx`, "nothing shows"), the field shows through: green. The picture is only black when `.pl-dim` (a black overlay, `opacity: var(--pl-dim)`) is up, and `--pl-dim` is set in `player.tsx` only for a **silent** state (`playing && !isSounding(playing.state)`). The hold keeps the state sounding, so the dim is off. This is the same family of bug as the orange field of v0.18.0, which was fixed for the Strudel view by making that view opaque (`.pl-strudel` background); nothing is opaque during the hand-over. **Fix idea:** during the hold the picture must be black. Either raise `--pl-dim` to 1 while `sceneHold` is active (it already has a CSS transition `--pl-t`, check its duration and delay), or put an opaque black layer there. Fade the layer out as the new scene fades in, so the scene comes up from black and not from the field.

### B. A timed hold cannot work, because nobody knows whether a `set_sound` is coming (strong evidence from the timings)
The hold is 4 s (`sceneHold`, `player.tsx` near line 563, read in `visual-canvas.tsx` near lines 221 to 228). The model's next call takes several seconds (a tool round trip plus thinking), so: straight away works, "about 3 s" in practice is more than 4 s, the closing sequence has two calls after `strudel_mode` off, so the stars (the synth's last scene) appear at 4 s, then the waves. The tester's "3 s" and "8 s" are rough. **No timeout fixes this.** The honest options:
- **(Recommended) Server side: make `strudel_mode` off not restore the old scene.** In `apps/web/lib/mcp/service.ts`, the `on: false` branch (line about 460, `delete e.engine; delete e.pattern; ...` inside `writePatternState`) writes the previous effective state minus the pattern, so the synth comes back "where you left it", with its last scene and volume. Instead write a state with the scene cleared (and decide the volume: either silent until the next `set_sound`, which is already what the code does when the synth was silent, see the note "back on the synth, but its state is silent (volume 0): nothing fades in until you send set_sound", or keep the volume with `scene: "none"`). A silent state with no scene is already handled by the player: it dims to black (`--pl-dim`) over its transition, and the next `set_sound` fades in from there. That removes the stale scene at the source, with no timing in the player, and gives black for free (see A). It changes the tool contract, so update `docs/implementation/mcp-tools.md`, the `strudel_mode` description and `modes.ts`, the tool note, and `service.integration.test.ts` (the test around line 469 "switches the engine on and off, keeps the beat running").
- Client side only: hold black **until the next state arrives, no timeout**, with a long safety limit (say 20 s) and sound continuing meanwhile. Worse: the sound and the picture disagree for as long as the model takes, and if the model never sends `set_sound` the picture is black while a synth plays.

### C. The player flow itself (state `A`, then `B`) may not be what I think (weak, unverified)
I assumed `strudel_mode` off writes one new state row `A` (new `created_at`) that the player applies once, then `set_sound` writes `B`. If polls and broadcasts coalesce, the player can see only `B`, or `A` twice. My v0.18.4 attempt (a `wasView` flag in the canvas loop) never took effect in the real player and I never found out why; v0.18.5 replaced it with a signal from the player (`sceneHold`), which did work for the straight-away case. **Do not trust any of my reasoning about frame order: log it** (see "How to look" below).

### D. Panel blur and opacity (no root cause found)
`.pl-panel` is one CSS rule (`globals.css`, `--scrim-panel`, now 0.97 with `blur(18px)`), the same on both views, so a real difference should not exist. Ideas to check in a real browser with devtools, not by reading CSS:
- The Strudel view (`.pl-strudel`) is `position: sticky; height: calc(100dvh - header - footer)`. At 360 px wide the stage is taller than that, so the panel may extend below the sticky view and sit over the plain field there: the "ghost" and the missing blur would then be what is behind the lower part. Compare where the code ends and where the panel starts.
- `backdrop-filter` stops working when an ancestor creates a "backdrop root" (filter, opacity below 1, mask, `will-change`, `isolation`). `.pl-stage` is `position: relative; z-index: 1`; check ancestors, and the StrudelView element's own `opacity` and `visibility` toggling.
- The simplest robust answer is to stop depending on blur: make the panel effectively opaque (1.0, or a solid colour-mix) on both views. Gael once asked for "about 90 to 95%" so the picture shows faintly; the last two rounds show he cannot see the blur anyway. Ask him.

## What I tried, in order (so you do not repeat it)

| Version | Change | Result |
|---|---|---|
| v0.18.2 | Strudel view: content only dims while it fades out; fade-out 0.3 s; `patternBlocked`/`stripped` condition so Allow Strudel off does not flash the scenes; spiral drawn as filled bands; top row as a 3-column grid; panel 0.86 | Passed (scene flash, spiral, top row). Panel partial. |
| v0.18.3 | In the canvas loop: when the key (`at` + target) changes and the Strudel view was showing (`wasView`), start the level at 0 and wait `SCENE_HOLD` = 1 s; panel 0.9 / blur 10; Show controls 60% | Failed: aurora showed after the hold, or at once. |
| v0.18.4 | Hold 4 s; while level is 0 forget the current scene (`curSig`/`curScene`/`fromScene`) so nothing cross-fades from an old scene; scenes from nothing take at least 2 s (`SCENE_FADE_IN`); panel 0.95 / blur 14 | Failed the same way: aurora faint, then cross-fade; no black. I never found why the hold did not run. |
| v0.18.5 | Replaced the `wasView` guess with a signal: the `stShown` effect in `player.tsx` sets `sceneHold = { until: now + 4 s, at: playing.at }` when the Strudel picture hands over to a synth state; the canvas shows nothing while `until` is in the future and the state is still that one, then fades in from "now" (`fromNow`); panel 0.97 / blur 18 | Straight-away case: the aurora no longer shows. Everything else still fails (green, timing, closing, panel). |

The 4 s hold, the signal and the "forget the old scene at level 0" rule are still in the code and are not harmful, but if you take the server-side route in B they become unnecessary: remove them rather than keep two mechanisms.

## How to look (do this first)

- There is **no lab for the player**, only for the controls (`/dev/controls`, with a fake Supabase client in `apps/web/app/dev/controls/`) and for the Strudel drawings (`/dev/strudel`). Neither runs `player.tsx`'s state handling, which is where all of this lives. Build a small `/dev/player` that renders the real `Player` (or the pieces: `VisualCanvas` + `StrudelView` + the `stShown` effect) with a fake client that serves a scripted sequence of states: synth with a scene, Strudel, `strudel_mode` off (state A), `set_sound` after 0.5 s, 3 s, 8 s, then `silence` with end. Drive it with Playwright, sample the canvas and the `.pl-dim` / `.pl-strudel` opacity every 100 ms, and screenshot at 0.5, 1.5, 3, 5 s. Never read production sessions (project rule); the fake client is enough.
- The picture already logs in dev: `?debug` on the player URL or a dev build prints `[picture] state { at, tau, vol, delay, scene }` for each state it receives (`visual-canvas.tsx`, search `dbg(`). Ask the tester to run once with `?debug` and send the console lines: it shows how many states arrive, their order and timing, and settles hypothesis C.
- Dev server: Gael's, on port 3000. Never start or kill another (project memory). Playwright is run with `uv run --with playwright python3 script.py`.

## Where things are

| What | Where |
|---|---|
| State written by `strudel_mode` off | `apps/web/lib/mcp/service.ts`, `on: false` branch, near line 455 to 463; `writePatternState` near line 378 |
| Player applies a state | `apps/web/components/player/player.tsx`, `apply` (near line 222) and the poll `handle` (near line 309) |
| Allow Strudel off / owner stop | `player.tsx`, the effect on `[face, allowCode, runEngine]` (near line 205): strips the pattern, volume 0, 3 s transition, calls `block(at)` |
| Picture hand-over and the hold | `player.tsx` near lines 548 to 568 (`patternShows`, `stripped`, `sceneHold`); `visual-canvas.tsx` near lines 216 to 240 (level ramp, `fadeMin`, `fromNow`, the hold branch) |
| Strudel view fade in / out | `apps/web/components/player/strudel-view.tsx` (`op`, `vis`; fade-out 0.3 s, fade-in 0.35 s) |
| Black overlay | `.pl-dim` in `apps/web/app/globals.css` (near line 1039), `--pl-dim` set in `player.tsx` for silent states |
| Panel | `.pl-panel`, `--scrim-panel` in `globals.css`; `.pl-reveal` for Show controls |
| What was designed | `docs/implementation/strudel.md`, the "Fades and the colour field" bullet and its v0.18.x notes; `docs/implementation/player-ui.md` |
| The briefs and reports | `docs/strudel-test-brief-v0.18.5.md` and `docs/archive/` |

## Suggested order for tomorrow

1. Build the `/dev/player` lab (or at least a script that feeds `VisualCanvas` + the `stShown` effect a scripted state sequence) so each change can be seen without a tester. Reproduce the green and the stars-after-4-s first.
2. Decide B with Gael (server-side clean state recommended). Implement it, remove the client hold, check that a silent scene-less state dims to black and a following `set_sound` fades in from black over at least 2 s.
3. Make the closing sequence work with the same mechanism (it has two calls after `strudel_mode` off).
4. Panel: measure in a real browser at 360 px, then either fix the blur or make the panel opaque. One value for both views.
5. Write the next test brief with only these tests: stars straight away; stars after about 3 s; stars after about 8 s; closing sequence; panel on the Strudel view and on a normal scene. No "still open" list (Gael does not want it).

## Test brief for the round after the fix (draft)

Same setup as the earlier briefs (aurora as the synth's scene, then `strudel_mode` on with real music, default colour). In each test the picture must go to **black** (not green) when the code fades, the aurora must never show, and the new scene must fade in from black over about 2 s:
1. `strudel_mode` off, then at once `set_sound` stars.
2. `strudel_mode` off, `set_sound` stars after about 3 s.
3. `strudel_mode` off, `set_sound` stars after about 8 s (with the server-side fix the black lasts until the `set_sound`).
4. `strudel_mode` off, a closing `set_sound` with waves, then `silence` with end.
5. 360 px, 1,300-character pattern, controls open: no ghost of the code through the panel, same look as over a normal scene.
