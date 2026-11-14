# Test brief: Sonorous Envelope v0.18.4 (only what changed)

Read this whole file first. Run 2 of test 1 (no `set_sound` after `strudel_mode` off) and "Show controls" on a bright scene passed in v0.18.3 and are **not** tested again. You test the picture, not the sound.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, a synth sound with the **aurora** scene, then `strudel_mode` on with real music. Default colour.

## Tests (record pass, fail or partial, and what the user saw)

1. **No old scene when `set_sound` follows `strudel_mode` off.** `strudel_mode` on false, then, in the same turn, `set_sound` with the stars scene. Do it twice: once calling `set_sound` straight away, once after a few seconds of thinking before it. Pass: the aurora never shows, in either run. The picture goes black, then the stars fade in from black (no cross-fade from another scene).
2. **Closing sequence.** `strudel_mode` on false, a closing `set_sound` with a new scene, then `silence` with end. Pass: the closing scene fades in from black over about 2 seconds (a visible fade, not an add), and then fades out with the end of the session. Say what the final fade-out looked like.
3. **Controls panel over code.** 360 px window, a pattern of about 1,300 characters playing, controls open. Pass: the panel is as opaque as on the normal visuals (about 95%), no code ghosts through any row, and the picture behind it is blurred.

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose. Not done, your call: a very small `.spiral({ stretch })` sits off-centre; `colour: { mode: "follow" }` does nothing while Strudel is on.

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
