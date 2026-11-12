# Test brief: Sonorous Envelope v0.15.8 (the end of a session with Strudel)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low.

This is a very short re-test of the one open point of v0.15.7 (report in docs/archive/strudel-test-report-v0.15.7.md). Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only.

## What changed

- At a session end with Strudel playing, Strudel now fades out over the same time as the picture (before, it faded in 3 seconds while the picture took the whole fade, so the music was gone long before the picture).
- The streaks (and other scenes) no longer jump when a new state arrives while Strudel plays. Before, each new state moved the picture's beat by up to half a step, which showed as the streaks "restarting" when the end fade began.

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and taps Start listening.

## Tests

For each test record pass or fail and the exact tool output for any failure.

1. End of a session with Strudel, rain. Play Strudel (stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)) at bpm 90, colour scene rain, density 0.8, sync beat). Then send a closing set_sound (calm 0.9, transition 8) while Strudel is still ON, then silence with fade 12 and end true. Ask the user to watch and listen: does the Strudel music fade out over about the same time as the picture (not much sooner)? Do the streaks keep falling smoothly when the closing set_sound arrives and when the end fade begins, with no jump or restart? Does the session end with "This session has ended."?
2. Same with ripples and with motes (colour scene ripples, then motes): no jump of the rings or the motes when the closing set_sound and the silence arrive.
3. Silence in the middle. With Strudel playing (rain), send silence with fade 6 (no end): the music and the picture fade together over about 6 seconds. Then Strudel again: both come back on the bar. Do the streaks jump when the silence arrives?
4. Strudel off. With Strudel playing, send strudel_mode on false, then a closing set_sound (synth) and silence with end true: Strudel fades in about 3 seconds, the closing synth sound starts when Strudel is almost gone, no overlap, and the end fades everything.
5. Code change. While Strudel plays, send new code with strudel_mode on, then a new colour with set_sound: does the music stay in time (no shift of the beat after the colour change)? Do the streaks stay smooth?
6. Regression. The owner clears the box with a scene on: streaks, background and sound fade together. The synth: set_sound with a mood sounds normal and the picture follows. Ticking the box again after clearing it: silent and black.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
