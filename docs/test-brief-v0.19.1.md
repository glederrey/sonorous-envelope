# Test brief: Sonorous Envelope v0.19.1 (only the fixes)

Read this whole file first. v0.19.1 fixes what the v0.19.0 report found. Everything that passed in v0.19.0 is **not** tested again: the hand-over to the synth, the closing sequence, the controls panel blur, offering before a switch, the comfort case, going into Jukebox, guidance once per change, and the redirects. Run only the tests below. If the picture looks wrong, open the player with `?debug` at the end of the URL, repeat the run and send the lines starting with `[picture]` from the browser console.

Answer to the question in test 14: the page stays "How it works" (the v0.19.0 brief was out of date). Nothing to test.

## What changed

- **Mode names for you.** The tools now take `self`, `attuned` and `jukebox` (start_session and set_sound `mode`), and every result names the mode as the listener does: "Self", "Attuned", "Jukebox". The old names (internal, external, sandbox, inner, outer) are gone from the schemas and the guidance, and the tools no longer accept them. Use only Self, Attuned and Jukebox with the user.
- **Reconnect** the connector before you start: the tool schemas and the server instructions changed.
- `strudel_mode` refused in Self now returns `self_locked` (owner locked Self) or `self_mode` (on auto), not `internal_face`.
- `set_sound` with a `mode` while the owner has locked the mode is **ignored with a note** (not refused), so your sound still arrives. This is by design; the v0.19.0 brief was wrong to expect a refusal.
- `strudel_mode` and `set_sound` while Strudel plays now report the listener's reactions and mark them read.
- When the owner locks Self from Attuned or Jukebox, the synth sound made for the listener fades to silence (about 3 s). Your next `set_sound` starts from your own state: the mood you played for the listener is not kept.
- After an owner change Jukebox → Self → Jukebox, the note about the stopped pattern says you may start Strudel again (it no longer says "final").
- `silence` with end no longer gives advice about bringing the synth back.
- A new scene no longer inherits the old scene's density and speed. With Strudel, they follow the pattern's bpm.
- `reads_as` was recalibrated: warmth and joy should land close to what you send (within about 0.15) when you send only a mood.
- Self guidance: your own reaction may show, also unease, kept soft. Attuned guidance: start soft and slow, never faster, louder or tenser than what plays now.
- The player link goes in your final reply text, after your last tool call of the turn.
- Player: the Strudel code fades in from black (start, and "Strudel visuals" back on). After a silence, the old scene no longer comes back. The Mode row marks the mode in effect (a ring and a dot) while Auto stays filled. The Attuned hint fits one line. "How is it landing?" is now "Guide the sound". "Waiting for Claude" is now "Waiting for the AI". Pianoroll rows no longer jump: every row seen since the code started stays.

## Setup

Reconnect, `start_session` with no mode, and give the player link as the start note says. The user opens it on desktop and taps "Start listening".

## Tests (record pass, fail or partial, and what the user saw)

### Part A: start and names

1. **Player link.** Pass: the user sees the link in your reply text (not only inside a tool summary).
2. **Names.** Through the session, watch the host's tool summaries and your own words. Pass: only Self, Attuned and Jukebox (or self, attuned, jukebox in the tool calls); results say "Self", "Attuned", "Jukebox".
3. **Self lets unease show.** In Self, the user tells a short unsettling story (a bad dream). Pass: the sound shows some unease, softly (a touch of tension, slower or quieter), never louder or faster; the user says whether it felt honest and not alarming.
4. **reads_as.** In Self, send two or three plain moods (no voice change, no synth override) with warmth and joy far apart (for example warmth 0.8 joy 0.6, then warmth 0.3 joy 0.3). Pass: `reads_as` warmth and joy within about 0.15 of what you sent. A voice in a major, lydian or mixolydian scale still holds joy up (about +0.2), and warmth above 0.8 reads about 0.75: those are expected. Note the numbers and your voice's scale.

### Part B: Attuned and the player

5. **Attuned starts soft.** Offer Attuned after test 3, switch after a yes. Pass: the first Attuned sound is not faster, louder or tenser than what played; then it eases over long transitions.
6. **Mode row.** With the owner on Auto: Auto is filled, Attuned has the ring and dot. The Attuned hint fits on one line on desktop. Then the owner locks Attuned: Attuned is filled. Back to Auto. Pass: the mark follows the mode in effect.
7. **Labels.** Open the reactions block: it is titled "Guide the sound". Press two reactions: the line reads "Waiting for the AI: …". Pass: both texts as written.

### Part C: Strudel and Jukebox

8. **Code fade-in.** Switch to Jukebox (the user asks for a style), `strudel_mode` on with a pattern that uses `.pianoroll()`. Pass: the picture goes black, then the code and its drawing fade in together over about 1.5 s (no cut).
9. **Pianoroll rows.** Use a pattern whose parts come and go (sections with `.mask`, like the chiptune from the report). Watch for about 30 s. Pass: once the rows have all appeared, bars stay on their rows (empty rows are fine).
10. **Reactions while Strudel plays.** The user presses "faster" and "harsher", then you send new code with `strudel_mode`. Pass: the `strudel_mode` result lists the reactions, and the player's "Waiting for the AI" line clears.
11. **Scene speed.** While the pattern plays, `set_sound` with a new scene (for example circuit) and no density or speed. Pass: the scene moves at a pace that fits the bpm (not the slow motion of an earlier calm sound); the result's colour shows the speed it took.
12. **"Strudel visuals" back on.** Turn it off (fades to the scene), then on. Pass: the scene goes black, then the code fades in (no cut).

### Part D: owner changes

13. **Lock Self from Jukebox and back.** With the pattern playing, the owner locks Self, then locks Jukebox again, before your next call. Then call `get_feedback`. Pass: the note says the owner stopped the pattern and that Strudel is allowed again in Jukebox (not "final"); `strudel_mode` on works.
14. **Lock Self from Attuned (synth).** Owner to Auto, you switch to Attuned with a synth sound (no Strudel; `strudel_mode` off first if needed). The owner locks Self. Pass: the sound fades to silence within about 3 s. Your next `set_sound` (send your own mood) carries the Self guidance and the owner note. Then try `strudel_mode` on: refused with `self_locked`. Then `set_sound` with `mode: "attuned"`: ignored with a note "mode stays Self…".
15. **Old scene after a silence.** Owner back to Auto. On the synth, `set_sound` with fireflies, then `silence` (not end, fade 4), then within 1 to 2 s `set_sound` with caustics. Pass: the fireflies never come back; caustics come up from black.
16. **Ending.** Closing sound, then `silence` with end. Pass: the result has no advice about bringing the synth back.

## Report

One table: test, pass/fail/partial, what the user saw or said. Then any feedback for Claude Code, numbered.
