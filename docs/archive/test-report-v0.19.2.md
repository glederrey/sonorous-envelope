# Test report: Sonorous Envelope v0.19.2 (fixes only)

- **Date:** 2026-11-15, 18:41–19:01 (Europe/Zurich)
- **Session id:** `q-01Wlv7EeUAaSGhCH5y1CFR` (a first session, `UAL0hU1NpNdExH0EyBBMfbRP`, was discarded: player and server were still on v0.19.1)
- **Device and browser:** desktop, Chromium-based browser, player opened with `?debug`, console open
- **Tester:** Gael (owner), Claude as the model

| # | Test | Result | What the user saw or said |
|---|---|---|---|
| 1 | Warmth with adopted voice | Partial | The wave changes with warmth and a note says so each time it moves. The user heard the move to square ("buzzier, brighter") and back to a much softer triangle. Two problems: warmth 0.8 reads 0.56 (gap 0.24), and sawtooth never appears (0.3 already gives square). |
| 2 | Attuned no louder | Pass (level) | Level went from −28 to −29 dB and the user heard no jump in volume. But the tempo went from 76 to 155 bpm (1/16 arp); the user said it was "very fast" (see feedback 4). |
| 3 | No tempo glide after a silence | Pass | No "tempo X to Y" note; the sound came in directly at 60 bpm. |
| 4 | Mode row | Pass | Self and then Attuned: teal ring, teal text, no dot; Auto keeps its orange outline. The user found them "very easy" to tell apart. Only the dark theme was checked. |
| 5 | New code, no cut | Pass | Pianoroll → punchcard → same music at 140 bpm: no gap in the music, no flash; the drawing changed when the new code came in, on the bar. The pianoroll shows note names. The first start faded everything in together. Minor: the drawings swap instantly, with no crossfade. |
| 6 | Motion at a fast tempo | Pass (server) / not visible | Motion followed bpm: drift at 92 bpm, pulse at 140 bpm. With Strudel visuals on, the pianoroll covers the background, so no pulse is visible; the user prefers it that way. With Strudel visuals off, the old synth scene (waves) shows and does not pulse. |
| 7 | Lock Self from Jukebox | Pass | "Everything stopped with a fade": pianoroll, code and music together. The screen was then black until the next `set_sound`, as expected. |
| 8 | Old scene after a silence | Partial | Run 1: no fire under the caustics. Run 2: fire "very faintly" visible. Console: `[picture] scene {fade: 0.6, from: "fire", kept: true, level: 0.39, to: "caustics"}`. |
| 9 | Debug lines | Pass | `[picture]` lines appeared through the session: state, beat jump, level, scene. Excerpt below. |

## Numbers from test 1

Plain moods, no voice and no synth override. Joy 0.65–0.75, calm 0.7–0.75 throughout.

| Warmth sent | Wave | `reads_as` warmth | Gap | Note |
|---|---|---|---|---|
| 0.8 (first sound) | sine | 0.56 | 0.24 | first-sound note: "its wave follows your warmth (square, sawtooth, triangle, sine)" |
| 0.3 | square | 0.16 | 0.14 | "moved the wave of your voice from sine to square" |
| 0.1 | square | 0.10 | 0.00 | no note (no move) |
| 0.55 (extra) | triangle | 0.53 | 0.02 | "moved the wave of your voice from square to triangle" |
| 0.7 (Attuned, livelier) | sine | 0.77 | 0.07 | "moved … from triangle to sine" |

Later Self calls at warmth 0.7 to 0.75 on sine read 0.57 to 0.58 when brightness was "very low" and 0.71 when it was "low". The warm end seems to read low when the sound is very dark.

## Console excerpt (test 8, run 2)

```
[picture] scene  {from: null, level: 0, to: "fire"}
[picture] scene  {from: null, level: 0, to: "fire"}      ← logged twice
[picture] state  {at: 1794765599804, delay: 0, scene: "caustics", tau: 1.28, vol: 0.5}
[picture] beat jump {from: 890.47, to: 889.5}
[picture] level  {afterSilence: true, delay: 0, from: 0, span: 3, to: 1}
[picture] scene  {fade: 0.6, from: "fire", kept: true, level: 0.39, to: "caustics"}
```

There were also about 15 collapsed `[picture] scene` lines before these.

## Feedback for Claude Code

1. **Warmth reads low at the warm end.** 0.8 on sine reads 0.56, and 0.7 to 0.75 reads 0.57 to 0.58 when brightness is "very low". Since warmth now means darkness, a very dark sine should read warm, not middling. Check the warmth estimator's top end.
2. **No sawtooth band in practice.** 0.3 already gives square, and 0.55 gives triangle, so sawtooth sits in a narrow band somewhere between them, if at all. With four even bands, 0.3 should be sawtooth. Check the band edges, or document them in the tool description.
3. **Glide note on the first sound.** The first `set_sound` of a session says "tempo 75 to 71: it glides over 4 s", but nothing was playing before it. Drop the note, and the glide, when there is no previous sound.
4. **Attuned holds the level but not the tempo.** Switching into Attuned with a livelier mood jumped from 76 to 155 bpm and from 1/4 to 1/16. The Attuned rules say "never faster, louder or tenser than what is playing now". Hold tempo and density on entry the way the level is held, with a note.
5. **Crossfade the Strudel drawings.** Pianoroll → punchcard swaps instantly when the new code lands. A short crossfade, about 0.5 s, would match the rest of the picture. The owner agrees.
6. **Owner's proposal: a scene behind Strudel.** Whenever Strudel plays, also keep a non-Strudel scene that goes with the music. It is never shown while Strudel visuals are on (no pulse under the drawings: the owner likes that). It is shown, with its bpm motion, when the owner turns Strudel visuals off. There is no fixed default scene: it depends on the mood of the music. Claude picks it with `colour.scene` in `strudel_mode`, and the server falls back from the music's mood when Claude sends none. Toggling visuals crossfades between the drawings and the scene. Today, turning visuals off shows the stale synth scene (waves) with no pulse.
7. **Old scene still visible after a short silence (test 8, run 2).** The new scene arrived 1 s into a 4 s silence fade, so the fire was still at level 0.39, and with `kept: true` it faded over 0.6 s under the caustics. That was faint but visible. Run 1 was clean. When a new scene comes during a silence fade, take the old scene out from its current level, or don't keep it at all.
8. **Level restart after a partial fade.** In the same run, `[picture] level` reports `from: 0` (`afterSilence: true`) while the scene line reports `level: 0.39`. If the fade was only partway, starting the level from 0 could cause a dip. Check that the two agree.
9. **Beat jumps backwards.** `[picture] beat jump {from: 890.47, to: 889.5}` after the silence: the beat clock went back about one beat. Check whether that is intended.
10. **Console noise.** About 15 identical collapsed `[picture] scene` lines, and `from: null → fire` logged twice. Dedupe the scene log, or log only real changes.
11. **"Session type not supported"** in the player's Live line (seen on both versions) is unclear to a listener. Explain it or hide it.
12. **Release check.** The v0.19.2 player was not live at first (footer said v0.19.1), and the server also seemed old: the first-sound note had no wave part. Returning the server version in `start_session` would let Claude spot a stale deploy at once.
