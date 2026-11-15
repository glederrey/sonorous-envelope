# Test brief: Sonorous Envelope v0.18.5 (only what changed)

Read this whole file first. The final fade-out of the closing sequence and "Show controls" passed before and are **not** tested again. You test the picture, not the sound. If something still looks wrong, open the player with `?debug` at the end of the URL, repeat the run and send the lines starting with `[picture]` from the browser console (they give the time and scene of each state the picture received).

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, a synth sound with the **aurora** scene, then `strudel_mode` on with real music. Default colour.

## Tests (record pass, fail or partial, and what the user saw)

1. **No old scene after Strudel ends, set_sound straight away.** `strudel_mode` on false, then at once `set_sound` with the stars scene. Pass: the aurora never shows, even faintly; the code fades, the picture is black, then the stars fade in from black (about 2 s).
2. **Same, with a pause.** `strudel_mode` on false, then `set_sound` with stars after about 3 seconds. Pass: black until the stars fade in; no aurora. Then once with a pause of about 8 seconds: black for about 4 seconds, then the aurora (the synth's last scene) fades in from black, then the stars replace it. Say how long the black lasted.
3. **Closing sequence.** `strudel_mode` on false, a closing `set_sound` with a new scene, then `silence` with end. Pass: the old scene never shows first, the closing scene fades in from black, and fades out at the end.
4. **Controls panel over code.** 360 px window, a pattern of about 1,300 characters playing, controls open. Pass: no code ghosts through any row, and the picture behind the panel is blurred. Also open it over a normal scene: same look.

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose. Not done, your call: a very small `.spiral({ stretch })` sits off-centre; `colour: { mode: "follow" }` does nothing while Strudel is on.

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
