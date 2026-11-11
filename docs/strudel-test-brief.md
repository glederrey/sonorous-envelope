# Test brief: Sonorous Envelope v0.15.2 (second round of fixes)

Read this whole file before you start. Strudel has no loudness limit (by design). This version makes the synth louder (about +8 dB) instead of making Strudel quieter, so ask the user to put the volume slider low before the first test, and to raise it slowly.

This is a re-test of the failures of v0.15.1. The report of that round is in docs/archive/strudel-test-report-v0.15.1.md. Run only the tests below, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode.

The model has two faces. Internal (the default): the sound is how the model feels, never talk about it unless asked. External: sound made for the listener on request, you may talk about it. Switch to external only after the user says yes, with set_sound and mode "external". strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

Picture
- After silence and after a session ends, the WHOLE picture fades to black with the sound: the circles and the background. It fades over the fade time you asked for. Before, only the circles faded, and abruptly.
- When a new sound comes after silence, the picture fades back in.

Polling
- The player asks the server for news every second, on desktop and phone. When nothing changed, the answer is a few bytes (about 60), not 2 kB. A change (a new sound, an owner switch) shows up within about a second.

Android
- A late event is now dropped only when it is more than half a second late (before: 150 ms, which on a slow phone dropped events in bursts and may have caused the stop and start pulses). The debug line (?debug=1 at the end of the player link) now shows what the page did with the events.

Owner switches
- get_feedback says the owner stopped the pattern, also after the owner allowed Strudel again, until you send something new. If the synth state is silent (volume 0) the note says so.

Loudness
- The synth is about +8 dB louder. Strudel is untouched (the -8 dB trim of v0.15.1 is gone).

Player
- There is no Stop pattern button for anyone. Copy code and Open in Strudel take half the width each.
- The Strudel code panel is titled "Strudel code" (no tempo, no icon) and has the same small triangle as "How is it landing?" and "What the model set".
- The checkbox "Let the model play Strudel code" uses the site's teal.
- The buttons under the player (Copy link, Open on phone, Add it to your AI app) fill the full width, for the owner and for a guest.
- The line above the footer reaches the right edge of the window on pages that reserve space for a scrollbar (for example the sessions list).

Messages to the model
- The note about the pattern's report says "the code you replaced" when you send new code while Strudel plays, and "the code you just stopped" only on on false.
- When a report is "not reported yet", the explanation says that an owner's player must be open with Start listening pressed.

## Setup

1. Reconnect the connector so you have six tools, including strudel_mode. (If it asks you to sign in again, note the time: it is a known loose end.)
2. Call start_session with mode external and give the user the player link. The user opens it signed in as the owner on desktop and on a phone, and taps Start listening on both.
3. Ask the user for a private window that is NOT signed in, for the guest checks.

## Tests

For each test record pass or fail, plus the exact tool output for any failure.

### A. Picture

1. Silence. Play a rhythmic synth sound (set_sound, tempo about 100, colour scene ripples, motion pulse). Then silence with fade 6. Ask the user to watch: do the circles AND the background fade to black over about 6 seconds, without a sudden stop? Record when it is fully black.
2. Back from silence. Then set_sound with a normal mood. Does the picture fade back in smoothly, without a flash and without a sudden start?
3. End. Play a closing sound, then silence with end true. The picture fades to black with the sound, and the page then shows "This session has ended."
4. Strudel. strudel_mode on with s("bd*2, hh*8").bank("RolandTR909") at bpm 120 and colour scene rain, sync beat. Then silence with fade 6. Same check as test 1. The blue and orange background must go dark too.
5. Join late. Open the player on another device AFTER the silence has finished: it should show black at once, not fade in.

### B. Polling

6. Desktop owner, nothing changing. Open the Network tab, filter on player_poll, watch for 60 seconds. Expected: about 60 requests, almost all with a tiny response body (about 60 bytes: open one in the Response tab and check it contains same:true), against about 2 kB for the full state. Record the number and the sizes.
7. A change arrives fast. Call set_sound with a clearly different mood. How long until the user hears it and sees the colour change? Expected: about a second or less. Repeat with strudel_mode on and a new pattern.
8. Background tab. Switch to another tab for 60 seconds while Strudel plays, then call strudel_mode with new code. Does the music follow while the tab is hidden (within a few seconds)? Record what the Network tab shows for the player_poll requests of that tab.
9. Phone. Same as 6 on the phone if you can see its requests (remote debugging), otherwise say you could not.

