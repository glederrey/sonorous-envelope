# Test report: Sonorous Envelope v0.19.1

Date: 2026-11-15 · Session `cUgxLOk37FaExcJoZTVUUPki` · Desktop (Brave)

## Results

| # | Test | Result | What the user saw or said |
|---|---|---|---|
| 1 | Player link | Pass | Link seen in the reply text. |
| 2 | Names | Pass | Only Self, Attuned, Jukebox in calls and results ("Self, locked by the owner", "Jukebox"…). |
| 3 | Self lets unease show | Pass | Darker (lydian → phrygian, tension 0.3) and slower (69 → 53 bpm). Honest; uneasy but not alarming. Server reported −26 → −22 dB, but the user didn't hear it get louder. |
| 4 | reads_as | Partial | Joy within about 0.15 every time. Warmth fails for low values (see below). |
| 5 | Attuned starts soft | Pass | Slower (63 → 58 bpm), very gentle, eased over 25 s. Server reported +1 dB (−27 → −26). |
| 6 | Mode row | Pass | Mark follows the mode in effect; the Attuned hint fits one line. |
| 7 | Labels | Pass | "Guide the sound" and "Waiting for the AI: …" as written. |
| 8 | Code fade-in | Pass | Code and pianoroll faded in together; the user wasn't sure the picture went black first. |
| 9 | Pianoroll rows | Pass | Rows stable after all parts appeared. Punchcard also stable. |
| 10 | Reactions while Strudel plays | Pass | Result listed "harsher" and "faster"; the "Waiting for the AI" line cleared. |
| 11 | Scene speed | Pass | Circuit took speed 0.87 at 160 bpm; pace fit the music. Turning visuals off went black, then circuit. |
| 12 | "Strudel visuals" back on | Pass | Black, then code faded in, no cut. |
| 13 | Lock Self from Jukebox and back | Pass | Note: "Strudel is allowed… start it again" (not "final"); `strudel_mode` on worked. |
| 14 | Lock Self from Attuned (synth) | Pass | Faded to silence and black. Next `set_sound` carried Self guidance and owner note; `strudel_mode` refused with `self_locked`; `mode: "attuned"` ignored with "mode stays Self…". |
| 15 | Old scene after a silence | Partial | Run 1 (calls < 1 s apart): no audible silence, direct crossfade. Fireflies runs: hard to judge (flashing). Fire, 1 s gap: run 1 showed a faint bit of fire during the caustics fade-in, run 2 clean. |
| 16 | Ending | Pass | `silence` end result had no advice about bringing the synth back. |

### Test 4 numbers (voice root E, no voice sent, scale follows joy)

| Sent warmth / joy | Scale | reads_as warmth | reads_as joy |
|---|---|---|---|
| 0.8 / 0.6 | dorian | 0.88 (+0.08) | 0.43 (−0.17) |
| 0.3 / 0.3 | phrygian | **0.67 (+0.37)** | 0.17 (−0.13) |
| 0.55 / 0.8 | lydian | 0.73 (+0.18) | 0.66 (−0.14) |

## Feedback for Claude Code

1. **The `reads_as` warmth reading has a floor of about 0.67.** Warmth 0.3 read as 0.67, and `reads_why` said "lifted by brightness" while the same result listed brightness as "very low". The colder mood also got a higher cutoff (1452 Hz) than the warm one (775 Hz).
2. **The lydian joy lift didn't show.** Joy 0.8 in lydian read as 0.66, but the brief expects about +0.2.
3. **The calm reading tops out at about 0.72–0.74.** Raising calm from 0.88 to 0.92 made the tempo go up (58 → 59 bpm).
4. **The level goes up where it shouldn't.** Self unease went up 4 dB (−26 → −22), and the first Attuned sound went up 1 dB (−27 → −26). Neither was audible, but both break "never louder" as written.
5. **Mode row colour.** When on Auto, the mode in effect should be teal, not orange, to set it apart from the owner's choice. The dot is unclear.
6. **New Strudel code makes a short audio cut and a flash** where the code vanishes and reappears. It happened on each code change: pianoroll → punchcard, punchcard → pianoroll, and the faster version.
7. **When the owner locks Self from Jukebox, the pianoroll vanishes at once** while the code and music fade. It should fade with them.
8. **Pianoroll note labels.** The pianoroll shows no note names by default; `.pianoroll({labels: 1})` worked. Consider it as the default, or mention it in the guidance.
9. **Colour motion stays "breathe" at 160 bpm in Strudel.** It's left over from the calm mood; motion should probably follow the bpm too.
10. **`set_sound` within about 1 s of `silence`.** The fade barely shows (no audible dip), and the old scene sometimes bleeds faintly into the new one: one of two fire runs.
11. **`?debug=1` gave no `[picture]` lines**, even with Verbose on. The debug panel lines did show. Check whether the flag must be exactly `?debug`, or whether the logging is wired up.
12. **Tempo after an owner Self lock from Attuned.** The next `set_sound` reported "tempo 60 to 71", so the glide started from the Attuned tempo. Check whether "starts from your own state" should include the tempo.
13. **Scene density and speed come from the mood (not a bug).** On the synth, fireflies, fire and caustics all took density 0.75 and speed 0.25 from the same mood, so nothing is inherited from the previous scene.
