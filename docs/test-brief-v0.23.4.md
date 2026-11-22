# Test brief: Sonorous Envelope v0.23.4

Read this whole file first. v0.23.4 fixes the two partial results of the v0.23.3 round (`docs/archive/test-report-v0.23.3.md`). Everything else passed and is not tested again.

Before you start: **reconnect the Sonorous Envelope connector**, start a new conversation and a new session. Gael opens the player on desktop.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly.

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns. Leave Live tuning off for test 2.

## What changed

- **Allow Strudel off, then on again**: the server now agrees with the player. The pattern is back in the session's state, so `get_feedback` shows Strudel playing with no "stopped" note, and your next `set_sound` only sets the picture (it cannot switch the engine while Strudel is on). After a lock to Self it stays off, as before.
- **Softer and calmer, on time.** The `set_sound` whose own `reactions` show "softer" is already at least 2 dB quieter than the last sound; one that shows "calmer" is no louder. The call after it is not lowered again.
- The one-call synth note rounds tempos and cutoffs to whole numbers.

## Tests

**Jukebox** (offer the switch in words, switch after his yes)

1. **Strudel stays Strudel.** Start a pattern with a drawing (`strudel_mode`). Ask Gael to turn "Allow Strudel" off, wait a few seconds, then on again, and tell you when he has. Then call `get_feedback`. Pass: `playing` shows Strudel and there is no "owner stopped your Strudel pattern" note. Then send one `set_sound` with a new colour. Pass: the pattern keeps playing. Ask:
   - Did the same pattern come back when Strudel was on again? (yes / no)
   - After your next sound update, is the pattern still playing, with its code and drawing? (yes / no)

**Attuned** (offer the switch, switch after his yes)

2. **Softer, on time.** Play a sound at a medium level and wait for Gael's next message. Ask him to press "softer" under "Guide the sound" and then write to you. Answer with one final `set_sound` with a calmer mood. Pass: that same result has `reactions: ["softer, …"]`, `clamped` with `level lowered: the listener asked for softer`, and `sound.loudness_db` at least 2 lower than before. On your next message, a plain `set_sound`: no `asked for` in `clamped`. Ask:
   - Was the answer to "softer" quieter, right away? (yes / no)

## Report

Write the report as a Markdown file, `docs/test-report-v0.23.4.md`: a short header (date, session id, server version, device and browser), one table (test, pass / fail / partial / not run, what Gael saw or said, tool fields that matter), then any feedback for Claude Code, numbered.