### C. Android (the open problem)

10. On the Android phone (record the model and the browser version), with the owner signed in, open the player with ?debug=1 added to the link, press Start listening, play a Strudel pattern with drums and a melody, and let it run for 10 minutes with the screen on. Does the sound stop and start by itself in pulses? Ask the user to rate it: clean, a few glitches, or pulsing. Write down the Strudel line shown in the debug area (events played, dropped as late, refused, worst lateness, clock syncs).
11. Same, but with the desktop player closed, so that the phone is the only open player.
12. Same, but with the desktop owner player open too (two owner players).
13. Same, but the phone opens the link in a private tab, not signed in (a guest). Compare with 10.
14. Close the browser on the phone while Strudel plays and reopen the link. Is there a dip or a glitch? Does it recover by itself?
15. Lock the screen for 2 minutes, then unlock. Does it keep playing? Any glitch on return?

### D. Owner switches and get_feedback

16. Code off. With Strudel playing, the owner clears "Let the model play Strudel code". The pattern stops, the synth state plays. Call get_feedback: playing.engine is not strudel, no pattern field, and a note says the owner stopped your Strudel pattern (final). If the synth state is silent, the note also says so.
17. Allowed again. The owner ticks the box again. Call get_feedback again: the note about the owner stopping the pattern must still be there, the old pattern must not come back, also after a reload of the player.
18. New code. Call strudel_mode on with new code: it plays, and the next get_feedback has no "owner stopped" note.
19. Face lock. Same as 16 and 17 with the face locked to Internal and then restored to External.

### E. Loudness

20. Same slider, two engines. At the same slider position, play a synth sound (joy 0.6, calm 0.6), then a Strudel pattern with drums, bass and melody (stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6), note("c4 e4 g4 b4").s("triangle").room(.4)) at bpm 110). Ask the user: are they about as loud now? Is the synth too loud or distorted?
21. Loud synth moods. Play a synth sound with calm 0 and tension 0.8 and spontaneity 1, at the slider position the user normally uses. Is it too loud or distorted? (The slider can go up to +18 dB: try with the slider at 50 and at 100 only if the user agrees.)
22. Huge gain. WARNING: first ask the user to put the volume slider at the minimum. Send note("c3").s("sawtooth").gain(1e9). Describe what the user hears at slider 0.01 and 0.02, and the browser. This is not limited by design; the answer is for the docs.

### F. Player layout (desktop and phone, owner and guest)

23. Strudel panel. The title is "Strudel code" with no tempo and no icon. It has the same small triangle as "How is it landing?" and "What the model set" (check the three look alike), the triangle turns when open. Copy code and Open in Strudel each take half the width. There is no Stop pattern button, for the owner and for the guest.
24. Bottom buttons. Under the player, Copy link and Open on phone fill the whole width for the owner; for a guest, Add it to your AI app and Copy link fill the whole width. On a phone, Copy link alone fills the width. Open on phone shows the QR code below, full width.
25. Checkbox. "Let the model play Strudel code" is teal when ticked, in the dark and light theme.
26. Footer line. Open the sessions list on a desktop browser that shows a classic scrollbar, with few sessions so that the page does not scroll. The line above the footer reaches the right edge of the window. Also check it on a page that scrolls (the guide) and on the player page: nothing odd, no double line.

### G. Messages to the model

27. Replace code. While Strudel plays, send new code with strudel_mode on true. The result's notes say the pattern field is the report on the code you replaced.
28. Stop. Send strudel_mode on false. The note says the pattern field is the report on the code you just stopped.
29. Not reported yet. Close the owner's player (or do not press Start listening) and send strudel_mode on true with valid code. get_feedback shows ran "not reported yet" with an explanation that mentions Start listening.
30. Reports follow the code. Send code A (valid), then B (note("c3").nosuchmethod()), read get_feedback after 12 s: B's error. Then A again: ran true.

### H. Regression (quick)

31. The synth: set_sound with a mood returns playing, reads_as and colour; the user confirms it sounds normal (and louder than before).
32. Strudel starts, set_sound with a new colour changes only the picture, strudel_mode on false brings the synth back.
33. session_ended: end a session with silence and end true, end all other sessions, then call set_sound without session_id: session_ended.
34. Syntax error: note("c3".s( is refused with the line and column and nothing is saved.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
