# Test report: Sonorous Envelope v0.15.2

Tester: Claude, with Gael listening, watching and operating the player. Date: 2026-11-11, 20:45 to 21:45 (Europe/Zurich).
Devices: desktop Brave (owner and a private window as guest); Android Nothing phone (4a), Nothing OS 5.0, Chrome 157.0.8103.50.
Sessions used: mew-Z1eETO6FdI-oxJTvndwQ (tests 1 to 3), n54Lku54tQErkpim2s4SMjVZ (test 4), VdPO3CK0_JJnodXtEDEp_EDE (the rest).

## Summary

Most of the round passes: the synth is louder and matches Strudel, the whole picture now fades with silence and with the end of a session, polling is once per second with a tiny body, the owner-stopped note stays until new code, the messages to the model read well, and the Android phone is clean when nobody touches it.

Still open:
1. After a silence with Strudel playing, the picture does not come back when Strudel starts again (it stays black). It does come back through the synth.
2. At the start of a Strudel fade-out the volume drops abruptly, then the fade starts.
3. A late joiner after silence sees a faint dark-blue glow that fades to black after Start listening.
4. On desktop the bottom buttons wrap to two rows (owner: 3 buttons, guest: 2 buttons). They should always be on one line, full width.
5. Android: no pulses when the phone is left alone. Gael thinks the pulses come when he plays with the phone's controls. Returning to Chrome from another app gives a 0.5 s drop.

## Results

