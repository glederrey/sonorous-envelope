# Test brief: Sonorous Envelope v0.15.6 (last two visual fixes)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low.

This is a short re-test of what was open in v0.15.5 (report in docs/archive/strudel-test-report-v0.15.5.md). Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

- When Strudel starts after a silence, the picture now fades in on the same bar as the music (before, the picture came first and the music waited for the next bar).
- When the owner locks Internal while Strudel plays with a rain (or other) scene, the streaks now fade out with the sound instead of vanishing at once.
- The guest button reads "Add to your AI" (before: "Add it to your AI app").

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and taps Start listening. Ask for a private window (not signed in) for test 3.

## Tests

For each test record pass or fail and the exact tool output for any failure.

1. Picture with the music. Play Strudel (stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)) at bpm 90, colour scene rain, sync beat, so that the wait for the next bar is long). Then silence with fade 6. When it is black and silent, send strudel_mode on again with the same code. Ask the user to watch and listen: do the picture and the music start together, on the same beat? Does the picture stay black until then? Repeat three times, with bpm 90 and bpm 130, and once with new code.
2. Strudel from the synth. Play a synth sound first (set_sound), then strudel_mode on: the picture is already on (no black gap) and the music comes in on the next bar. Is that fine?
3. Internal lock with a scene. Play Strudel with colour scene rain (or ripples). The owner locks Internal. Do the streaks fade out smoothly together with the sound and the background, over about 3 seconds, instead of disappearing at once? Restore Auto: nothing comes back by itself.
4. Owner clears the box with a scene. Same with the Strudel box cleared: the streaks fade with the sound. (This worked before: check it still does.)
5. Label. In the private window (not signed in), before pressing Start listening and after: the first button says "Add to your AI", with "Copy link" next to it on one row, labels on one line. On the phone as a guest too (it was not checked last time).
6. Session end while Strudel plays. Play Strudel, then send, in this order: a closing set_sound (calm mood, transition 8) while strudel_mode is still ON (do NOT send on false first), then silence with end true. Does Strudel fade out in about 3 seconds at most, and the closing sound start only when it is almost gone? Do the picture and the sound end together, with "This session has ended."? (This path was not run in the last round.)
7. Regression. Silence with fade 6, then Strudel again: picture and sound come back. Same code twice: the notes say "same code and tempo as before". The synth: set_sound with a mood sounds normal and the picture follows. Ticking the box again after clearing it: silence and black.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
