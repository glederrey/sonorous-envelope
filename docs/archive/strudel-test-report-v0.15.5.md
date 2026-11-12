# Test report: Sonorous Envelope v0.15.5

Tester: Claude, with Gael (owner) listening and operating the player.
Session: Ig9uOYtJLcx9gLdmWSmSNt6M (external face, ended at the end of the run).
Devices: desktop Brave (owner, and a private window as guest, about 1220 px, then about 800 px); Android Nothing phone (4a), Chrome, owner, ?debug=1.
Console errors: not checked (no console access in this run).

## Summary

All seven tests pass. Four small points remain: the rain streaks vanish at once when the Internal lock fades the sound; the picture still starts before Strudel (this time also after ticking the box again); a possible rename of a button label (decided); and the phone drops sound when another app (Spotify) plays at the same time (not a real use case).

## Results

| # | Test | Result |
|---|------|--------|
| 1 | Ticking the box again | Pass |
| 2 | Internal lock | Pass, one minor visual issue |
| 3 | Guest before listening | Pass (desktop 1220 px and 800 px); phone not checked |
| 4 | Guest after listening and owner controls | Pass |
| 5 | Ended session | Pass (Gael: "all good for the session ends") |
| 6 | Regression | Pass, one minor note |
| 7 | Phone | Pass, with a note |

### 1. Ticking the box again: pass
- Strudel played (s("bd*2, hh*8").bank("RolandTR909"), bpm 120, rain). The owner cleared "Let the model play Strudel code": sound and picture faded out.
- get_feedback after the stop: engine is the synth state, volume 0, note "the owner stopped your Strudel pattern (face locked or code off), so the synth state plays. It is final... The synth state is silent (volume 0): nothing sounds until you send set_sound".
- The owner ticked the box again: no sound, black picture (15 seconds and more). After a page reload: still silent and black.
- strudel_mode on with the same code: music and picture came back. Gael: the picture came back a little before the music (see issue 2).

### 2. Internal lock: pass, one minor visual issue
- Strudel playing, owner locks Internal: the sound fades to silence. The rain streaks disappear at once and do not fade with the sound (issue 1). Gael: this happened before.
- Owner restored Auto (and External if shown): nothing plays by itself, screen stays black.
- set_sound with a mood (warmth 0.6, joy 0.6, calm 0.7): turn 3 result: G dorian, triangle, volume 0.5, loudness -28 dB, reads_as warmth 0.79, closeness 0.52, joy 0.31, calm 0.75, spontaneity 0.41. The internal voice played and the picture followed.

### 3. Guest before listening: pass
- Private window, not signed in, Start listening not pressed. The box at the bottom has a small sentence on top ("Want your AI to make sound for you too?") and the two buttons ("Add it to your AI app" and "Copy link") on one row at the full width, labels on one line. Checked at about 1220 px (screenshot) and about 800 px.
- Not checked on the phone as a guest.
- Gael would rename "Add it to your AI app". He first proposed "Give it to your AI". My view was that the current label says what it does and "Give it to your AI" could be read as another way to share the link. He decided on **"Add to your AI"**. Please rename the button.

### 4. Guest after listening and owner controls: pass
- Guest at about 800 px after Start listening: "Add to your AI" (current label "Add it to your AI app"), "Copy link" and "QR code" on one row, labels on one line.
- Owner at about 800 px: "Copy link" and "QR code" on one row, labels on one line.
- The QR code popup opens and closes with Esc, a click outside and the Close button. Gael: "it always closes".

### 5. Ended session: pass
- Closing set_sound (transition 8 s) and silence with fade 12 and end true.
- Silence result note: "session ends: the fade starts in 6 s, when your last sound has finished its transition".
- Gael: all good for the session end. The link box and the Copy link button are gone (owner and private window, per his confirmation).

### 6. Regression: pass
- Silence with fade 6 while Strudel plays: sound and picture (including the ripples) faded together over the fade. Then, the black screen and silence.
- Strudel again with the same code (stack of TR909 drums and a triangle bass, bpm 110, ripples): sound and picture came back. The picture came back a little before the music (issue 2).
- Same code and tempo a second time: notes "same code and tempo as before: the music does not change"; the player reported ran true, events_per_cycle 11, sounds bd, hh, triangle. The music did not change.
- Synth: strudel_mode on false, then set_sound with a mood (warmth 0.7, joy 0.6, calm 0.6): G dorian, tempo glides 75 to 91 over 4 s, loudness -27 dB. The sound was normal and the picture followed.
- A session end after strudel_mode on false, closing set_sound and silence with end true: faded as expected. Note: in this run Strudel was switched off before the closing sound, so the "session end while Strudel is still on" path (fast Strudel fade) was not run again in this round. It passed in v0.15.4.

### 7. Phone: pass with a note
- Android, Chrome, owner, ?debug=1, acid Strudel loop (132 bpm, 37.3 events per cycle). Gael used the slider, Mute and the face buttons: no glitches.
- Drops happened when Gael opened Spotify at the same time. He says nobody would do this: not a problem.
- Debug line: Strudel: 2223 events played, 17 dropped as late, 0 refused, worst lateness 192 ms, 26 clock syncs. Keep-alive audio: pause at 20:42:30 (play 20:42:31), pause at 20:42:38 with "auto-resume after keep-alive pause" at 20:42:38. "Audio session type: not supported". State checks by the page: 4 ok, 0 failed.

## Issues

1. **Rain streaks vanish at once with the Internal lock (minor).** When the owner locks Internal while Strudel plays with the rain scene, the sound fades to silence but the streaks disappear immediately instead of fading with the sound. The background fades correctly. Known from before.
2. **Picture starts before the music (minor, both on first start and after ticking the box again).** Strudel waits for the next bar (up to about 2.2 s at 110 bpm) and the picture starts at once. Gael first suggested a slower fade-in for picture and sound (synth and Strudel). My view: that only masks the early picture. Gael prefers the cleaner fix: **start the picture's fade-in on the bar, together with the music.**
3. **Button label.** Rename "Add it to your AI app" to "Add to your AI" (Gael's decision).
4. **Phone and Spotify (info only).** Running another audio app at the same time causes sound drops. Not a use case.

## Surprising or confusing

- Nothing confusing in the messages to the model this round. The note "setcps/setcpm ignored: the tempo is bpm" appeared on the acid loop, which had a setcps(1) line by mistake: clear.
- Loudness: nothing too loud (volume slider kept low; the acid loop was "perfect" for Gael).

## Not tested

- Test 3 on the phone as a guest (the buttons before Start listening), because the phone was used as owner.
- Console errors (no access in this run).
- The session end while Strudel is still on in this round (see test 6).
- iOS.
