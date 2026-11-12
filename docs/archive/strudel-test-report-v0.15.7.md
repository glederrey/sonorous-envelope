# Test report: Sonorous Envelope v0.15.7

Tester: Claude, with Gael (owner) listening and operating the player.
Session: jt2jN9a-VIe_OQjf1fsxEnPK (external face, ended at the end of the run).
Device: desktop Brave (owner). No phone, no private window in this round (not in the brief).
Console errors: not checked (no console access in this run).

## Summary

All eight tests pass on their main points. The streaks (rain, ripples, motes) now fade with the sound and the background on the Internal lock and on the cleared box. Strudel fades in softly from silence, picture and music start together, and the note for the closing sound is clear. One new issue at the session end with Strudel playing: Strudel fades out faster than the picture, and the streaks restart (as if replayed) when the fade begins.

## Results

| # | Test | Result |
|---|------|--------|
| 1 | Clear the box with rain | Pass |
| 2 | Internal lock with rain | Pass |
| 3 | Same with ripples and motes | Pass |
| 4 | Strudel fade-in | Pass (3 runs) |
| 5 | New code on a playing pattern | Pass |
| 6 | Start from the synth | Pass |
| 7 | The note | Note passes; end of session: two visual/audio issues |
| 8 | Regression | Pass |

### 1. Clear the box with rain: pass
- Strudel: stack(s("bd*2, hh*8").bank("RolandTR909"), note("<c2 g2>").s("sawtooth").lpf(400).gain(.6)), bpm 100, scene rain, density 0.8, sync beat. Waited about 65 seconds.
- Owner cleared "Let the model play Strudel code". Gael: streaks, background and sound all fade out together. Nothing gone at once. "all good".

### 2. Internal lock with rain: pass
- Ticked the box again (silent and black), then Strudel with the same colour, then the owner locked Internal. Gael: everything fades together (streaks too).
- Restore Auto: nothing came back by itself.
- set_sound mode external with a mood (after Gael said yes): synth G dorian, sine, about -26 dB, volume 0.67 on the slider; synth and picture came in ("all good").

### 3. Ripples and motes: pass
- Ripples (density 0.8, bpm 100, started from the synth, waited about 60 s, box cleared): the ripples fade with the sound and the background. "all good".
- Motes (green, same set-up): the motes fade with the sound and the background. "all good".

### 4. Strudel fade-in: pass
- After silence (silence with fade 6, wait for black and silent) and each time the same code, scene rain density 0.8:
  - Run 1 (bpm 90): picture and music start together on the bar, music comes in softly. "All good".
  - Run 2 (bpm 130): same. "all good".
  - Run 3 (short pattern note("c3 e3").s("triangle").gain(.6), bpm 90): same. "All good".
- Gael did not report the first drum hit or first note being hidden too much.

### 5. New code on a playing pattern: pass
- Different code (from the two-note triangle to the drums and saw bass): changed on the next bar, no fade, no dip in volume. Gael: "Perfect". The result notes: "the new code starts on the next bar".
- Same code again: notes "same code and tempo as before: the music does not change"; player report ran true, events_per_cycle 11, sounds bd, hh, sawtooth. Gael: "no change".

### 6. Start from the synth: pass
- Synth playing, strudel_mode on (bpm 100, ripples): the picture stayed on (no black gap) and the music came in on the next bar, softly. Gael: "all good".

### 7. The note: note passes; end of session has issues
- set_sound with a closing mood (calm 0.9, transition 8) while Strudel plays. Exact note: "Strudel is on, so the mood, synth and voice were not used. Only the picture applied. Send strudel_mode with on false to go back to the synth (the synth under Strudel stays paused: a closing sound needs that first; silence with end fades Strudel and the picture)". Clear.
- silence with fade 12 and end true: accepted. Notes: "session ends: the fade starts in 1 s, when your last sound has finished its transition" and "Strudel stops with the fade; set_sound brings the synth back".
- Gael at the end: everything faded and the session ended, with two problems (issue 1 below):
  - "The fade out of strudel was too fast compared to the visual."
  - "They glitched a little bit when you started the fading. (They basically moved played twice)". Clarified: "The streaks moved. As if they were restarted to play the closing sound. But only visual".

### 8. Regression: pass
- Silence with fade 6, then Strudel again: sound and picture came back (test 4, three runs).
- Ticking the box again after clearing it: silent and black ("all good", twice).
- Synth: set_sound with a mood sounds normal and the picture follows (test 2).
- Same code twice: notes as above (test 5).

## Issues

1. **Session end with Strudel playing: Strudel fades out faster than the picture, and the streaks restart when the fade begins.**
   - The Strudel fade is short, while the picture follows the longer silence fade (12 s in this run), so the music is gone long before the picture. Gael finds this too fast compared to the visual. In v0.15.6 (same sequence, bpm 90, rain) he reported everything fading correctly: so this is new in v0.15.7, or depends on the fade value (v0.15.6 also used fade 12, same closing set_sound).
   - At the moment the fade starts (about 1 s after the silence call, when the closing sound's transition ends), the streaks move as if they were restarted to play the closing sound. Visual only: no sound glitch.
   - Possible cause (a guess): the closing set_sound result says "Only the picture applied", so it may re-apply the picture and restart the scene.
2. **Nothing else open.** The streaks fade correctly on the Internal lock, the cleared box, and for ripples and motes.

## Surprising or confusing

- Nothing confusing in the messages to the model this round. The new note about the closing sound is clear.
- After the Internal lock and Auto, the session was again on the internal face. I asked Gael before switching to external with set_sound (as in v0.15.6). The result then said "switched to the external face: say so in one short sentence". Fine.
- Nothing too loud (slider 0.55 to 0.67).

## Not tested

- Phone (not in the brief).
- Console errors (no console access in this run).
- Private window (not in the brief).
- iOS.
