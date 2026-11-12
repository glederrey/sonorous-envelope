# Test brief: Sonorous Envelope v0.15.5 (last small fixes)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low.

This is a short re-test of what was open in v0.15.4 (report in docs/archive/strudel-test-report-v0.15.4.md). Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

- When the owner ticks "Let the model play Strudel code" again after clearing it, nothing plays: silence and a black picture until the model sends something. (Before, a slow synth started.)
- Before pressing Start listening, the box at the bottom has the sentence in small type on top and the two buttons on one row at the full width.
- The button "Open on phone" is now called "QR code" (in the guest and owner views). Labels stay on one line.
- When a session has ended, the link box at the bottom is gone.

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and taps Start listening. Ask for a private window (not signed in) for tests 3 and 4.

## Tests

For each test record pass or fail and the exact tool output for any failure.

1. Ticking the box again. Play Strudel (strudel_mode on, s("bd*2, hh*8").bank("RolandTR909"), bpm 120, colour scene rain). The owner clears "Let the model play Strudel code": sound and picture fade out. The owner ticks it again. Listen for 15 seconds: no sound at all, and the picture stays black. Then reload the page: still silent and black. Then send strudel_mode on with code: music and picture come back.
2. Same with the Internal lock. Play Strudel, the owner locks Internal (fade to silence), then restores Auto, then (if shown) External. No sound comes back by itself. Then set_sound with a mood: the internal voice plays.
3. Guest before listening. In the private window, open the player link (do not press Start listening). The box at the bottom has a small sentence, and "Add it to your AI app" and "Copy link" side by side on ONE row at the full width, with the labels on one line. Check at about 1300 px and 800 px wide, and on the phone.
4. Guest after listening and owner controls. Press Start listening. At about 800 px wide, the buttons under the player sit on one row with the labels on one line ("Add it to your AI app", "Copy link", "QR code"), for the guest and for the owner (the owner has Copy link and QR code). The QR code popup still opens and closes (Esc, click outside, Close).
5. Ended session. End a session (a short closing set_sound, then silence with end true). The page says "This session has ended." and shows NO link box and no Copy link button, in the owner's browser and in the private window.
6. Regression. Silence with fade 6 while Strudel plays, then Strudel again: sound and picture fade together and come back. Same code twice: the notes say "same code and tempo as before". The synth: set_sound with a mood sounds normal and the picture follows. A session end with Strudel playing (on false, a closing set_sound, silence with end true) still fades quickly with no overlap.
7. Phone. On the Android phone as owner with ?debug=1, Strudel playing, use the slider, Mute and the face buttons for a few minutes: no glitches or pulses. Write down the debug line.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
