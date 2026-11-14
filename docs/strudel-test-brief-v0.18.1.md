# Test brief: Sonorous Envelope v0.18.1 (only what is new or was not tested)

Read this whole file first. Tests 2, 3, 5, 8 and 9 of the v0.18.0 round passed and are **not** tested again. You test the picture and the buttons, not the sound.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, `strudel_mode` with real music (drums, bass, melody, 90 to 120 BPM). Do not announce what you set. Use the default colour for each test unless it says custom.

## Tests (record pass, fail or partial, and what the user saw)

1. **Non-owner view (never tested).** Open the link in a private window. Pass: no "Face" block, no "Allow Strudel", and no reactions. While a pattern plays, "Strudel visuals" shows alone in its row; with the synth playing the row is not there. The Fullscreen icon is in the top row for everyone.
2. **Picture delay is gone, top row and hint.** Pass: no Picture delay slider on laptop and phone, and the Strudel light still lands on the beat. The turn text sits in the middle of the top row (dropped when the controls are narrower than 430 px, so on a phone it is not there; wider, it is), the Fullscreen and Hide controls icons are flush right, and the hint under "Allow Strudel" and "Strudel visuals" is two lines at most on a phone (360 px).
3. **Strudel visuals fades in.** With a pattern playing, switch the button off, then on. Pass: both directions fade (about half a second to a second), neither jumps.
4. **Transitions, default colour, then a custom one** (`mode: own`, hue 30, saturation 0.7, lightness 0.4). Pass for each of the four:
   - (a) `silence`: the code fades to black. The colour field never shows through, never turns orange.
   - (b) The owner turns "Allow Strudel" off: same.
   - (c) Start Strudel from silence: the picture is dark until the music's first bar, then the code and the music come in together. No bright field first.
   - (d) `strudel_mode` on false, back to the synth: the code view fades out and the scenes are there at once, with no long black gap.
5. **Long code on the phone.** Send about 5000 characters (40+ lines) plus one very wide line. Pass, in portrait, landscape and on the laptop: the whole code is smaller on the phone, little empty space above the first line, and when it does not fit the view sweeps slowly over it, top to bottom and back (a stack lights every line at once, so it does not follow one line). The page itself never scrolls and nothing covers the controls.
6. **The new limit.** Send exactly 5000 characters, then 5001. Pass: 5000 plays, 5001 is refused with an error that says the limit.
7. **Labels on the phone.** `.pianoroll({ labels: 1 })`, `.punchcard({ labels: 1 })` and `.wordfall()` with real notes, including very short ones. Pass: a label is either readable or left off, never a tiny smudge, and none runs far outside its bar. On a desktop roll some labels stay (squeezed into their bar, as Strudel does) while others are left off (squeezed more than twice): that is the rule, not a bug.
8. **Fullscreen.** The Fullscreen icon is in the top row of the controls, left of the Hide controls icon (both are flush right; the turn text now sits under the Internal/External chip). Pass, on laptop and phone: it hides the header, the controls and the footer and the picture fills the screen; a button to leave shows for a few seconds and again when you touch the picture; Esc and that button both leave; the layout comes back as it was. Also try it with the scenes (a synth session).
9. **The three new drawings.** `.spiral({ steady: 0.96 })`, `.pitchwheel()` and `.spectrum()`, each with real notes and a `.color()`. Pass: each draws behind the code and moves with the music, the code stays readable, the colour is respected, and `._spiral()` and `._pitchwheel()` take a lane at the bottom. Also send `.spiral({ stretch: 100000 })`: the player must stay smooth.

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose (model-written CSS or shader code would run in the page).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
