# Test brief: Sonorous Envelope v0.15.3 (small fixes after round 3)

Read this whole file before you start. Strudel has no loudness limit (by design): ask the user to keep the volume slider low for the Strudel tests.

This is a short re-test of what failed or was open in v0.15.2 (report in docs/archive/strudel-test-report-v0.15.2.md). Run only these tests, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. The model has two faces: internal (the default, never talk about the sound unless asked) and external (sound for the listener on request; switch only after the user says yes, with set_sound mode external). strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed

- The picture comes back when Strudel starts after a silence.
- No drop at the start of a Strudel fade-out.
- A listener who joins after a silence sees black at once.
- The buttons under the player are always on one row.
- When the owner turns Strudel off, the sound and the picture fade out (the synth state is not played). When the owner locks Internal, the synth stays and comes in gently.
- The same code sent twice says so in the notes. strudel_mode on false onto a silent synth says that nothing fades in.
- The footer line is meant to reach the right edge on the Safety page and the sessions list (it could not be checked by the developer).
- Android: the worker looks further ahead and the slider saves its value less often, to help with the glitches when the phone's controls are used.

## Setup

Reconnect the connector (six tools including strudel_mode). start_session with mode external, give the player link. The user opens it as the owner on desktop and, for tests 9 to 11, on the Android phone, and taps Start listening. Ask for a private window (not signed in) for test 3.

## Tests

For each test record pass or fail and the exact tool output for any failure.

### A. Picture and sound

1. Strudel after silence. Play Strudel (s("bd*2, hh*8").bank("RolandTR909") at bpm 120, colour scene rain, sync beat). Call silence with fade 6. When it is black and silent, call strudel_mode on again (same code, then new code, then only a new colour). Does the picture come back each time, together with the sound? Also when the code is the same as before.
2. Fade start. Play a steady Strudel sound (note("c2 c2").s("sawtooth").lpf(400).legato(1).gain(.6), bpm 100), then silence with fade 6, three times. Listen to the first two seconds of the fade: is there any sudden drop before the fade starts? Any stray note at the end?
3. Late joiner. After a silence has finished, open the player in a private window. Before pressing Start listening the page must be black, with no blue glow, and nothing fading after Start.
4. Owner turns Strudel off. With Strudel playing, the owner clears "Let the model play Strudel code". The sound should fade out over about 3 seconds and the picture to black, with no synth sound. Then call get_feedback: no pattern field, a note that the owner stopped the pattern, and a note that the synth state is silent (volume 0).
5. Allowed again. The owner ticks the box again: still silent and black, and the old pattern must not come back, also after a reload. Then send strudel_mode on with code: music and picture return.
6. Internal lock. With Strudel playing, the owner locks the face to Internal. Strudel stops and the synth comes in gently (over about 6 seconds), the picture stays. get_feedback shows the owner-stopped note. Restore Auto: nothing resumes by itself.

### B. Player layout

7. Bottom buttons, desktop. Whatever buttons are shown (last time: three for the owner, two for a guest) sit on ONE row at the full width, each the same width. Check with the window at 1400 px and at about 800 px wide. The QR code, when opened, appears below, full width.
8. Bottom buttons, phone. Copy link alone fills the width (owner); Add it to your AI app and Copy link on one row (guest).
9. Footer line. On the Safety page and on the sessions list (desktop, classic scrollbar, a page that does not scroll if you can find one, otherwise the Safety page): does the line above the footer reach the right edge of the window? Take a screenshot. Also check the guide page (which scrolls) and the player page for a double or odd line.

### C. Android

10. Phone, owner, ?debug=1, Strudel playing with drums and melody for 10 minutes. This time use the phone's controls on purpose: move the volume slider back and forth many times, press Mute and unmute, press the face buttons (Auto, Internal, External) and the code switch. Does the sound glitch or pulse when the controls are used? Note which control, and write down the debug line (events played, dropped as late, refused, worst lateness, clock syncs) before and after.
11. Same without touching anything for 5 minutes, as a baseline, then returning to Chrome from another app: still a 0.5 s drop?

### D. Messages to the model

12. Send the same code and bpm twice in a row: the second result says same code and tempo as before, and does not say "the code you replaced".
13. After silence, send strudel_mode on false (with Strudel on): the note says the synth state is silent and nothing fades in. After a normal synth state, on false still says "where you left it: it fades in".
14. Refused call. While Strudel plays, send code with a syntax error (note("c3".s( ). The player must not change at all (the music and the picture go on). Then check get_feedback shows the old code still playing.

### E. Regression (quick)

15. The synth: set_sound with a mood, normal and louder than before; the picture follows.
16. Silence then end: picture and sound fade, "This session has ended."
17. The polling: the Network tab still shows one player_poll per second with a tiny body.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing. Not tested: say so, and why.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
