# Test brief: Sonorous Envelope v0.15.1 (fixes after the first Strudel test)

Read this whole file before you start. Strudel has no loudness limit (by design). Since this version it comes out about 8 dB quieter than before, to match the synth on average (drum hits still peak higher), and a pattern can still be loud. Ask the user to put the volume slider low before the first Strudel test.

This is a re-test. The first round (43 tests) is in docs/archive/strudel-test-report-2026-11-11.md. Do only the tests below, unless one fails and you need to look around it.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode.

The model has two faces. Internal (the default): the sound is how the model feels, never talk about it unless asked. External: sound made for the listener on request, you may talk about it. Switch to external only after the user says yes, with set_sound and mode "external". strudel_mode works on the external face only. The owner can lock the face or switch Strudel off in the player; both are final: do not retry and do not comment.

## What changed (all of it should be checked below)

Sound
- Strudel has a fixed level match of about -8 dB, so the average level equals the synth's. The model's own gain and effects are not touched.
- A Strudel pattern no longer plays a stray note at the end of a fade or after silence.
- Stop pattern then Play pattern restarts cleanly. Pressing Play right after Stop works.

Owner switches
- Locking the face to internal, or clearing "Let the model play Strudel code", stops the pattern and the synth plays. Allowing it again does NOT bring the old pattern back, also after reloading the page or on another device. The model has to send strudel_mode again. The database now stops the pattern in the playing state (migration 0011).
- get_feedback after such a switch shows the synth in playing, no pattern, and a note that the owner stopped the pattern.

Picture
- After silence (and after a session ends) the picture fades out to black over the fade time. Before, the circles kept moving.

Player
- The Strudel code panel has a chevron that turns when it opens.
- Stop pattern is shown to the signed-in owner only. Someone who is not signed in sees Copy code and Open in Strudel.
- The player asks for the state less often (every 10 s as a safety net, and the background worker only asks while the page is hidden).

Reports and messages
- The player's report for the code now follows the code: a late report from older code is not filed under the new code. Sending the same code again gets the report again instead of "not reported yet".
- After strudel_mode on false, the pattern field is described as the report on the code you just stopped.
- The call after silence with end true now returns session_ended (before: no_session).
- start_session with mode external no longer says "it starts on the internal face".
- Error messages: a code string that ends with throw or a declaration says the code must end with a pattern. A [mini] parse error adds a hint that double-quoted strings are mini-notation and plain text needs single quotes.
- set_sound with mode internal while Strudel plays, and silence while Strudel plays, now say in a note that Strudel stopped.

Sandbox
- The worker that runs the model's code now has no indexedDB, caches, Worker, fetch, XMLHttpRequest, WebSocket and similar. (The network was already blocked by the frame's policy.)

