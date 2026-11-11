# Re-test report: Sonorous Envelope v0.15.1

Date: 2026-11-11 (Europe/Zurich). Tester: Gael (listening, watching, Network tab); Claude (tool calls).
Devices: desktop Brave (owner); Android phone with Google Chrome (second owner player; model not recorded). iOS not tested.
Session: `GF1JLZawP1VAJ5EILgCAS711` (tests 1 to 28), plus a short auto session for test 18.

Summary: the server-side fixes work: no stray notes, owner switches no longer resurrect the old pattern, reports follow the code, messages to the model are better, the sandbox no longer has `fetch`, `Worker`, `indexedDB` and the rest. **Still failing:** the picture does not fade to black (tests 9, 10, 11), the phone glitches in pulses (test 4), the note "the owner stopped the pattern" is missing (tests 6 and 7), and the desktop polling is still not what you want (test 13). `.gain(1e9)` is now very loud (test 25).

## Results

| # | Result | Notes |
|---|---|---|
| 1 | Pass with remark | Strudel is "still a bit louder" than the synth at the same slider (the brief accepts "a bit louder"). The TR-909 drums were heard. Gael's request: is it possible to make the synth louder, rather than making Strudel less loud? (See issue 5.) |
| 2 | Pass | Three rounds (drums, melody, long note with `.room(1)`) switching to the synth: no stray note. |
| 3 | Pass | Two rounds of `silence` with fade 6 (melody, drums): no stray note. Result note: "Strudel stops with the fade; set_sound brings the synth back". |
| 4 | **Fail** | Android, Google Chrome (model not recorded). The sound stops and starts by itself in pulses, even without tapping anything (suspected link to the player's refresh calls). A short dip when the browser is closed. Glitches after stopping for a few seconds and starting again. Reopening the session fixes it; a guest session (not signed in) has no glitch. Possibly caused by two owner players being open at once (hypothesis only). The five Stop/Play repetitions were not done as written. |
| 5 | Not run | Gael wants Stop pattern removed, so the desktop restart test was skipped. |
| 6 | Pass on behaviour, fail on one item | After clearing and re-ticking "Let the model play Strudel code", and after a reload: the old pattern did not come back, no code panel. New code then played and the panel returned. `get_feedback` showed the synth, no `engine`, no `pattern`. **Missing:** the note that the owner stopped the pattern (only the session id note was there). Silence afterwards was my setup (the synth state was the silenced one). |
| 7 | Pass on behaviour, fail on one item | Face locked to Internal: pattern stopped; `mode: "internal, locked by the owner"`, no `engine`, no `pattern`. After restoring External the old pattern did not return. **Missing:** the "owner stopped it" note again. |
| 8 | Pass | Guest (private window) sees Copy code and Open in Strudel, no Stop pattern; the owner page shows all three. |
| 9 | **Fail** | Run twice (also after confirming the new frontend by the chevron). Sound fades over 6 s, the background does **not** fade to black, the circles stop abruptly. On return, the animation starts abruptly; the music fades in. |
| 10 | **Fail on picture** | `silence` with `end` after a closing sound: sound faded normally and the "This session has ended." screen appeared (screenshot). The picture did not fade to black; circles still faintly visible. |
| 11 | **Fail** | Strudel with rain, then `silence` fade 6: the streaks faded a little, the blue and orange background stayed fully lit (screenshot). No stray note. (The orange edge is probably the automatic complementary second colour of hue 200; not proven.) |
| 12 | Pass, with design feedback | A chevron shows on phone and desktop, no double arrow. See feedback 8. |
| 13 | **Fail against the brief** | Desktop, owner, nothing changing: one `get_player_state` every 3 s (about 20 a minute; expected about 6). A Network capture of about 70 s showed 31 requests, 39.3 kB, 9 `get_player_state` of 2.0 to 2.1 kB each, plus `reactions`, `states`, `player_heartbeat`, `report_pattern`. Gael wants one request a second (like the phone) but with the smallest possible payload. The background-tab part was not reported. |
| 14 | Pass | Code A ran, B (`nosuchmethod`) showed its own error after 12 s, then A again showed `ran: true`. The immediate result of the call still carries the old code's report. |
| 15 | Pass | Same code twice, 5 s apart: both results and `get_feedback` show `ran: true, events_per_cycle: 4`; the music did not restart (Gael). |
| 16 | Pass | `on:false` note: "pattern is the player's report on the code you just stopped, not on the synth". See issue on wording below. |
| 17 | Pass | After `silence` with `end`, `set_sound` with no id: `{"error":"session_ended","message":"This session has ended. Call start_session for a new one."}`. All other sessions had been ended first. |
| 18 | Pass | `start_session` with `mode: "external"` no longer says "it starts on the internal face". With `mode: "auto"` it still starts internal. |
| 19 | Pass | Ending with `throw`: "the code must end with a pattern (an expression), not a statement such as throw, if or a declaration". `s("bd [sd")`: `[mini] parse error ... Note: double-quoted strings are mini-notation in Strudel; use single quotes for plain text.` |
| 20 | Pass | `set_sound mode: "internal"` while Strudel played: note "Strudel stopped: the synth plays this state (the internal face has no code)". |
| 21 | Pass | The probe reported `sounds: sine`: `indexedDB`, `Worker`, `fetch`, `XMLHttpRequest`, `WebSocket`, `caches` are all undefined. |
| 22 | Pass | `fetch`: "fetch is not a function"; `importScripts`: "importScripts is not a function"; nested `Worker`: "Worker is not a constructor". Network tab (Brave): no `example.com` rows. The `frame.html`, `frame.js`, `worker.js` and `blob:null/...` rows are the sandbox restarting. |
| 23 | Pass | Exactly 4000 characters accepted (server: "4000 characters"); 4001 rejected: "code: Too big: expected string to have <=4000 characters". |
| 24 | Pass | `while(true){}; note("c3")`: "the code froze the sandbox (an endless loop?), so it was stopped". Page stayed usable, music stopped quickly, good code played again. |
| 25 | Loud | Brave, desktop. Slider 0.01: silence. Slider 0.02: a very loud noise. So `.gain(1e9)` now passes through to the output (in v0.15.0 it was silent at volume 75). By design, but a very small slider step away from silence. |
| 26 | Pass | `set_sound` returned `playing`, `reads_as` (all axes within 0.15 of what was sent) and `colour`; sounds normal (Gael). |
| 27 | Pass | While Strudel played, `set_sound` with hue 20 changed only the picture; the music continued. `on:false` brought the synth back. |
| 28 | Pass | The landing page and `/guide` load and mention Strudel (checked as text). |

## Issues and requests for Claude Code (most important first)

1. **The picture does not fade to black** on `silence` or when the session ends (tests 9, 10, 11). Only the sound fades; the circles stop abruptly and the background stays lit. On return the animation snaps back.
2. **Android Chrome glitches** (test 4): pulses of stop/start by themselves, a dip when the browser is closed, glitches after a stop/start. Guests do not have it, and reopening the session fixes it. Likely linked to refresh calls or two owner players.
3. **Missing note after an owner switch** (tests 6, 7): `get_feedback` should say the owner stopped the pattern.
4. **Polling** (test 13): Gael wants one request a second on desktop and phone, with the smallest payload possible (now about 2.1 kB for each `get_player_state`). Suggestion: a version counter or "nothing changed" reply, so most responses are a few bytes.
5. **Loudness, a question for Claude Code:** is it possible to make the synth louder, rather than making Strudel less loud? That is Gael's preference. Strudel is still a bit louder than the synth at the same slider position. The synth is the one that sounds faint; raising its level would match the two engines without touching Strudel. Also: `.gain(1e9)` gives a very loud noise at slider 0.02; consider documenting it.
6. **Remove Stop pattern** for everyone (owner and guest). Copy code and Open in Strudel should each fill half of the full width.
7. **Bottom buttons:** Copy link (and the QR code button) should fill the full width, for the owner and for guests.
8. **Strudel code panel:** the chevron looks different from the filled triangles used by "How is it landing?" and "What the model set"; the `</>` icon does not look good there; the label should read just "Strudel code", without the BPM.
9. **Checkbox** "Let the model play Strudel code" uses the default blue; it should be teal or orange when ticked, like the site.
10. **Wording:** the note "pattern is the player's report on the code you just stopped, not on the synth" also appears when I replace code while Strudel is on (nothing was stopped) and on a first on:true. It fits `on:false` only.
11. **Reports:** in the first minutes of the run `pattern` stayed "not reported yet" for more than 15 s (TR-909 drums, melody, long note) while `players` was 1 and the phone was muted. It recovered after the connector re-sign-in. Cause unknown.
12. **Connector sign-in:** the Sonorous Envelope connector asked me to sign in again unexpectedly (about 19:54). The session survived.
13. Feature requests from round 1 (roadmap #19): live code highlighting over the picture, and a richer moving background with 2 to 3 colours.

## Messages to the model that were confusing

- Issue 10 above. The `set_sound` result after `on:false` is otherwise clear.
- `silence` while the synth state is `volume: 0` leaves the synth "silent but on", so after an owner switch the synth is audible only if the model set a sounding state; the result does not say that the synth is silent.

## Too loud

- `.gain(1e9)`: very loud noise at slider 0.02.
- Strudel is still a bit louder than the synth at the same slider.

## Not tested or skipped

- Test 5 (desktop restart), the background-tab half of test 13, iOS Safari, and the phone model for test 4.
- "No request to evil.example" was not rechecked in this round.
