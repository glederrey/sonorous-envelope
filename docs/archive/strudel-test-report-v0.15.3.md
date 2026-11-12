# Test report: Sonorous Envelope v0.15.3

Tester: Claude, with Gael listening, watching and operating the player. Date: 2026-11-12, 16:49 to 17:15 (Europe/Zurich).
Devices: desktop browser (owner, and a private window as guest); Android Nothing phone (4a), Nothing OS 5.0, Chrome 157.0.8103.50.
Session: qJTOWIsF87EqFWoWWC-TmkJ6 (all tests). The connector did not ask for a new sign-in this round.

## Summary

Most of the fixes work. The picture now comes back after a silence (with the same code, new code and only a new colour), there is no drop at the start of a Strudel fade, a late joiner sees black at once, the buttons are on one row, the messages are clearer, a refused call changes nothing, and on the Android phone the glitches did not come back, also when Gael used the controls. The short drop when returning to Chrome from another app is gone as well.

Still open:
1. When the owner clears "Let the model play Strudel code", the sound fades out but the picture (rain and background) stays on. It only goes black after a reload.
2. The QR code (under Open on phone) sits at the left at half width, not full width and centred. Gael suggests a popup instead.
3. Gael suggests that locking Internal should also fade to silence, not play the leftover synth (see below).
4. When a session ends while Strudel plays, Strudel fades too long and the closing sound starts too early.

## Results

| # | Result | Notes |
|---|---|---|
| 1 | Pass | Silence fade 6, then Strudel again: same code, new code, and same code with only a new colour. Music and picture came back fading in each time. (Gael noticed rain streaks in 1c, not circles: that was the rain scene I sent, so it is correct.) |
| 2 | Pass | Steady sawtooth bass, three silence fades with fade 6: no sudden drop in the first two seconds, no stray note, picture came back each time. |
| 3 | Pass | Private window after the silence: full black, no blue glow before or after Start listening. |
| 4 | Partial fail | Owner cleared the box: the sound went silent, but the picture stayed fully on (rain streaks and background). get_feedback was right: no pattern field, the owner-stopped note, and "The synth state is silent (volume 0): nothing sounds until you send set_sound". After a reload the page was black. So the fade is missing only at the moment of the switch. |
| 5 | Pass | Box ticked again: still silent, nothing came back, also after a reload (black). New strudel_mode code: music and picture came back. |
| 6 | Pass as written | Lock Internal with Strudel playing: Strudel stops, the synth comes in, the picture stays. get_feedback: mode "internal, locked by the owner", no pattern, owner-stopped note. After Auto it stayed internal and nothing resumed by itself. Gael's design change below. |
| 7 | Buttons pass, QR fail | Gael: all good for the buttons (one row, full width, equal). The QR code appears below at the left, half width, with its caption left-aligned: not full width or centred. |
| 8 | Pass | Phone, owner: Copy link alone fills the width. The guest layout on the phone was not checked. |
| 9 | Not a test | Footer line was fixed and checked by Gael. |
| 10 | Pass (about 2 min) | Phone as owner (desktop owner open too), Strudel chiptune, Gael used several controls (slider, mute, Face buttons, code switch) on purpose: no glitches or pulses. Debug line: 1526 events played, 0 dropped as late, 0 refused, worst lateness 0 ms, 26 clock syncs. Shorter than the 10 minutes of the brief. |
| 11 | Partial | The 0.5 s drop when coming back to Chrome from another app is gone. The full 5-minute untouched baseline was not run. |
| 12 | Pass | Same code and tempo sent twice: notes say "same code and tempo as before: the music does not change" and "pattern is the player's report on this code". No "replaced". |
| 13 | Pass | on:false onto a silent synth: "back on the synth, but its state is silent (volume 0): nothing fades in until you send set_sound". Onto an audible synth: "back on the synth, where you left it: it fades in". |
| 14 | Pass | note("c3".s( : {"error":"syntax_error","message":"The code was not saved: syntax error: Unexpected token (line 1, column 13). Fix it and send it again."} Nothing changed in the player, and get_feedback still shows the old 82-character code playing. |
| 15 | Pass | Synth sounds normal and louder; picture follows (orange ripples). |
| 16 | Pass | Session end: picture and sound fade, "This session has ended." (but see issue 4 for Strudel). |
| 17 | Pass | player_poll once per second, body {"v":"...","now":"...","same":true} (about 100 bytes). The Network tab still shows about 1.1 kB transferred per request (headers); Gael says it is not a big deal. |

## Issues and suggestions for Claude Code

1. **Owner turns Strudel off: the picture does not fade.** The sound fades to silence but the rain and the background stay fully on until the page is reloaded (then black). It should fade to black with the sound, as it does after a silence call.
2. **QR code.** It is half width, left-aligned, with a left-aligned caption, below the buttons. Gael suggests a popup (centred, closed with Esc, a click outside, or a button), since the panel is already tall, the layout would stay still and the code could be larger to scan.
3. **Lock to Internal.** Today Strudel stops and the leftover synth state comes in over a few seconds. Gael's view: the external and the internal faces are different voices, so when the owner forces the face to Internal, the sound should fade to silence (picture too) and the model's next set_sound brings the internal voice, the same as when Strudel is turned off. (My first view was to keep the synth; Gael's argument is better.) After Auto, the face stayed internal and nothing resumed: fine.
4. **Session end while Strudel plays.** With my sequence (strudel_mode on false, a closing set_sound, silence with end true), Strudel's fade is too long and the closing synth sound starts too early, so they overlap. Please fade Strudel faster and start the closing sound when that fade is almost done.
5. **Polling transfer.** Still about 1.1 kB per request, mostly headers (minor).

## Other notes

- Setup: the player slider was at 0.79 although Gael had lowered the computer volume: nothing was too loud this round.
- The on:false note and the silent-synth note now read well. After an owner stop, the note also says the synth state is silent.
- Without this round's fixes the phone had pulses, so the earlier hypothesis about the controls looks right: the slider change and the lookahead change seem to have helped. I could not tell which one.

## Not tested

The full 10-minute phone run (about 2 minutes done with the controls), the 5-minute untouched baseline, the guest layout on the phone, the window at exactly 800 px (Gael reported the buttons as good), console errors (not checked), and iOS.
