# Fixes after the v0.18.2 Strudel picture round

Source: the manual test round of Sat 14 Nov 2026 against the v0.18.2 test brief (laptop, phone via devtools, one session). Pass: tests 1, 2, 3, 5, 6, 7. Partial: test 4. Nothing failed. All the items from the v0.18.1 list that were retested are fixed: no scene flash when "Allow Strudel" goes off, the back-to-synth transition, the centred turn text, the spiral seams and the stretch limit, landscape long code, and the faster fade-out.

## 1. Controls panel: a bit more opaque, "Show controls" more transparent (test 4, partial)

- **Symptom:** on a phone-width window with a long pattern playing, the buttons and the Face block are readable, but code still bleeds through the open panel. In the screenshot a code line (`decay(.12).sustain(0)…`) runs behind the "How is it landing?" row, and another sits behind the Strudel visuals hint. The picture itself should still show a little.
- **Suggested fix (agreed in the round):**
  - Open panel: about 90% opaque, plus a backdrop blur of roughly 8 to 12 px, so the code behind it softens but the picture still shows through.
  - "Show controls" button: more transparent than the open panel, about 60%, with a thin border so it stays easy to find.
- **Check:** open the controls on a 360 px window with a pattern of about 1,300 characters playing. Every row should read without code showing through its text, and the picture should still be faintly visible behind the panel. Check the closed "Show controls" button against a bright scene too.

## 2. Closing sequence: the old scene shows before the new one (found at the end of the round)

- **Symptom:** when the session was ended from Strudel (`strudel_mode` on false, then a closing `set_sound`, then `silence` with end), the picture first showed the synth's previous scene (the aurora from earlier in the round), faded it out, and only then brought in the closing scene (I set stars; you described it as snow coming in). The aurora should not appear at all.
- **Expected:** when Strudel is switched off, the picture should not show a stale scene. Either hold black until the next `set_sound` arrives and then fade the new scene in, or have the new scene replace the old one without the old one showing first.
- **Why it happens (guess, unverified):** switching back to the synth restores the synth's last state, including its last scene, and the new `set_sound` arrives a moment later. The same would apply to any `strudel_mode` on false followed by a new scene.
- **Check:** start Strudel while an aurora scene is the synth's last scene, then call `strudel_mode` on false and a `set_sound` with a different scene (stars, for example) one after the other. The aurora should never appear. Also try the ordinary back-to-synth case from test 2.

## 3. Optional polish

- **Back to the synth: the visuals switch faster than the sound.** With the synth already playing, the picture changed from code to scenes noticeably faster than the synth faded in (run 2 of test 2). No black gap, no lingering code, so it is not a failure. If it is cheap, lengthen the picture's switch slightly so the two feel together.
- **`.spiral({ stretch: 0.01 })` is lopsided.** It is clamped to 0.25 and is a recognisable spiral (pass), but the centre sits to one side and the outer turns run close to the edges of the view. Centring it, or keeping its outer radius inside the view, would look better.
- **`colour: { mode: "follow" }` has no effect while Strudel is on.** `strudel_mode` and `set_sound` both returned the previous custom colour (hue 30) unchanged, because with Strudel on only the picture settings apply. The default colour comes back only once the synth does. If that is intended, say so in the tool description. If not, "follow" could reset the field right away.

## Still open, not for this round

`players` with a real second device: the server reported 1 player for the whole round although a laptop window and a devtools phone view were both listening, so it is worth a look when a real second device is available. The guest "Add to your AI" button, `reads_as` joy, Safari. `.markcss()` and `.hydra()` stay unavailable on purpose. Labels on a narrow owner window are left off by the "squeezed more than twice" rule; that is not a bug.
