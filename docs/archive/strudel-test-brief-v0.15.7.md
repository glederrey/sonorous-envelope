# Test brief: Sonorous Envelope v0.15.7 (the streaks, and a fade-in for Strudel)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low.

This is a short re-test of what was open in v0.15.6 (report in docs/archive/strudel-test-report-v0.15.6.md). Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

- When the owner locks Internal or clears the Strudel box, the rain streaks (and other scenes) now fade out with the sound and the background over about 3 seconds. Before, they vanished at once.
- Strudel now fades in when it starts from silence: silent until the first bar, then up over about half a second. (Before it started at full level.) New code sent while a pattern plays does not fade.
- The note that comes back when you send set_sound while Strudel plays now says that a closing sound needs strudel_mode on false first, and that silence with end fades Strudel and the picture.

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and taps Start listening.

## Tests

For each test record pass or fail and the exact tool output for any failure.

1. Clear the box with rain. Play Strudel (stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)) at bpm 100, colour scene rain, density 0.8, sync beat). Wait at least one minute so the state is old. The owner clears "Let the model play Strudel code". Ask the user: do the streaks, the background and the sound all fade out together over about 3 seconds? Is any part gone at once?
2. Internal lock with rain. Play Strudel with the same colour again. The owner locks Internal. Same question. Then restore Auto: nothing comes back by itself. Then set_sound with a mood and mode external (after asking the user): the synth and the picture come in.
3. Same with ripples. Repeat test 1 or 2 with colour scene ripples (and once with motes): the scene fades with the sound.
4. Strudel fade-in. After a silence (silence with fade 6, wait until it is black and silent), send strudel_mode on with the same code. Do the picture and the music still start together on the bar, and does the music now come in softly (about half a second) instead of at full level? Repeat three times, at bpm 90 and 130, and once with a very short pattern (note("c3 e3")). Does the fade-in hide the first drum hit too much? Say what you hear.
5. New code on a playing pattern. While Strudel plays, send different code: it changes on the next bar with no fade and no dip in volume. Same code again: nothing changes.
6. Start from the synth. Play a synth sound, then strudel_mode on: the picture stays on, and the music comes in on the next bar, softly.
7. The note. While Strudel plays, send set_sound with a closing mood: the note says Strudel is on, the picture only applied, and what a closing sound needs (strudel_mode on false first; silence with end fades Strudel and the picture). Then silence with end true: everything fades and "This session has ended." appears.
8. Regression. Silence with fade 6, then Strudel again: sound and picture come back. Ticking the box again after clearing it: silent and black. The synth: set_sound with a mood sounds normal and the picture follows.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
