# Test report: Sonorous Envelope v0.23.2 (full pass before v1.0.0)

- **Date:** 2026-11-22, 14:09–14:32 (Europe/Zurich)
- **Session id:** `7msuKG9e55dEf7Hwu1mDcmRM`
- **Server version:** v0.23.2 (from `start_session`)
- **Tester:** Claude (claude.ai, project "Sonorous Envelope: tests"), Gael as listener and owner
- **Devices:** desktop player (browser not recorded); Gael's phone for tests 12, 18 (private window, as a guest), 21 and 24

## Results

| # | Test | Result | What Gael saw or said | Tool fields that matter |
|---|------|--------|-----------------------|-------------------------|
| 1 | Start | Pass | Player opened and started after one tap; badge "Self". | Voice D3 dorian, chord [1,3,5,7], up_down, 2 oct, triangle; `players: 0` before he opened the player. |
| 2 | Your sound (calm, brighter, tense) | Pass | Changes arrived smoothly, no level jump; colour followed the sound. | Calm read within 0.15. Brighter: joy read 0.51 against 0.85 (`held down by mode`), **one correction** (voice to D mixolydian), then 0.78. Tense (tension 0.7) read tension 0.73; `clamped: level held … +9 dB … kept to +4 dB`. |
| 3 | Tempo and rate notes | Pass | (no question in the brief) | `rate 1/4 to 1/16: it steps through 1/8 over 12 s`; `tempo 84 to 120: it glides over 10 s`; new mood without `synth` gave `rate 1/16 to 1/4: it steps through 1/8 over 12 s`, so the rate follows the mood again (v0.23.1's sticky rate is fixed). See feedback 4. |
| 4 | Motif and kept moment | Pass | The phrase played once; recall brought the earlier sound back. | `motif kept as "opening"`; `kept: "calm mixolydian"`; `list` shows the moment and the motif; recall: `recalled "calm mixolydian" (kept at turn 9)`. |
| 5 | What you can check | Pass | "What the AI can see" showed the green network picture with "The AI looked at this … ago". | `inspect history` listed turns 4–11; `get_feedback` answered (no picture yet); `inspect snapshot` returned turn 10, `age_s: 17`, "of an earlier sound…". |
| 6 | Controls | Pass | Mute/unmute, volume, fullscreen and exit, hide controls, Copy link and QR code all work. | — |
| 7 | What I heard | Pass | Pressed "Calm" and "tender". | `heard: ["tender, 7 s ago", "calm, 8 s ago"]`; matched the intent, so not acted on. |
| 8 | Visuals | Pass | Each option changes the picture at once; picture stays sharp after a minute on another tab. | — |
| 9 | Save when asked | Pass (visual note) | Page black until Start listening, then fades in; same sound and picture; no Rename button. **During the fade-in the colour is brighter in the middle and darker in the corners**; it should be even. See feedback 2. | `saved: "Calm and tender"`, `by: "listener"`, url `/m/0e2xoX8lSyqm4zsqPF29ow`. |
| 10 | Twice, and your own | Pass | — | Second save: `already: true`, same url, first name. Own save on a new sound: `by: "you"` ("Fireflies at turn 17"). Next message, new sound: `ai_too_soon`, "…less than 5 messages ago…". |
| 11 | The bookmark | Pass | Card showed "Saved", the name, Rename, Open and Copy link; it faded by itself; a second press said "Already saved"; Rename works. | — |
| 12 | Moments page | Pass (phone layout note) | All moments there, newest first, right "Saved by"; count inside the search ("6 saved"); search and the three filters narrow the list; Rename works; Delete opens "Delete for good", and the old link shows "This page went quiet.". **On the phone the Rename row wraps** (input + Save on one line, Cancel below). See feedback 3. | — |
| 13 | The 404 | Pass | The first note plays in full; the waves swell amber and settle back to teal; the 0 stays round. | — |
| 14 | Lock and Auto | Pass | Locked to Attuned, then set back to Auto. | `mode: "Attuned, locked by the owner"`, note "the owner switched the mode to Attuned", Attuned guidance once; I followed it (78 → 69 bpm, no louder). After Auto: `mode: "Attuned"` (see feedback 6). |
| 15 | The switch to Attuned | Pass | The change was gentle. | Went back to Self first (with Gael's yes), then offered Attuned. `clamped`: `pace held` (density 0.70 to 0.66) and `level held` (+1 dB kept to the same level); tempo 78 → 60. |
| 16 | Guide the sound | Pass (note) | Pressed calmer and softer. | `reactions: ["softer, 8 s ago", "calmer, 9 s ago"]`; next sound calmer (59 bpm, brightness very low, drone 0.3). The level rose by 1 dB, though (see feedback 5). |
| 17 | Live tuning | Pass | The status line said the AI was listening, with a countdown. | `listen` returned "brighter" (`waited_s: 0`), "more of this (go further in the direction of your last change)", and "faster"; each answered with one final `set_sound`; the fourth `listen` returned `idle` after 20 s. |
| 18 | Guests | Pass | 7 emojis in one row on the phone; presses float over the desktop picture and the Guest reactions card counts them; card compact with equal columns; the guest can change nothing else. Pressed 😊 once. | `players: 2`; `guests: "😊 1, over the last 1 min"`. |
| 19 | Strudel (Jukebox) | Partial | The pattern plays with its pianoroll and code. **"Allow Strudel" off stops it, but on again does not bring it back.** It played again only after I resent `strudel_mode`. "Strudel code" off hides the code and keeps the drawing. | Switched after his yes ("a chiptune inspired by Beethoven": Für Elise, square/triangle/bd/hh/sd, 110 bpm). `pattern.ran: true`, `events_per_cycle: 16.5`. No result mentioned that Strudel had been turned off. See feedback 1. |
| 20 | A Strudel moment | Pass | The saved page plays the same pattern with its drawing. | `saved: "Chiptune Für Elise"`, `by: "listener"`, url `/m/69Ma621BQtCEjS4sOsiy1A`. |
| 21 | Phone player | Pass | Starts after one tap; controls fit without sideways scrolling; sound goes on with the screen locked, with the lock-screen player; Moments page fits, filters in one row. | — |
| 22 | Note to the developers | Pass | — | `tell_developers` kind `bug` (the Strudel resume issue from test 19): `sent: true`. |
| 23 | Silence and end | Pass | The closing sound played, then faded; the player says "This session has ended.". | `strudel_mode` off, then `set_sound` (calm, quote of "opening", first 3 notes, 10 s), then `silence` fade 20, `end: true`: "the fade starts in 6 s…". |
| 24 | Settings | Pass | Claude listed once ("Since 08/11/2026 · Last connected 22/11/2026"); "Last connected" on its own line on the phone. | — |
| 25 | Delete account | Not run | Gael will run it with Claude Code just before the v1.0.0 release. | — |

## Feedback for Claude Code

1. **Strudel does not resume after "Allow Strudel" is turned back on (test 19).** What happened: in Jukebox with a pattern playing, Gael turned "Allow Strudel" off (the pattern stopped), then on again. The pattern stayed silent until I sent `strudel_mode` again with the same code. None of my results (`set_sound`, `strudel_mode`) mentioned that Strudel had been turned off or on. Expected: the pattern resumes on the next bar when Strudel is allowed again, or the next result carries a note that it stopped and must be sent again. (Also sent with `tell_developers`.)
2. **Fade-in on `/m/<id>` is uneven (test 9).** What happened: while the colour fades in after Start listening, the middle is brighter and the corners darker, like a radial gradient; once the fade ends it is even. Expected (Gael): the fade-in is even across the whole screen.
3. **Moments page, phone: Rename row (test 12).** What happened: after Rename, the name input and Save sit on one line and Cancel wraps to a second line. In the edited row the Rename button also looks slightly offset from Open, Copy link and Delete. Expected (Gael): the input, Save and Cancel all on one line.
4. **Outside the brief: `synth` values lasting one call move the sound on the next call.** Rate-only call (test 3): I sent `synth.arp.rate: "1/16"` only, and the tempo also went from 90 to 84 (`tempo 90 to 84: it glides over 12 s`), because the 90 bpm from the previous `synth` had expired. Same pattern after live tuning: a plain "keep the mood" call (turn 31) put the tempo from 80 back to 88 (just after Gael asked for "faster") and the cutoff from 2400 back to 1313 Hz (after "brighter" and "more of this"). This matches "for this call only", but it is easy to undo a listener's request by accident. Maybe add a note, such as `tempo back to the mood's 88 (your synth tempo lasted one call)`, or keep the arp tempo like the stack, pad and LFOs.
5. **Outside the brief: "softer" cannot lower the level (test 16).** At the switch to Attuned, `level held` kept the volume at 0.45. On the next call, the calmer mood (the answer to "calmer" and "softer") brought its own volume of 0.5 back: −28 → −27 dB, louder by 1 dB. The model has no direct volume (`synth.volume` does not exist), so "softer" can only go through brightness and the drone level. Maybe have calm raise lower the mood's level, or keep the held level across the next call in Attuned.
6. **Outside the brief: after an Attuned lock is set back to Auto, the mode stays Attuned (test 14).** `mode: "Attuned"` with no switch note. That seems reasonable, but test 15 assumed Self, so I went back to Self (with Gael's yes) before offering Attuned. Worth saying in the brief or the docs which mode Auto resumes in.
7. **Outside the brief: `sound.brightness` word does not move with the cutoff.** It stayed "low" as the cutoff went 829 → 1600 → 2400 Hz (turns 27–30, triangle wave). Either the bands are wide or the word follows something other than the cutoff.
8. **Outside the brief: a few `reads_as` drifts under 0.3** (not corrected, to keep the tests clean):
   - Tense sound: warmth read 0.67 against 0.4 sent (`lifted by soft_timbre, darkness`).
   - Regular 1/16 up_down arp: spontaneity read 0.6 against 0.35 sent (`lifted by timing_irregularity, note_order`), though nothing in it was irregular.
   - Network scene sound: warmth read 0.59 against 0.35 sent.
9. **Outside the brief: `moment recall` gives no tempo or rate notes.** Recalling "calm mixolydian" moved the tempo from 106 to 60 and the rate from 1/8t to 1/4 over 8 s, but the result had only `recalled "calm mixolydian" (kept at turn 9)`. A `set_sound` with the same change returns `tempo …` and `rate …` notes.
