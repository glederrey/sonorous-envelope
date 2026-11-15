# Test brief: Sonorous Envelope v0.19.2 (only the fixes)

Read this whole file first. v0.19.2 fixes what the v0.19.1 report found. Everything that passed in v0.19.1 is **not** tested again. Run only the tests below. No reconnect is needed (the tool schemas did not change), but start a new session.

To see what the picture does, open the player with `?debug` at the end of the URL: the browser console now prints lines starting with `[picture]` (scene changes and their fades, Strudel view on/off, new code). This was broken on the live site before.

## What changed

- **Warmth reading.** Without a voice of your own, your first sound becomes your voice, and now its wave follows your warmth in bands (sine warm, triangle, sawtooth, square cold), the way its scale follows joy. A note says when the wave moves. A voice you send, or `keep_voice`, still fixes the wave. The warmth explanation now says "darkness" where it said "brightness".
- **Calm** was checked and not changed: sent calm above about 0.81 all maps to the same sound (the top of the range), so 0.88 and 0.92 play the same tempo. A 1 bpm difference comes from joy (it scales the tempo by ±10%).
- **Attuned starts no louder.** The first sound after you switch into Attuned is held at the level of what played (a note says so). Self is unchanged.
- **Strudel motion.** Unless you set the colour motion yourself, it follows the pattern's bpm: pulse from 110 bpm, drift from 80, breathe below.
- **No tempo glide after a silence.** After `silence` (once its fade is over) or the owner's lock to Self, your next sound starts at its own tempo; no "tempo X to Y" note.
- **Player.** The mode in effect has a teal ring (no dot). New Strudel code no longer cuts the music or flashes the picture: the old code plays to the next bar, then the new one starts, and the drawings stay until the new code's drawings arrive. When the owner locks Self from Jukebox, the pianoroll fades with the code. The pianoroll shows note names by default (`labels: 0` turns them off). After a silence, the old scene clears within about 0.6 s when a new scene comes.

## Setup

`start_session` with no mode, give the player link, the user opens it on desktop with `?debug` at the end of the URL, opens the browser console, and taps "Start listening". Send no voice of your own.

## Tests (record pass, fail or partial, and what the user saw)

1. **Warmth with your adopted voice.** In Self, send plain moods (no voice, no synth override): warmth 0.8, then warmth 0.3, then warmth 0.1 (other axes as you like). Pass: `reads_as` warmth within about 0.2 of what you sent each time, and a note says the wave of your voice moved when warmth crossed a band. Note the numbers and the waves.
2. **Attuned no louder.** Offer Attuned, switch after a yes, with a mood that would be livelier than what plays. Pass: the result's level is not above the previous one (a note may say it was held). The user hears no jump.
3. **No tempo glide after a silence.** Still in Attuned: `silence` (not end, fade 3), wait about 5 s, then `set_sound` with a clearly different calm. Pass: no "tempo X to Y" note; the sound comes in at its new tempo.
4. **Mode row.** With the owner on Auto: Attuned has a teal ring and no dot; Auto stays filled. Pass: the two marks are easy to tell apart, on the light and the dark theme if the user can switch.
5. **New code, no cut.** The user asks for a style (Jukebox), `strudel_mode` on with a pattern using `.pianoroll()`. Then send new code twice: once switching to `.punchcard()`, once the same music faster. Pass: no gap in the music at each change (the new code comes in on the next bar), no flash of the picture; the drawing changes when the new code starts. The pianoroll shows note names.
6. **Motion at a fast tempo.** One of the patterns at 140 bpm or more, with no colour motion set. Pass: the colour pulses with the beat (the result's colour shows motion pulse).
7. **Lock Self from Jukebox.** With the pianoroll pattern playing, the owner locks Self. Pass: the pianoroll fades out together with the code and the music, it does not vanish at once.
8. **Old scene after a silence.** Owner back to Auto. On the synth: `set_sound` with the fire scene, then `silence` (not end, fade 4), then about 1 s later `set_sound` with caustics. Run it twice. Pass: no fire visible under the caustics fade-in either time. The console shows a `[picture] scene` line with `fade: 0.6`.
9. **Debug lines.** Pass: the console showed `[picture]` lines through the session. Paste a few, for test 8 at least.

## Report

Write the report as a Markdown file, `docs/test-report-v0.19.2.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what the user saw or said), then the numbers from test 1, then any feedback for Claude Code, numbered.
