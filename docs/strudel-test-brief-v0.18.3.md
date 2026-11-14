# Test brief: Sonorous Envelope v0.18.3 (only what changed)

Read this whole file first. Tests 1, 2, 3, 5, 6 and 7 of the v0.18.2 round passed and are **not** tested again (except the back-to-synth case in test 1 below, because it changed). You test the picture and the buttons, not the sound.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, `strudel_mode` with real music. Do not announce what you set. Default colour.

## Tests (record pass, fail or partial, and what the user saw)

1. **No stale scene when Strudel ends.** First play a synth sound with the **aurora** scene, then `strudel_mode` on, then `strudel_mode` on false followed at once by a `set_sound` with a different scene (stars). Pass: the aurora never shows; after the code fades there is a moment of black (about a second), then the stars fade in. Then repeat with no `set_sound` after `strudel_mode` on false: the synth's last scene comes in after about a second, with no jump.
2. **Closing sequence.** `strudel_mode` on false, a closing `set_sound`, then `silence` with end. Pass: no old scene shows first, and the closing scene fades out into the end as before.
3. **Controls panel over code.** 360 px window, a pattern of about 1,300 characters playing, controls open. Pass: every row reads without code showing through its text, and the picture is still faintly visible behind the panel. Then press Hide controls: the "Show controls" button is more see-through than the panel but has a visible border; check it on a bright scene too.

## Still open, not for this round

`players` with a real second device (the server counted 1 for two windows), the guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose. Not done, your call: a very small `.spiral({ stretch })` sits off-centre; `colour: { mode: "follow" }` does nothing while Strudel is on (only the picture settings apply).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
