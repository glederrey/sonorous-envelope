# Test report: Sonorous Envelope v0.23.5

- **Date:** 2026-11-22, 15:41–15:45 (Europe/Zurich)
- **Session id:** eU7ZZbve6AffwaFp9ule0F9o
- **Server version:** v0.23.5 (from `start_session`)
- **Device and browser:** Gael's desktop (browser not noted); Live tuning off throughout
- **Tester:** Claude (claude.ai project), connector reconnected before the session

## Results

| # | Test | Result | What Gael saw or said | Tool fields that matter |
|---|------|--------|-----------------------|-------------------------|
| 1 | Softer holds (Attuned) | Pass | Answer was quieter: yes. Stayed quieter on the next sound: yes, "a bit faster" | Answer: `reactions: ["softer, 7 s ago"]`, `notes: "level: the listener asked for softer, so everything plays 2 dB lower from now on (-2 dB in all, -10 at most)…"`, `loudness_db` −28 → −30. Next plain call: no `level:` note, `loudness_db` −30. Same call also had `tempo 83 to 91` (see feedback 3) |
| 2 | Harsher brings it back | Pass | Level came back up: yes | `reactions: ["harsher, 7 s ago"]`, `notes: "level: the listener's harsher raised the level 2 dB (back to the usual level)"`, `loudness_db` −30 → −27 (mood slightly livelier: +1 dB from the mood) |
| 3 | Self is at the usual level | Pass | Self at the usual level and Attuned quieter again: yes. "2 dB is a very small change", but fine for him | Softer again: `loudness_db` −27 → −29 with the `level:` note. Self (same mood): −27, no level note. Attuned again (same mood): −29, no level note |
| 4 | Softer on a pattern (Jukebox) | Pass | Quieter, smoothly, no restart: yes. Colour changed to orange: yes | Pattern at 76 bpm, `pattern.ran: true`, 22 events/cycle. Colour-only `set_sound`: `reactions: ["softer, 4 s ago"]`, `notes: "level: … 2 dB lower from now on (-4 dB in all, -10 at most)…"` (no `loudness_db` for Strudel) |
| 5 | The pace after Strudel | Pass | New sound started at about the pattern's pace, not faster: yes | `strudel_mode` on false, then in the same message `set_sound` mode attuned, calm 0.3: `clamped: "pace held: the first sound of a switch to Attuned is no faster or busier than what played (tempo 142 to 76 bpm)…"`, `playing.tempo: 76`, `loudness_db` −35 |

## Feedback for Claude Code

1. **The 2 dB step feels small (Gael).** Gael heard every step, but he finds 2 dB a very small change for a "softer" press. Consider 3 dB per press, or a bigger first step.
2. **No note about the listener's level on a mode switch.** Going Attuned → Self put the level back to usual (−29 → −27), and Self → Attuned put the −2 dB back (−27 → −29), but neither switch result says so. The model only sees it by comparing `loudness_db`. Expected: a short note on the switch, for instance `level: back to the usual level in Self` / `level: the listener's −2 dB applies again`.
3. **Softer arrived together with a tempo rise (test 1).** The first `set_sound` after switching to Attuned was pace-held at 83 bpm. The next call, which answered "softer", released the hold: `tempo 83 to 91: it glides over 4 s`. So the sound got quieter and faster at once, and Gael noticed "a bit faster". Nothing is wrong with the level, but it muddies what the listener hears after pressing softer. Suggest the brief play one plain sound after the switch before asking for the press (or say that the hold releases on the next call).
4. **Pace-held wording after Strudel (test 5).** The `clamped` line is the generic one ("no faster or busier than what played (tempo 142 to 76 bpm)"). It does not say the 76 is the pattern's bpm. The brief's `pace held: … tempo X to <the pattern's bpm> bpm` matches in substance. A clause such as "the pattern's tempo" would make it clearer to the model.
5. **Arp rate not held after Strudel (outside the brief).** In the same test 5 call, the tempo was held to 76 but `rate` went to `1/16` (the synth's last rate was `1/8`) and density was not mentioned. If "no busier" is meant to cover the step rate after a pattern too, it was not applied. If the pattern's busyness can't be compared to the synth's, maybe say so in the note.
6. **Outside the brief: a big jump right after the hold.** The next plain `set_sound` with the same energetic mood (turn 12) glided `tempo 76 to 142` over the default 4 s, at `density: dense`. That follows the rule ("the next call may move them"), but it nearly doubles the tempo in 4 s, right after a hold meant to avoid a jump. Consider stretching the default transition when the tempo leaves a hold by a large step.
7. **Minor, outside the brief: turn numbers.** The Jukebox switch `set_sound` and the `strudel_mode` after it both returned `turn: 9`; `strudel_mode` off and the Attuned `set_sound` both returned `turn: 11` (already noted in v0.23.3).
