# Test report: Sonorous Envelope v0.15.8

Tester: Claude, with Gael (owner) listening and operating the player.
Sessions: U9euWa0Bmc6Itf4bAed5oPxU (tests 3, 5, 6 and the rain end of test 1), -W03LTICJJnJEU5j0S2ywzCd (test 4), oKP_MqAO5Q0HTO9lN5QQtiJ9 (test 2: motes, then ripples). All on the external face, all ended.
Device: desktop Brave (owner). No phone, no private window (not in the brief).
Console errors: not checked (no console access in this run).

## Summary

All six tests pass on their main points. At a session end with Strudel playing, Strudel now fades over about the same time as the picture, and the session ends normally. One point remains and is known: the streaks, the rings and the motes still move or jump whenever a command arrives, even a command that does not change the visuals (Gael: they are redrawn each time). Gael says to leave this for the updated visuals.

## Results

| # | Test | Result |
|---|------|--------|
| 1 | End of a session with Strudel, rain | Pass (streaks still move, known) |
| 2 | Same with ripples and motes | Pass (rings and motes still jump, known); motes run was without the end |
| 3 | Silence in the middle | Pass |
| 4 | Strudel off | Pass |
| 5 | Code change | Pass (streaks jump on the colour change, known) |
| 6 | Regression | Pass |

### 1. End of a session with Strudel, rain: pass
- Strudel: stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)), bpm 90, scene rain, density 0.8, sync beat. Closing set_sound (calm 0.9, transition 8) while Strudel was still on, then silence with fade 12 and end true.
- set_sound note: "Strudel is on, so the mood, synth and voice were not used. Only the picture applied. Send strudel_mode with on false to go back to the synth (the synth under Strudel stays paused: a closing sound needs that first; silence with end fades Strudel and the picture)".
- silence note: "session ends: the fade starts in 1 s, when your last sound has finished its transition" and "Strudel stops with the fade; set_sound brings the synth back".
- Gael: "All good". Strudel faded with the picture and the session ended. "But there's still the streaks moving around. Not to be fixed this time" (see issue 1).

### 2. Ripples and motes: pass
- Motes (green, hue 160, density 0.8, bpm 90): to save a session I ran the closing set_sound (calm 0.9, transition 8) and then silence with fade 6, **without end true**. Gael: faded correctly. The motes jump whenever a command arrives, "even without changing the visuals, it basically redraws the effects".
- Ripples (orange, hue 40, density 0.8, bpm 90): full end (closing set_sound, then silence with fade 12 and end true). Gael: the same issue (the rings jumping), "most likely because they are being redrawn". The rest is ok.
- Not run: the motes with end true (done without end instead).

### 3. Silence in the middle: pass
- Strudel (rain) playing, silence with fade 6 (no end): Gael "all good" (music and picture faded together). Then Strudel again with the same code: picture and music came back ("all good").
- Gael's answer did not mention the streaks jump on arrival of the silence separately. His later comment says every command redraws the effects.

### 4. Strudel off: pass
- Strudel (rain, bpm 90) playing. Sent strudel_mode on false, closing set_sound (calm 0.9, transition 8, synth), then silence with fade 12 and end true.
- strudel_mode on false result: "back on the synth, where you left it: it fades in". set_sound: D# dorian, sine, tempo 75 to 56 over 8 s, about -27 dB. silence: "session ends: the fade starts in 7 s, when your last sound has finished its transition".
- Gael: "yep, all good". (No overlap of Strudel and the closing sound reported; everything faded at the end.)

### 5. Code change: pass
- New code while Strudel plays (TR808 drums and triangle bass, bpm 100), then a new colour with set_sound (hue 220 to 330, same scene rain).
- Music stayed in time after the colour change: yes (Gael).
- Streaks: they **jumped** on the colour change. Gael: "we keep the fix of this for the upgraded visuals".

### 6. Regression: pass
- Owner clears the box with rain on: streaks, background and sound fade together ("all good when clicking on the checkbox").
- Ticking the box again after clearing it: silent and black ("yep").
- Synth: set_sound with a mood (warmth 0.7, joy 0.6, calm 0.6): D dorian, sine, about -26 dB, tempo 75 to 91 over 4 s; sound normal and picture follows ("yep").

## Issues

1. **The scenes (streaks, rings, motes) jump or move on every command, also when the visuals do not change.** Seen with rain (end of session, colour change), ripples and motes. Gael: each command redraws the effects, so they jump. Known; the fix is kept for the updated visuals. The fades themselves are correct everywhere.
2. **Nothing else open.**

## Surprising or confusing

- Nothing confusing in the messages to the model. The set_sound note about the closing sound while Strudel plays is clear.
- Nothing too loud (slider kept at 0.8 on the first sessions, volume low enough for Gael).

## Not tested

- Phone and private window (not in the brief).
- Console errors (no console access in this run).
- Motes with the session end (run without end true, see test 2).
- iOS.
