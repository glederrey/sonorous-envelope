# Test report: Sonorous Envelope v0.15.6

Tester: Claude, with Gael (owner) listening and operating the player.
Session: 36BwQpM9OmcNrGH7MmwXeNb3 (external face, ended at the end of the run).
Devices: desktop Brave (owner, and a private window as guest); Android Nothing phone (4a), Chrome, as guest (test 5).
Console errors: not checked (no console access in this run).

## Summary

5 of 7 tests pass. Tests 3 and 4 fail on one point: the rain streaks still vanish at once when the owner locks Internal (test 3) or clears the Strudel box (test 4), while the sound and the background fade as they should. The streaks do fade correctly at a session end (test 6). The picture and music now start together (test 1) and the label is "Add to your AI" (test 5).

## Results

| # | Test | Result |
|---|------|--------|
| 1 | Picture with the music | Pass (3 runs), one observation |
| 2 | Strudel from the synth | Pass |
| 3 | Internal lock with a scene | **Fail** (streaks vanish at once) |
| 4 | Owner clears the box with a scene | **Fail** (same behaviour) |
| 5 | Label | Pass (desktop and phone, before and after Start listening) |
| 6 | Session end while Strudel plays | Pass |
| 7 | Regression | Pass |

### 1. Picture with the music: pass
- Code: stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)), colour scene rain, sync beat. Silence with fade 6 before each restart.
- Run 1 (bpm 90): picture and music started together on the same beat. Run 2 (bpm 130): same, both came back. Run 3 (new code, TR808 drums and triangle bass, bpm 100): same.
- Gael (all three runs): the picture has a quick fade-in, **Strudel has no fade-in** (it starts abruptly). Gael does not think it is a regression: earlier rounds were the same. Listed in the issues as an observation.

### 2. Strudel from the synth: pass
- Synth first: set_sound mood (warmth 0.7, joy 0.6, calm 0.6): G dorian, sine wave, loudness -26 dB, fade-in on the synth. Then strudel_mode on (bpm 90, rain). Gael: the picture stayed on (no black gap) and the music came in on the next bar. "All good".

### 3. Internal lock with a scene: fail
- Strudel playing with rain. The owner locks Internal. Gael: the music and the background fade, but **the streaks disappear immediately** (not over about 3 seconds).
- get_feedback: mode "internal, locked by the owner"; synth state volume 0; picture still "rain density 0.4 speed 0.4, sync beat"; note "the owner stopped your Strudel pattern (face locked or code off)... It is final".
- Restore Auto: nothing came back by itself (black screen, no audio): pass for that part.

### 4. Owner clears the box with a scene: fail
- Same set-up (after switching back to external, see surprises). Owner cleared "Let the model play Strudel code". Gael: "Same behaviour. Music and background fades, streaks immediately disappear".

### 5. Label: pass
- Private window, not signed in, before and after Start listening: first button "Add to your AI", "Copy link" next to it on one row, labels on one line. Same on the phone as a guest. Gael: "all good".

### 6. Session end while Strudel plays: pass
- Strudel on (bpm 90, rain). Sent a closing set_sound (calm mood, transition 8) while Strudel was still ON, then silence with fade 12 and end true.
- set_sound result: "Strudel is on, so the mood, synth and voice were not used. Only the picture applied."
- silence result: "session ends: the fade starts in 1 s, when your last sound has finished its transition".
- Gael: "All good, everything is fading correctly (streaks as well, not disappearing immediately)". The session ended.

### 7. Regression: pass
- Silence with fade 6, then Strudel again: picture and sound came back (runs 1 to 3 of test 1).
- Same code twice: notes "same code and tempo as before: the music does not change"; player report ran true, events_per_cycle 11, sounds bd, hh, sawtooth; the music kept playing (Gael).
- Synth: set_sound with a mood sounds normal, the picture follows (test 2).
- Ticking the box again after clearing it: silent and black (Gael: "all good").

## Issues

1. **Rain streaks vanish at once on the Internal lock and on the cleared box (tests 3 and 4).** The sound and the background fade, only the streaks disappear immediately. At the session end (test 6) the streaks fade correctly, so the fade for the streaks exists but is not used on these two paths.
2. **Strudel has no fade-in (observation).** After a silence, the picture fades in quickly but the music starts at full level on the bar. Not a regression (same in earlier rounds). The synth does fade in.

## Surprising or confusing

- After the owner locked Internal and then restored Auto, the session stayed on the internal face. strudel_mode returned the error: {"error":"internal_face","message":"Strudel is for the external face. Offer it in words; if the listener says yes, switch with set_sound mode external, then call this again."} I asked Gael, he said yes, and I switched with set_sound mode external. That worked but is easy to miss. Also, the switch to external brought the synth back at volume 0.5, together with the picture, until Strudel started.
- set_sound with a closing mood while Strudel is on: "Strudel is on, so the mood, synth and voice were not used. Only the picture applied." This is clear, but it means the closing sound of the brief's test 6 cannot play while Strudel is on (as in the design). It would help to say what will play at the end.
- Nothing too loud (volume slider kept low).

## Not tested

- Console errors (no console access in this run).
- The phone as owner (not part of the brief).
- iOS.
