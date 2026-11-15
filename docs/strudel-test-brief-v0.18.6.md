# Test brief: Sonorous Envelope v0.18.6 (only what changed)

Read this whole file first. Only the hand-over from Strudel back to the synth and the controls panel changed, so only those are tested. The final fade-out of the closing sequence, "Show controls", no code ghosting through the panel rows, and the straight-away case not showing the aurora all passed in v0.18.5 and are **not** tested again. You test the picture, not the sound. If something looks wrong, open the player with `?debug` at the end of the URL, repeat the run and send the lines starting with `[picture]` from the browser console.

## What changed

- `strudel_mode` with `on: false` no longer brings the synth back as it was left. It writes a **silent state with no scene**: Strudel and the picture fade to **black** over about 2 s, and nothing plays until the next `set_sound`, which fades in from black over about 2 s. The tool's note says so. The old scene (aurora) cannot come back, however long the next call takes.
- The 4 s "hold" from v0.18.5 is gone. There is no timing any more: the black lasts until the `set_sound`.
- The controls panel never had its blur: the CSS build dropped the line. It now has it, on every view (97% opaque, 18 px blur).
- Dependencies were upgraded (Next 16.4.6, TypeScript 7, esbuild 0.28, mcp-handler 2.4). Reconnecting and `start_session` in the setup are enough to check the connector still works.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, a synth sound with the **aurora** scene, then `strudel_mode` on with real music. Default colour.

## Tests (record pass, fail or partial, and what the user saw)

1. **Straight away.** `strudel_mode` on false, then at once `set_sound` with the stars scene. Pass: the code fades to black (not green), the aurora never shows, the stars fade in from black over about 2 s.
2. **After about 3 s.** `strudel_mode` on false, then `set_sound` with stars after about 3 seconds. Pass: black (not green) until the stars, no aurora, the stars fade in from black.
3. **After about 8 s.** Same with a pause of about 8 seconds. Pass: black for the whole pause (the aurora does **not** come back after 4 s any more), then the stars fade in from black.
4. **Closing sequence.** `strudel_mode` on false, a closing `set_sound` with the waves scene, then `silence` with end. Pass: black first, the stars or the aurora never show, the waves fade in from black, then the end fade (already passed, just note if it changed).
5. **Controls panel.** 360 px window, a pattern of about 1,300 characters playing, controls open: the code behind the panel is blurred, the panel looks the same as over a normal scene. Then over a normal scene (warp, for example): same look. Pass: one look on both views, blurred behind, no code readable through it.

6. **"Strudel visuals" off while code plays.** With a pattern playing, turn "Strudel visuals" off. The view now goes to black first and fades to the scenes over about 2 s (before: a quick 0.3 s cross-fade). Pass: it reads as a calm fade, not a flash, and turning it back on brings the code back as before.
7. **A normal fade-in after silence.** On the synth only: `silence` (not end), then `set_sound` with a scene. The dark layer now lifts over at least 2 s, with the scene. Pass: the scene and the colour come up together from black, no colour patch before the scene.

Also fixed after a code review, with nothing for you to test: `silence` counts toward the 20-per-minute limit (except `silence` with end); `strudel_mode` off while Strudel is not on changes nothing; NaN can no longer slip past the volume, pulse and small-element caps or the listener volume; a failed audio start no longer leaves an audio context running; `.fscope()`/`.spectrum()` with min equal to max no longer draws nothing; a Strudel sandbox closed while it starts no longer stays behind.

## Optional, on Gael's dev server

`http://localhost:3000/dev/player` runs the real player on scripted states, no session needed: press Start listening, then "Synth aurora", "Strudel on", then one of the hand-overs ("Off, stars after 0.5 / 1.5 / 3 / 8 s", "Strudel straight to stars", "Closing"). The `set_sound` transition can be set to 0.5 s to check that the black does not lift before the scene. It needs `pnpm --filter web build:worklet` and `pnpm --filter web build:strudel` once (the bundles are not in git).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
