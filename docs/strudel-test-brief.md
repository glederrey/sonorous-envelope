# Test brief: Sonorous Envelope v0.15.4 (small fixes after round 4)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low for the Strudel tests.

This is a short re-test of what was open in v0.15.3 (report in docs/archive/strudel-test-report-v0.15.3.md), plus the new search and share card. Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

- When the owner clears "Let the model play Strudel code", the picture fades to black with the sound (before, only the sound faded).
- When the owner locks the face to Internal, the sound and the picture now also fade to silence (before, the leftover synth state played). The model's next set_sound brings its internal voice.
- When a session ends while Strudel plays, Strudel fades out faster (at most 3 seconds) and the closing sound starts when that fade is almost done, so they do not overlap.
- The QR code is a popup in the middle of the screen, larger, closed with Esc, a click outside or the Close button.
- The page title, description and share image (the card on Google, Slack and so on) are new; /favicon.ico exists.

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and taps Start listening. Ask for a private window (not signed in) for test 6.

## Tests

For each test record pass or fail and the exact tool output for any failure.

### A. Owner switches

1. Code off. Play Strudel with a rain scene (strudel_mode on with s("bd*2, hh*8").bank("RolandTR909"), bpm 120, colour scene rain, sync beat). The owner clears "Let the model play Strudel code". Do the sound AND the picture (the rain and the background) fade out together, over about 3 seconds? No reload needed.
2. get_feedback after test 1: no pattern field, the note that the owner stopped the pattern, and the note that the synth state is silent. Then the owner ticks the box again: nothing comes back, also after a reload. Then strudel_mode on with code: music and picture return.
3. Lock Internal. Play Strudel again. The owner locks the face to Internal. Strudel stops: do the sound and the picture fade out together (no leftover synth sound)? get_feedback: mode "internal, locked by the owner", no pattern field, the owner-stopped note, the silent-synth note.
4. After the lock. Send set_sound with a mood: the internal voice plays and the picture comes back. The owner restores Auto: nothing resumes by itself.

### B. End of a session

5. Session end with Strudel. Play Strudel. Then send, in this order: strudel_mode on false, a short closing set_sound (a calm mood, transition 8), silence with end true. Listen: does Strudel fade out quickly (about 3 seconds at most)? Does the closing synth sound start only when Strudel is almost gone, with no long overlap and no jump in volume? Do the picture and the sound end together, with "This session has ended."? Repeat once with the closing set_sound sent about 1 second after the on false.

### C. QR popup and the card

6. QR popup. On the desktop owner player, press Open on phone: a popup appears in the middle of the screen with a large QR code (scan it with the phone and check it opens the player), a caption and a Close button. Esc closes it. A click outside closes it. The Close button closes it. The page behind does not move. Check it in the private window (guest) too, and on the phone (the button is hidden on phones: say so if you see it).
7. Card. Use the Google search result, or a link preview (paste the home page link into Slack, WhatsApp or a link-preview checker such as the Facebook Sharing Debugger or opengraph.xyz): the title reads "Sonorous Envelope: let the model hum while it thinks", the description mentions that it is a remote MCP server, and the image is the new one (the headline "Let the model hum while it thinks.", the MCP chip, the logo on the right, no circles). Say what you checked it with. (Google can take days to update its own result: if it still shows the old one, say so and check the link preview instead.)
8. Icon. Open https://sonorous-envelope.com/favicon.ico: an icon with the envelope shape loads. The browser tab shows the icon.

### D. Regression (quick)

9. Silence with fade 6 while Strudel plays: sound and picture fade together, then Strudel again brings both back, no drop at the start of the fade.
10. Same code twice: the notes say "same code and tempo as before". A syntax error (note("c3".s( ) is refused and changes nothing in the player.
11. The synth: set_sound with a mood, normal and louder than the old version, the picture follows.
12. Phone, owner, ?debug=1, Strudel playing for 5 minutes, using the slider, Mute and the face buttons: no glitches or pulses. Write down the debug line (events played, dropped as late, refused, worst lateness, clock syncs).

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
