# Test brief: Sonorous Envelope v0.23.5

Read this whole file first. v0.23.5 answers the three findings of the v0.23.4 round (#170), with Gael's choices: "softer" now holds, the instructions no longer say calm moves loudness, and a switch to Attuned right after Strudel is held to the pattern's tempo. Only these are tested.

Before you start: **reconnect the Sonorous Envelope connector** (the instructions changed), start a new conversation and a new session. Gael opens the player on desktop. Leave Live tuning off unless a test says otherwise.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly.

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns.

**Give a change time to be heard.** After a `set_sound`, wait for Gael's next message before the next one, so a transition is not cut short.

## What changed

- **The listener's level.** Each "softer" the listener presses lowers the session's level by 2 dB, and it **holds** on later calls, down to −10 dB. Each "harsher" or "stormier" raises it 2 dB back toward the usual level. Only the listener's presses move it; you cannot. The call that answers the press says so in `notes`: `level: the listener asked for softer, so everything plays 2 dB lower from now on (−2 dB in all, −10 at most) …`, or `level: the listener's harsher raised the level 2 dB …`. It applies to the synth and to a Strudel pattern. In Self the sound plays at the usual level (nobody can press there); the listener's level comes back in Attuned or Jukebox. `reads_as` reads the sound at the usual level, so a lower level does not read as calmer: do not correct for it.
- **Calm** is arousal through tempo and density; loudness is the listener's (the server instructions now say "Calm is arousal (tempo, density)").
- **After Strudel.** Within 30 s of `strudel_mode` off, a switch to Attuned is held to the pattern's tempo (`clamped`: `pace held: … tempo X to <the pattern's bpm> bpm`).

## Tests

**Attuned** (offer the switch in words, switch after his yes)

1. **Softer holds.** Play a sound at a medium level. Ask Gael to press "softer" under "Guide the sound", then write to you. Answer with one final `set_sound`. Pass: its `reactions` show "softer", `notes` has `level: the listener asked for softer … (−2 dB in all`, and `sound.loudness_db` is about 2 lower than before. On his next message, send a plain `set_sound` with the same mood. Pass: no `level:` note, and `loudness_db` stays about 2 lower than before the press. Ask:
   - Was the answer to "softer" quieter? (yes / no)
   - Did it stay quieter on the next sound? (yes / no)
2. **Harsher brings it back.** Ask Gael to press "harsher", then write. Answer with one final `set_sound`. Pass: `notes` has `level: the listener's harsher raised the level 2 dB (back to the usual level)`. Ask:
   - Did the level come back up? (yes / no)
3. **Self is at the usual level.** Ask Gael to press "softer" again, answer it, then offer Self and switch after his yes. Pass: the Self sound is back at the usual level (`loudness_db` about 2 higher than the softened one). Then offer Attuned again and switch after his yes. Pass: the level is lowered again (about 2 dB under the usual level). Ask:
   - Did Self sound at the usual level, and Attuned quieter again? (yes / no)

**Jukebox** (offer the switch, switch after his yes)

4. **Softer on a pattern.** Start a Strudel pattern (`strudel_mode`). Ask Gael to press "softer", then write. Answer with one `set_sound` that only changes the colour. Pass: `notes` has the `level:` line. Ask:
   - Did the pattern get quieter, smoothly, without restarting? (yes / no)
5. **The pace after Strudel.** With a pattern at a slow tempo (80 bpm or less) playing, call `strudel_mode` with on false, then, in the same message, offer nothing: switch straight to Attuned with `set_sound` mode attuned and an energetic mood (calm 0.3), after asking Gael's yes first in the previous message. Pass: `clamped` has `pace held: … tempo … to <the pattern's bpm> bpm`, and `playing.tempo` is the pattern's bpm. Ask:
   - Did the new sound start at about the pattern's pace, not faster? (yes / no)

## Report

Write the report as a Markdown file, `docs/test-report-v0.23.5.md`: a short header (date, session id, server version, device and browser), one table (test, pass / fail / partial / not run, what Gael saw or said, tool fields that matter), then any feedback for Claude Code, numbered.