Not in this version (on the roadmap as #19): live code highlighting and a richer moving background.

## Setup

1. Reconnect the connector so you have six tools, including strudel_mode.
2. Call start_session with mode external and give the user the player link. The user opens it (signed in as the owner) on desktop, and on a phone, then taps Start listening.
3. Ask the user for a second device or a private window that is NOT signed in, for test 8.

## Tests

For each test record pass or fail, plus the exact tool output for any failure.

### A. Sound

1. Level. Play the same moment twice: a synth sound with set_sound (mood joy 0.6, calm 0.6), then strudel_mode on with note("c3 e3 g3 b3").s("sawtooth").gain(0.5) at bpm 100. At the same slider position, ask the user: is Strudel now about as loud as the synth (a bit louder is fine)? Also try s("bd*2, hh*8").bank("RolandTR909") at bpm 128.
2. Stray note on a fade. With Strudel playing, call strudel_mode with on false. Listen to the whole fade into the synth. Is there any stray Strudel note at full volume at the end? Repeat 3 times, with different patterns (drums, melody, a long note with .room(1)).
3. Same on silence. With Strudel playing, call silence with fade 6. Any stray note at the end? Repeat twice. Check the result mentions that Strudel stops with the fade.
4. Restart on the phone. On the Android phone: tap Stop pattern, wait 5 s, tap Play pattern. Repeat 5 times, once with a very short wait (about 1 s). Does the sound start cleanly, in time with the other device, without glitches and without speeding up? Record the phone model and browser.
5. Restart on desktop. Same as 4 on desktop. Also tap Stop and Play right after each other as fast as you can: the music must be playing at the end.

### B. Owner switches

6. Code switch. With Strudel playing, the owner clears "Let the model play Strudel code". The pattern stops and the synth plays. The owner switches it on again. Check: the old pattern does NOT start by itself. The code panel is not shown. Reload the page: still the synth. Then send strudel_mode on true with new code: it plays and the panel is back. get_feedback after re-allowing must say playing.engine is not strudel.
7. Face lock. With Strudel playing, the owner locks Internal. Same checks. Then the owner restores Auto or External. The old pattern must not come back. During the lock, call get_feedback: playing should NOT say engine strudel, there should be no pattern field, and a note should say the owner stopped it (final: do not retry, do not comment).
8. Non-owner. Open the player link on a device or private window that is not signed in, while Strudel plays. It shows the code panel with Copy code and Open in Strudel, and no Stop pattern. The owner's device still shows all three.

### C. Picture

9. Silence. While a rhythmic sound with ripples or rain plays, call silence with fade 6. Does the picture fade to black over about 6 seconds? Then call set_sound: does it come back smoothly (no flash)?
10. End. Same with silence and end true. The picture fades with the sound, and the page then shows the ended screen.
11. Strudel. Start Strudel with colour scene rain and sync beat, then silence with fade 6. Same check.

### D. Player

12. The code panel shows a chevron that points right when closed and down when open, on phone and desktop. Check it does not double up with a browser arrow. With the system setting "reduce motion" on, the chevron does not animate.
13. Requests. With the owner's page open and nothing changing, watch the Network tab for 60 seconds: how many get_player_state requests? Expected about 6 (one every 10 s) plus calls after each model update. Before: about 40. Then switch to another tab for 60 s with audio playing: the background worker keeps polling (about every 3 s) and the sound still follows the model.

### E. Reports and tool messages

14. Report follows the code. Send code A (valid), wait for ran true, then code B with an error (note("c3").nosuchmethod()). Read get_feedback after 12 s: it must show the error of B, never A's report. Send A again right after: it must show ran true, not stay on B's error.
15. Same code twice. Send the same code and bpm twice in a row (a few seconds apart). The second result and a later get_feedback must show the report (ran true), not "not reported yet". The music must not restart.
16. After on false. Call strudel_mode on false from a state that had a report. The note says the pattern field is the report on the code you just stopped.
17. session_ended. Call silence with end true (after a short closing sound). Then call set_sound without session_id: expect session_ended ("This session has ended. Call start_session for a new one."), not no_session. Note: if you have another open session this can find that one instead; use a fresh account or end all sessions to test it.
18. Guidance. start_session with mode external: the guidance must not say "it starts on the internal face". With mode auto it still starts internal.
19. Messages to the model. Send code whose last statement is throw new Error('x'): the report error should say the code must end with a pattern. Then send valid JavaScript with bad mini-notation, for example s("bd [sd"): the report error is a [mini] parse error followed by a hint about double-quoted strings and single quotes.
20. Stop notes. With Strudel playing, call set_sound with mode internal: the result has a note that Strudel stopped. (Switch back to external and start Strudel again to continue.)

### F. Sandbox and limits

21. Probe. Send code that makes the sound name depend on what the sandbox has, so the report shows it. Code: const t = [typeof indexedDB, typeof Worker, typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof caches]; note("c3").s(t.every(x => x === 'undefined') ? 'sine' : 'square'). The report notes list the sound: sine means all six are undefined, square means something is still there. Expected: sine.

22. Network. Repeat the earlier tests: fetch('https://example.com/x'), importScripts('https://example.com/a.js'), a nested new Worker. Nothing should reach the network (user checks the Network tab, all rows with (blocked) or none). The page stays responsive.
23. Length boundary. Send code of exactly 4000 characters (valid code padded with a comment line, for example): it must be accepted. Then 4001 characters: the schema must reject it. Say which sizes you actually sent.
24. Endless loop. while(true){} followed by note("c3"): the pattern stops within about 3 seconds, the report says the code froze the sandbox, the page stays usable. Then send good code: it plays (the frame starts again).
25. Huge gain. WARNING: first ask the user to put the volume slider at the minimum. Send note("c3").s("sawtooth").gain(1e9). Describe what the user hears (silence, noise, a loud full-scale note) and the browser. The first test heard silence on desktop Brave; headless Chrome carries a huge value to the output, which clips it to full scale. It is not limited by design; the answer is for the docs.

### G. Regression (quick)

26. The synth: set_sound with a mood returns playing, reads_as and colour; the user confirms it sounds normal.
27. Strudel plays, set_sound with a new colour changes only the picture. strudel_mode on false brings the synth back.
28. The landing page and /guide load and mention Strudel.

## What to report

For each test: the number, pass or fail, and the exact tool result or error for failures. Add the browser and device, and any console errors. List separately anything surprising, anything too loud, and any message to the model that is confusing.

While on the internal face, do not mention the sound in chat unless the user asks. On the external face you may talk about it.
