# Fixes after the Strudel picture test round (v0.18.0)

Source: the manual test round of Sat 14 Nov 2026, run against the test brief for v0.18.0 (laptop plus phone, one session). Pass: tests 2, 3, 5, 8, 9. Partial: tests 1, 4, 6, 7. Nothing failed outright.

Work through the items in order. Items 1 to 5 are bugs and polish found in testing, 6 is a feature request, 7 is optional. For each, the symptom comes first, then the expected behaviour, then a way to check it.

## 1. Remove the Picture delay slider

- **Symptom:** the slider is still in the controls. With it at 0 the light already lands with the sound (test 2 passed), so it is not needed.
- **Expected:** the slider and its stored setting are removed. Picture timing stays as it is at 0.
- **Check:** the slider is gone on laptop and phone. A reload does not bring it back, and the Strudel light still lands on the beat.

## 2. Fade "Strudel visuals" in when it is switched back on

- **Symptom:** turning "Strudel visuals" off fades the code out, but turning it on again brings the code back instantly.
- **Expected:** a fade in, about the same length as the fade out.
- **Check:** with a pattern playing, toggle the button off, then on. Both directions fade.

## 3. The colour field shows too early and drifts orange around Strudel transitions

- **Symptom, seen on every transition:**
  - Silence (6a): the picture got more orange before fading to black.
  - "Allow Strudel" off (6b): the same.
  - Start Strudel from silence (6c): a bright orange field arrived first, then darkened when the code view appeared. The picture came before the music.
  - Strudel off, back to the synth (6d): the code view faded out, the picture went to black, and only then did the scenes return.
- **Expected:**
  - The field never shows before the code view. On start, picture and music arrive together on the same bar.
  - On a fade the field only dims. It does not get brighter or change hue.
  - On the way back to the synth, the scenes come in without a long black gap.
- **Caveat:** the field was a custom colour during the test (`mode: own`, hue 30, saturation 0.7, lightness 0.4), which is brighter than the default dark green. That may have made the effect more visible, but the order of events (field first, code second) looks wrong either way. Re-test with the default colour as well as a custom one.
- **Check:** repeat each of the four transitions with the default colour and with a custom one. Record a screen capture if the timing is hard to judge.

## 4. Code on the phone: size, spacing, long code

- **Symptom (test 7, about 3,700 characters over roughly 40 lines plus one very wide line):**
  - Desktop is fine.
  - On the phone the text is too big for long code, and there is wasted space above the first line.
  - In landscape only about 13 lines fit, which is worse.
- **Expected:**
  - A smaller font on narrow screens, scaled to how long the code is.
  - Less padding above the code.
  - A usable landscape layout.
  - For very long code, allow scrolling inside the code area, as long as the page itself never scrolls and nothing spills over the controls.
- **Also:** the code limit is going to 5,000 characters (today the tool schema says 4,000). Update the limit and check that 5,000 characters still lays out properly on phone, in portrait and landscape.
- **Check:** send about 5,000 characters plus one very wide line. Look at it on a phone in portrait, in landscape and on desktop.

## 5. Drawing labels are too small, especially on the phone

- **Symptom (test 4):**
  - Pianoroll labels (`labels: 1`) are unreadable on the phone. They are drawn small and rotated inside the bars.
  - Punchcard on the phone has the same small drawing problem.
  - Wordfall is better on the phone, but labels of very short notes are too small to read, even on desktop.
- **Expected:**
  - A minimum label size that is readable on a phone.
  - Hide a label when its bar is too short for the text, instead of drawing it tiny.
  - No sideways labels on narrow screens.
- **Check:** `.pianoroll({ labels: 1 })` and `.wordfall()` with real notes, including very short ones, on a phone and on desktop.

## 6. Feature request: fullscreen

- **Request:** a Fullscreen option that hides the header, the controls and the footer so the picture fills the screen. A third button next to "Allow Strudel" and "Strudel visuals" would fit, in the same style as Gradient and Scenes.
- **Open choices:** how to leave fullscreen (tap, Esc), and whether "Show controls" stays reachable.
- **Check:** works on laptop and phone, and leaving fullscreen restores the layout.

## 7. Optional: more drawings

- **Request:** make `.pitchwheel()`, `.spiral()` and `.spectrum()` available. Today they are ignored and `get_feedback` reports them as "not available on sonorous", which is correct.
- **Keep `.markcss()` unavailable.** It lets model-written code inject arbitrary CSS into the page that holds the owner's controls. If it is ever allowed, restrict it to an allowlist of visual properties (colour, text-shadow, font-weight, underline) and block `position`, `display`, `z-index`, `url()` and anything else that could cover or reach outside the code area.
- **For the drawings:** each one needs the same checks as the others (behind the code, readable code, `.color()` respected, lane form if there is one, phone legibility).

## Still open from the round

- **Private window (test 1):** only "Strudel visuals" should show for a non-owner, and only while a pattern plays. This was not tested.
- **Players:** the server reported 2 players at first and 1 from test 6c onward. It is not known which device dropped (possibly the phone sleeping), so later phone observations may cover only one device. If a player drops without sleeping, check the reconnect path.
- **Not tested, as the brief says:** a real second device for `players`, the guest "Add to your AI" button, `reads_as` joy, Safari (the sandboxed worker and the new `AnalyserNode` tap on a Mac or iPhone).
