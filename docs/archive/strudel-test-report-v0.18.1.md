# Fixes after the v0.18.1 Strudel picture round

Source: the manual test round of Sat 14 Nov 2026 against the v0.18.1 test brief (laptop, phone via devtools, private window, one session). Pass: tests 1, 3, 5, 6, 7, 8. Partial: tests 2, 4, 9. Nothing failed outright. Most of the v0.18.0 items are now fixed (delay slider removed, fade-in, orange field on start and silence, phone code size and auto-scroll, 5000 limit, labels, fullscreen, the three new drawings). What is left is below, in order of importance.

## 1. "Allow Strudel" off: scenes flash in after the code fades (test 4b, default colour)

- **Symptom:** the owner turns "Allow Strudel" off. The code fades out quickly, then the normal scenes show for a moment, then the picture fades to black. The brief says the scenes must not flash in.
- **Expected:** the code fades to black over about 3 seconds and the scenes stay out.
- **Check:** with the default colour and with a custom one (`mode: own`, hue 30, saturation 0.7, lightness 0.4), turn "Allow Strudel" off while a pattern plays. Only the custom-colour version was not re-tested this round.

## 2. Back to the synth: black, then the aurora, with the fades overlapping (test 4d, default colour)

- **Symptom:** `strudel_mode` on false while the synth was silent: the code view faded to black, then the scenes faded in, and the aurora started before the code's fade-out had finished, so the two overlapped. With the synth already playing, the custom-colour redo had no black gap, and the small overlap was fine.
- **Expected:** after a fade to black the code never reappears or lingers behind the incoming scenes. A short overlap while the scenes come in is fine.
- **Check:** repeat both cases (synth silent beforehand, synth playing beforehand) with the default colour.

## 3. Top row of the controls: turn text not centred (laptop)

- **Symptom:** "Turn 2 · 1 min ago" sits just after the "External · Strudel" chip. It is not centred between the chip and the Fullscreen and Hide icons, so the row looks lopsided.
- **Expected:** the turn text is centred in the space between the chip and the icons (or centred in the whole row), and horizontally aligned with them.
- **Check:** on a laptop, look at the controls at a few widths wider than 430 px. On the phone the text stays hidden.

## 4. Controls panel: a bit more opaque

- **Symptom:** on the phone the code shows through the controls panel and makes the buttons, the Face block and the hint harder to read.
- **Expected:** a slightly more opaque panel, or a backdrop blur. The picture should still show a little behind it.
- **Check:** open the controls over a pattern with long code on a phone-width viewport.

## 5. Spiral: gaps and overlaps, and a degenerate `stretch`

- **Symptom A (test 9a, `.spiral({ steady: 0.96 })`):** in the inner turns there are thin holes between neighbouring wedges, and some wedges overlap their neighbours. It looks half-finished. The same artifacts show up on strudel.cc, so fixing it means looking cleaner than upstream.
- **Possible causes (unverified, from a screenshot):** each segment is anti-aliased separately, so hairline seams show; per-event angle rounding drifts at small radii; cap or join settings bulge past the segment ends.
- **Possible fixes:** extend each wedge's angular span by a fraction of a pixel so neighbours overlap cleanly; fill one turn from a single path; clamp the innermost radius so the first turn doesn't collapse.
- **Symptom B (test 9e, `.spiral({ stretch: 100000 })`):** the player stays smooth, with no freezes, and the music is fine. But the drawing is not a spiral any more. It is a nearly flat disc with one cyan ring and one large white block.
- **Expected:** clamp `stretch` to a sensible range so the picture stays a recognisable spiral. The player must stay smooth either way.
- **Check:** `.spiral({ steady: 0.96 })` on laptop and phone with the default colour, then `.spiral({ stretch: 100000 })` and a few more extreme values.

## 6. Smaller things to check

- **Owner view and labels:** on a narrow owner window, pianoroll labels were left off entirely (bars about 43 px wide), while the guest window (about 52 px) showed them. This matches the "squeezed more than twice, left off" rule, and a wider owner window showed them, so it is not a bug. If it feels too strict, the threshold could be loosened, but that is a call for you.
- **Landscape on the phone:** the report for test 5 covered portrait and laptop. Landscape was not reported separately, so re-check the long code (5000 characters plus a wide line) in landscape.
- **Custom colour and "Allow Strudel" off:** test 4b was only run with the default colour (see item 1).

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari (the sandboxed worker and the `AnalyserNode` tap on a Mac or iPhone). `.markcss()` and `.hydra()` stay unavailable on purpose.
