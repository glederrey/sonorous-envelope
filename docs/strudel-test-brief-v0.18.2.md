# Test brief: Sonorous Envelope v0.18.2 (only what changed)

Read this whole file first. Tests 1, 3, 5 (laptop and portrait), 6, 7 and 8 of the v0.18.1 round passed and are **not** tested again. You test the picture and the buttons, not the sound.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, `strudel_mode` with real music (drums, bass, melody, 90 to 120 BPM). Do not announce what you set. Use the default colour for each test unless it says custom.

## Tests (record pass, fail or partial, and what the user saw)

1. **Allow Strudel off, no scenes flash in.** While a pattern plays, the owner turns "Allow Strudel" off. Pass: the code fades to black over about 3 seconds and the scenes never show, not even for a moment. Do it with the default colour, then with a custom one (`mode: own`, hue 30, saturation 0.7, lightness 0.4).
2. **Back to the synth.** `strudel_mode` on false, then a synth sound. Do it twice: with the synth silent beforehand, and with it already playing. Pass: the code fades out and does not come back or linger behind the incoming scenes; a short overlap while the scenes come in is fine. Default colour.
3. **Top row.** On a laptop, look at the controls at a few widths above 430 px. Pass: "Turn N · …" sits exactly in the middle of the row, with the chip on the left and the two icons flush right; on a phone the turn text is not there.
4. **Controls over code.** On a phone-width window with long code playing, open the controls. Pass: the buttons, the Face block and the hint are easy to read, and the picture still shows a little behind the panel.
5. **Spiral.** `.spiral({ steady: 0.96 })` on laptop and phone: pass if the turns have no thin holes between neighbouring events and no obvious overlaps. Then `.spiral({ stretch: 100000 })`, `.spiral({ stretch: 5 })` and `.spiral({ stretch: 0.01 })`: pass if each is still a recognisable spiral (the stretch is limited to 0.25 to 2.5) and the player stays smooth.
6. **Long code in landscape on a phone.** About 5000 characters plus one very wide line. Pass: the code is readable, the view sweeps over it, and nothing covers the controls.

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose. Labels on a narrow owner window are left off by the "squeezed more than twice" rule; that is not a bug.

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
