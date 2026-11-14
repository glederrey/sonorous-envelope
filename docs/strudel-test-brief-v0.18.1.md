# Test brief: Sonorous Envelope v0.18.1 (only what is new or was not tested)

Read this whole file first. Tests 2, 3, 5, 8 and 9 of the v0.18.0 round passed and are **not** tested again. You test the picture and the buttons, not the sound.

## Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, `strudel_mode` with real music (drums, bass, melody, 90 to 120 BPM). Do not announce what you set. Use the default colour for each test unless it says custom.

## Tests (record pass, fail or partial, and what the user saw)

1. **Non-owner view (never tested).** Open the link in a private window. Pass: while a pattern plays, "Strudel visuals" and "Fullscreen" show, side by side, and no "Allow Strudel". With the synth playing instead, only "Fullscreen" shows.
2. **Picture delay is gone.** Pass: no slider on laptop and phone, and the Strudel light still lands on the beat.
3. **Strudel visuals fades in.** With a pattern playing, switch the button off, then on. Pass: both directions fade (about half a second to a second), neither jumps.
4. **Transitions, default colour, then a custom one** (`mode: own`, hue 30, saturation 0.7, lightness 0.4). Pass for each of the four:
   - (a) `silence`: the code fades to black. The colour field never shows through, never turns orange.
   - (b) The owner turns "Allow Strudel" off: same.
   - (c) Start Strudel from silence: the picture is dark until the music's first bar, then the code and the music come in together. No bright field first.
   - (d) `strudel_mode` on false, back to the synth: the code view fades out and the scenes are there at once, with no long black gap.
5. **Long code on the phone.** Send about 5000 characters (40+ lines) plus one very wide line. Pass, in portrait, landscape and on the laptop: the whole code is smaller on the phone, little empty space above the first line, and when it does not fit the view follows the lit part up and down. The page itself never scrolls and nothing covers the controls.
6. **The new limit.** Send exactly 5000 characters, then 5001. Pass: 5000 plays, 5001 is refused with an error that says the limit.
7. **Labels on the phone.** `.pianoroll({ labels: 1 })`, `.punchcard({ labels: 1 })` and `.wordfall()` with real notes, including very short ones. Pass: a label is either readable or left off, never a tiny smudge, and no label runs outside its bar.
8. **Fullscreen.** A "Fullscreen" button sits next to "Allow Strudel" and "Strudel visuals" (on a phone it takes its own row). Pass, on laptop and phone: it hides the header, the controls and the footer and the picture fills the screen; a button to leave shows for a few seconds and again when you touch the picture; Esc, that button, and a tap on it all leave; the layout comes back as it was. Also try it with the scenes (a synth session).

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari. Not in this round: `.pitchwheel()`, `.spiral()` and `.spectrum()` stay unavailable (spiral and spectrum were dropped on purpose; `.markcss()` stays off for safety).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
