# Test brief: Sonorous Envelope v0.19.5 (only the fixes)

Read this whole file first. v0.19.5 fixes what the v0.19.4 report found. Everything that passed in v0.19.4 is **not** tested again. No reconnect is needed. Start a new session, open the player on desktop with `?debug`, and tap "Start listening".

## What changed

- **Visuals toggle, both ways a crossfade.** Turning "Strudel visuals" off now fades the drawings and their black background out together over 1.5 s while the scene comes up under them, the same as turning them on. No dip to black either way.
- **Lift after the pace hold.** The `pace held` line in `clamped` now also says: if the listener asked for more energy, send `set_sound` again right away with a transition of 8 s or more, so the sound rises to the pace they asked for.

## Tests (record pass, fail or partial, and what the user saw)

1. **Visuals off.** Jukebox, `strudel_mode` on with a pattern using `.pianoroll()`, no colour. The owner turns "Strudel visuals" off, waits, and turns them back on. Pass: both ways, the scene and the drawings crossfade; no moment of black.
2. **Lift.** From Self with a calm sound, offer Attuned; the user asks for a lift. Switch with a lively mood. Pass: the first result has `pace held` with the new advice, Claude sends a second `set_sound` straight away with a long transition, and the user hears the sound rise to a livelier pace over several seconds, with no jump.

## Report

Write the report as a Markdown file, `docs/test-report-v0.19.5.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what the user saw or said), then any feedback for Claude Code, numbered.
