# Test report: Sonorous Envelope v0.23.4

- **Date:** 2026-11-22, 15:15–15:21 (Europe/Zurich)
- **Session id:** OpNd5pocC-5Gjj7q5lllmSaE
- **Server version:** v0.23.4
- **Device and browser:** desktop player (browser not recorded)
- **Tester:** Claude (claude.ai project); listener and owner: Gael
- **Connector:** reconnected before the session

| # | Test | Result | What Gael saw or said | Tool fields that matter |
|---|------|--------|-----------------------|-------------------------|
| 1 | Strudel stays Strudel (Jukebox) | **pass** | Pattern playing with code and pianoroll. "Allow Strudel" off then on: "came back normally", the same pattern. After the colour-only `set_sound`, it was still playing with code and drawing, and the picture turned pink/magenta. | `get_feedback` after off/on: `playing.engine: "strudel"`, `bpm: 96`, `pattern.ran: true`, `events_per_cycle: 11`, no "owner stopped your Strudel pattern" note. Next `set_sound` (colour h 320): `playing.engine: "strudel"`, `colour.h: 320`, no notes. |
| 2 | Softer, on time (Attuned, Live tuning off) | **pass** | Medium level before the press. The answer to "softer" was quieter right away: "it faded correctly to a softer quieter sound". He did not notice the level coming back on the next call; the music still sounded soft (see feedback 1). | Answer: `reactions: ["softer, 21 s ago"]`, `clamped: ["level lowered: the listener asked for softer, so this sound plays 2 dB below your last (it would have been 0 dB louder)"]`, `loudness_db` −28 → −30, `volume` 0.5 → 0.4. Next plain `set_sound`: no `clamped`, `loudness_db` −28, `volume` 0.5. |

## Feedback for Claude Code

1. **"Softer" lasts one call.** What happened: the answer to "softer" played at −30 dB (`volume` 0.4). The next plain `set_sound`, with the same mood, put it back to −28 dB (`volume` 0.5), the level from before the press, with no note. Gael did not hear the rise: a 2 dB change over a 4 s transition is subtle, and the calmer arrangement (tempo 108 → 68, rate 1/8 → 1/4, sparse, cutoff 1405 → 1024 Hz, drone on) still sounded soft. The brief's rule ("the call after it is not lowered again") was met. Expected (listener's view): a "softer" request holds until the listener or the model asks for more. Suggest keeping the lowered level for later calls (as with the stack, pad and LFOs), or at least adding a note such as `level back to the mood's −28 dB (softer lasted one call)`. The v0.23.2 report (item 4) raised the same pattern for one-call synth values.
2. **Outside the brief: a calmer mood is not quieter.** The clamp said the calmer mood (calm 0.5 → 0.75) "would have been 0 dB louder", so all of the 2 dB drop came from the clamp. The closing sound, with calm 0.9 (tempo 59), measured `loudness_db` −27, 1 dB *louder* than the calm 0.75 sound (−28). The guidance says calm is arousal (tempo, density, loudness), so more calm should bring the level down, or at least not up.
3. **Outside the brief: faster at the switch to Attuned.** After `strudel_mode` off (Strudel at 96 bpm; the last synth sound was at 76 bpm), the switch to Attuned with a calm 0.5 mood started at `tempo: 108`, rate 1/8, with no `pace held` clamp. The Attuned guidance says to start "never faster … than what is playing now". The synth was silent at that moment (volume 0 after Strudel off), so maybe nothing counted as "playing now". Worth deciding which tempo the pace hold should compare against after leaving Strudel.
4. **Brief wording, test 2.** The pass rule for the follow-up call checks only that `clamped` has no "asked for". If keeping the softer level is not the intent, the brief could say so ("the level may return to the mood's level"); if it is, the follow-up should also check `loudness_db` stays lowered.