| # | Result | Notes |
|---|---|---|
| 1 | Pass | Circles and background fade to black together with the sound over about 6 s ("almost the same time as the sound, perfect"). |
| 2 | Pass | Picture fades back in smoothly after set_sound. No flash. |
| 3 | Pass | Fades to black with the sound, then "This session has ended." |
| 4 | Partial | No stray note (twice). Picture fades to black. But: the volume drops abruptly for a very short moment before the fade starts (seen twice, confirmed by Gael). And the picture does not come back when Strudel starts again in the same session (see issue 1). |
| 5 | Partial fail | A guest who joins after the silence sees a faint dark-blue glow, which fades to black after pressing Start listening. Expected: black at once. |
| 6 | Pass (body) | player_poll once per second. Response body is {"v": "...", "now": "...", "same": true}, about 100 bytes (pretty printed). The Network tab shows about 1.1 kB per request, so the rest is headers. |
| 7 | Pass | Synth change: about 1 s until heard and seen. Strudel change: about 1 s. |
| 8 | Pass (music) | The music followed the new code while the tab was hidden. The picture only changed when Gael returned to the tab (expected). The Network rate of the hidden tab was not recorded. |
| 9 | Not tested | Could not see the phone's requests. |
| 10 | Not run as written | See 11 to 13. |
| 11 | Pass (3 min) | Phone as the only owner player (reloaded signed in). Clean when left alone. Debug: 3260 events played, 0 dropped as late, 0 refused, worst lateness 0 ms, 56 clock syncs. Shortened from 10 min to 3 min. |
| 12 | Pass (about 2 min) | Phone plus desktop, both owner. No issues when left alone. Stopped early by Gael. |
| 13 | Pass (10 min) | Phone as a guest, 21:17:46 to 21:28. Clean. 9239 events, 0 late, 0 refused, worst lateness 30 ms, 182 clock syncs. At about 2 minutes Gael heard some slowing down and catching up (46 clock syncs by then, about one every 3 s). |
| 14 | Pass with a dip | Closing Chrome and reopening: the sound drops for 0.5 s, then restarts normally by itself. |
| 15 | Pass | Locking the screen (from Chrome, or with Chrome away): no drops. Coming back to Chrome from another app: a 0.5 s drop. Debug after return: 4122 events, 0 late, 0 refused, worst lateness 183 ms, 71 clock syncs, "ticks with audio stopped: 2", keep-alive file paused and played several times, audio session type not supported. |
| 16 | Pass | get_feedback after clearing the checkbox: no engine strudel, no pattern field, note says the owner stopped the pattern (final). Synth state was not silent, so no "silent" note. |
| 17 | Pass | After ticking the box again and after a reload: still the synth, the note stays. |
| 18 | Pass | New code plays, next get_feedback has no "owner stopped" note. |
| 19 | Pass | Face locked to Internal: same result, mode shows "internal, locked by the owner". After restoring Auto the old pattern did not return and the note stayed. |
| 20 | Pass | Same slider: Strudel and the synth are about equally loud. Gael: "similar, good". |
| 21 | Pass (partly) | calm 0, tension 0.8, spontaneity 1 at slider 0.8: not too loud, not distorted. Slider 50 and 100 were skipped. |
| 22 | Done | gain(1e9): slider 0.01 silence; 0.02 a very loud note; at 100 the same level as at 0.02 (clipped to full scale). Desktop Brave. Not limited by design: for the docs. |
| 23 | Pass | Owner desktop: title "Strudel code" without tempo or icon, same triangle as the other panels, turns open, no Stop pattern. Guest: no problem reported apart from issue 4. |
| 24 | Fail (desktop) | Desktop owner: Add it to your AI app, Copy link and Open on phone wrap to two rows (Open on phone half width on row two). Guest: Add it to your AI app and Copy link also on two rows. Phone: Copy link alone fills the width (passes, no QR as expected). |
| 25 | Pass | Checkbox is teal when ticked (dark theme). Light theme not checked. |
| 26 | Not tested | Too many sessions to get a page that does not scroll. Gael sees the same footer issue on the Safety page and will check it there after the fix. |
| 27 | Pass | Note says "pattern is the player's report on the code you replaced". |
| 28 | Pass | Note says "the code you just stopped, not on the synth". |
| 29 | Pass | ran: "not reported yet", why mentions pressing Start listening. |
| 30 | Pass | B shows "note(...).nosuchmethod is not a function"; sending A again shows ran true. |
| 31 | Pass | Synth sounds normal and louder than before. |
| 32 | Pass | Colour change while Strudel plays changes only the picture; on false brings the synth back. |
| 33 | Pass | set_sound without session_id: {"error":"session_ended","message":"This session has ended. Call start_session for a new one."} |
| 34 | Pass | note("c3".s( : {"error":"syntax_error","message":"The code was not saved: syntax error: Unexpected token (line 1, column 13). Fix it and send it again."} The saved code stayed the previous one. |

## Issues for Claude Code

1. **Picture does not return when Strudel starts after silence.** After silence (fade 6) with Strudel playing, the screen goes black as intended. When I send strudel_mode on again (same code, new code, or new colour), the sound comes back (it fades in) but the picture stays black. The server reports Strudel playing and the pattern as ran true. Calling strudel_mode on false and then set_sound brings the picture back with the synth. Seen on the first session and again on a new one.
2. **Abrupt volume drop at the start of a Strudel silence fade.** The sound drops by a short moment before the fade-out begins. Seen twice. No stray note this time.
3. **Late joiner sees a glow.** Joining after the silence has finished: the pre-listening background is a dark-blue glow, then it fades to black after Start listening. It should show black at once.
4. **Bottom buttons on desktop.** All buttons (3 for the owner, 2 for a guest) should sit on one line at the full width, whatever their number. Today they wrap.
5. **Footer line.** Not tested on the sessions list. The same strip issue shows on the Safety page: check it there.
6. **Polling size.** The body is tiny, but each request still transfers about 1.1 kB. Compact JSON and fewer headers (cookies, CSP, etc. on this endpoint) would get closer to the 60 bytes you expected.
7. **Android.** Left alone, the phone has been clean in all runs (10 min guest, 3 min owner, 2 min with two owners). Gael's observation: the glitches and pulses seem to come when he plays with the phone's controls (slider, mute, Face buttons). Please check what the control changes cause (state refresh, a second clock sync, a re-schedule). There is a 0.5 s drop when coming back to Chrome from another app, and after closing and reopening Chrome. Gael accepts that if it is the price of avoiding the pulses. The debug line is useful; please keep it.
8. **After the owner stops the pattern.** Gael suggests that when the owner clears the Strudel switch, the sound should fade to silence and the picture to black, instead of playing the leftover synth state (mine was a tense, busy sound). For the Internal lock the synth can stay, but fade it in gently. More generally: whenever the sound ends, the picture should fade to black with it.
9. **Unclear observation.** After a refused syntax-error call (test 34) the music went quiet while the picture stayed up, although get_feedback still showed Strudel playing with the old code. It may have been the on:false I sent seconds later. Please check that a refused call changes nothing in the player.

## Messages to the model that could be clearer

- Resending the same code says "pattern is the player's report on the code you replaced", which is odd when the code is identical.
- strudel_mode on false says "back on the synth, where you left it: it fades in" even when the synth state is silent (volume 0). Nothing fades in then. A note like "the synth state is silent" would help (the brief says get_feedback does this after an owner stop, but not after on false).
- `players` still showed 2 after the owner closed the player tab (one was the private window; the closed tab may not have timed out).

## Too loud

Nothing was too loud at the slider Gael uses (0.8). The huge gain (test 22) is loud at 0.02 and clips to full scale.

## Other

- The connector asked for a new sign-in at about 20:55 (during the test 4 retry). The session survived. Known loose end.
- Gael asks (earlier round) for the background gradient to move and change over several colours: still on the roadmap (#19).

## Not tested

Test 9 (phone requests), test 26 (footer on a page that does not scroll), the Network rate of the hidden tab (test 8), the slider at 50 and at 100 (test 21), the light theme for the checkbox, a full 10-minute run with the phone as owner (3 minutes done), iOS Safari.
