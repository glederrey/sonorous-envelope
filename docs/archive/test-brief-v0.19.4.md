# Test brief: Sonorous Envelope v0.19.4 (only the fixes)

Read this whole file first. v0.19.4 fixes what the v0.19.3 report found. Everything that passed in v0.19.3 is **not** tested again. Run only the tests below. No reconnect is needed. Start a new session, open the player on desktop with `?debug`, open the console, and tap "Start listening".

## What changed

- **Drawings back on: one crossfade.** Turning "Strudel visuals" back on over a scene no longer dips to black first: the drawings and their black background come in together over 1.5 s, the scene fading under them.
- **The picked scene is reported.** With no colour in `strudel_mode`, `playing.picture` names the scene the server picked, e.g. `bubbles (picked for the music) density 0.5 speed 0.73, sync beat`.
- **No glide after Strudel.** After `strudel_mode` off, the next `set_sound` starts at its own tempo: no "tempo X to Y" note, even when sent straight away.
- **Pace held.** The `clamped` line now says that `reads_as` reads the held sound, so its calm is higher than sent and needs no correction.

Not changed: warmth 0.55 reading 0.72 is within tolerance (a triangle is a soft timbre and reads warm); the synth glide on a switch to Jukebox before `strudel_mode` is allowed (a new call). The debug "Live" line is the grey text at the top of the controls panel, under "Leave this page, then come back…", starting with "Live: engine…"; it was checked in the lab (no "session type" on desktop).

## Tests (record pass, fail or partial, and what the user saw)

1. **Picked scene reported.** The user asks for a style; switch to Jukebox, then `strudel_mode` on with a pattern using `.pianoroll()`, 120 bpm or more, no colour. Pass: the result's `playing.picture` names a scene with "(picked for the music)".
2. **Drawings back on.** The owner turns "Strudel visuals" off, waits for the scene, then turns them back on. Pass: the scene fades under the drawings as they come in; no moment of black in between.
3. **No glide after Strudel.** `strudel_mode` with on false, then within 2 s a `set_sound` with a clearly different calm. Pass: no "tempo X to Y" note.
4. **Pace held.** From Self with a calm sound, offer Attuned; after a yes, switch with a lively mood. Pass: `clamped` has "pace held … do not correct for that".

## Report

Write the report as a Markdown file, `docs/test-report-v0.19.4.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what the user saw or said), then any feedback for Claude Code, numbered.
