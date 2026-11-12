# Test report: Sonorous Envelope v0.15.4

Tester: Claude, with Gael listening, watching and operating the player. Date: 2026-11-12, 20:12 to 20:25 (Europe/Zurich).
Devices: desktop browser (owner, and a private window as guest); Android Nothing phone (4a), Chrome.
Sessions: MRfs7N1mdpJS-wLrG5rkDlfF (tests 1 to 4, 6 to 12 and run 1 of test 5), 8f8KR0GSyHu_Uf42juSyBVaN (run 2 of test 5). The connector did not ask for a new sign-in this round.

## Summary

The four open items of v0.15.3 are fixed: the picture now fades with the sound when the owner clears the Strudel box, locking Internal fades the sound and the picture instead of playing the leftover synth, a session that ends while Strudel plays fades quickly with no overlap (both runs), and the QR code is a popup that works. The phone was perfect.

One thing is not right: when the owner ticks "Let the model play Strudel code" again, a slow synth starts to play, although the server says the synth state is silent. After a reload it is silent and black, as expected.

The bottom buttons are still not good in two views (guest before Start listening, and the labels of the owner's controls at a narrower window); Gael has suggestions for them.

## Results

| # | Result | Notes |
|---|---|---|
| 1 | Pass | Owner cleared the box (no reload): sound and picture (rain and background) faded out together. |
| 2 | Partial fail | get_feedback after the switch: no pattern field, the owner-stopped note and the silent-synth note (all as expected). But when the owner ticked the box again, a slow synth started to play right away (not the drums), although the server's synth state was silent (volume 0). After a reload: silent and black, nothing came back. New strudel_mode code: music and picture came back (the picture started a little before the music: the music waits for the next bar). |
| 3 | Pass | Lock Internal with Strudel playing: the screen went black and Strudel stopped, no sound. get_feedback: mode "internal, locked by the owner", no pattern field, owner-stopped note and the silent-synth note. |
| 4 | Pass | set_sound with a mood after the lock: the internal voice played and the picture came back. After the owner set Auto: nothing resumed and the face stayed internal. |
| 5 | Pass (two runs) | Run 1 (closing set_sound sent right after on:false, transition 8, then silence with end): Strudel faded very quickly, "perfect". Run 2 (closing sound about 1 s after the on:false, new session): "very quickly, perfect, no overlap", the session ended. |
| 6 | Pass | QR popup on the desktop owner player: Gael says all three checks pass (the popup, closing it, the scan). Also checked in the private window (guest). The "Open on phone" button on a phone was not looked at. |
| 7 | Pass | Page checked by fetching the home page: title "Sonorous Envelope: let the model hum while it thinks", description starts "A remote MCP server that gives an AI model a synthesizer and a colour field", og:image https://sonorous-envelope.com/brand/og-image.png, twitter:card summary_large_image. I could not load the image myself. Gael opened it and said all good. |
| 8 | Pass | Gael opened /favicon.ico and the tab icon: all good. (My own fetch of /favicon.ico failed, and the fetched page showed no rel=icon tag, but that text version of the page may not show it.) |
| 9 | Pass | Silence fade 6 with Strudel playing, then Strudel again: sound and picture faded together, both came back, no drop at the start of the fade. |
| 10 | Pass | Same code twice: notes say "same code and tempo as before: the music does not change" and "pattern is the player's report on this code". note("c3".s( : {"error":"syntax_error","message":"The code was not saved: syntax error: Unexpected token (line 1, column 13). Fix it and send it again."} Nothing changed in the player; get_feedback still showed the old 82-character code. |
| 11 | Pass | The synth: set_sound mood sounds normal and louder than before, picture follows. |
| 12 | Pass (about 2 min) | Phone as owner (desktop owner open too), ?debug=1, chiptune loop from 20:21:32. Gael used the slider, Mute and Face buttons: "phone is perfect", no glitches or pulses, no drop when switching to another app and back (one "away 10 s" entry in the debug log, one tick with the audio stopped). Debug line at about one minute: 601 events played, 0 dropped as late, 0 refused, worst lateness 0 ms, 10 clock syncs. Stopped by Gael after about 2 minutes (the brief says 5). |

## Issues and suggestions for Claude Code

1. **Ticking the box again plays a synth.** Right after the owner ticks "Let the model play Strudel code" again, the player plays a slow synth (the earlier synth voice), while the server's synth state is silent (get_feedback: volume 0, "nothing sounds until you send set_sound"). It should stay silent and black until the model sends something. After a reload it is correct.
2. **Guest page before Start listening.** The box at the bottom ("Want your AI to make sound for you too?") wraps: "Add it to your AI app" is on the first row next to the sentence, "Copy link" is alone on a second row. The buttons are not on one row at the full width.
3. **Owner controls.** At a window of about 800 px all three buttons are on one row, but their labels wrap onto two lines ("Add it to your AI app", "Open on phone"). Gael suggests making the first sentence small and renaming "Open on phone" to "QR code" (shorter), in both the owner and the guest views.
5. **Ended session still shows the link box.** When a session has ended ("This session has ended."), the box at the bottom ("Anyone with the link can listen. Nobody else can change anything.") and its Copy link button are still shown. Gael: they should be removed, since the link no longer leads to a live session. (Seen in the owner's desktop browser, Brave, on session 8f8KR0GSyHu_Uf42juSyBVaN after the end of test 5 run 2.)
4. **Picture and music do not start together (minor).** After a silence or after ticking the box, the picture starts a moment before the music, because the music waits for the next bar. Gael is not sure it is a problem.

## Other notes

- Nothing was too loud this round.
- No message to the model was confusing. The on:false notes, the owner-stopped note and the silent-synth note all read well.
- Console errors were not checked.

## Not tested

The "Open on phone" button on a phone (test 6), a full 5-minute phone run (about 2 minutes done), console errors, iOS Safari. The og-image and the favicon were checked by Gael, not by me.
