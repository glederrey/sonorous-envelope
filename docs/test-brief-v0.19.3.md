# Test brief: Sonorous Envelope v0.19.3 (only the fixes)

Read this whole file first. v0.19.3 fixes what the v0.19.2 report found. Everything that passed in v0.19.2 is **not** tested again. Run only the tests below. Reconnect the connector if you can (one tool description changed: `strudel_mode` colour), then start a new session.

Open the player on desktop with `?debug` at the end of the URL, open the browser console, and tap "Start listening". Send no voice of your own.

## What changed

- **Warmth reading.** Refitted. Brightness is now judged against the pitch of the notes (a sine spread over three octaves is still a soft timbre, it read 0.56 for 0.8), and roughness counts the overtones the wave really has. Server-side runs on 20 sessions: sent 0.8, 0.3, 0.1, 0.55 read 0.74–0.84, 0.30–0.46, 0.05–0.31, 0.62–0.71.
- **Wave bands.** Four even bands of the warmth you send: below 0.25 square, to 0.5 sawtooth, to 0.75 triangle, from 0.75 sine (a neutral 0.5 is triangle). The same for the mapping and for your adopted voice. A band only changes once you are 0.05 (stretched) past its edge.
- **No glide on the first sound.** The first `set_sound` of a session no longer says "tempo X to Y": nothing played before it.
- **Attuned holds the pace too.** The first sound after switching into Attuned is no faster and no busier than what played: tempo, step rate and density are held (`clamped` says "pace held"), like the level. The next call may move them.
- **Scene behind Strudel.** A pattern now carries a scene that goes with the music: yours if you send `colour.scene` in `strudel_mode`, else one picked from your last mood with calm read from the bpm (always one: a mood that fits none gets one from the tempo). It is hidden while the Strudel drawings show, and appears when the owner turns "Strudel visuals" off. From 110 bpm the scene moves on the beat (`sync: beat`).
- **Strudel drawings crossfade** over 0.5 s when new code's drawings arrive.
- **Old scene after a short silence.** The old scene fades out from the level it really had, and is dropped if it had almost faded. A fade in from silence starts when the state arrives, so a late state no longer pops in.
- **Console.** Repeated `[picture]` lines are dropped, and no scene is logged during a silence.
- **Live line.** The debug "Live" line names the audio session type only where it exists (iOS).
- **Version.** `start_session` returns `version`.

## Tests (record pass, fail or partial, and what the user saw)

1. **Version.** Pass: the `start_session` result has `version: "v0.19.3"`. If not, stop: the deploy is stale.
2. **First sound.** Your first `set_sound` (plain mood, in Self). Pass: no "tempo X to Y" note.
3. **Warmth and waves.** Still in Self, plain moods (no voice, no synth override), other axes steady: warmth 0.8, then 0.3, then 0.1, then 0.55. Pass: the waves are sine, sawtooth, square, triangle (a note each time the wave moves), and `reads_as` warmth is within 0.2 of what you sent each time. Note the numbers.
4. **Attuned pace.** Offer Attuned; after a yes, switch with a mood clearly livelier than what plays (low calm, high spontaneity). Pass: tempo and rate stay where they were, `clamped` has "pace held", and the user hears no jump in speed or volume. The next call may speed up.
5. **Scene behind Strudel.** The user asks for a style (Jukebox). `strudel_mode` on, a pattern at 140 bpm or more with `.pianoroll()`, no colour. Then the owner turns "Strudel visuals" off, and back on. Pass: with them off, a scene (not the old synth scene) shows and moves with the beat; switching back, the drawings come back over it without a cut. Then send the pattern again with `colour: { scene: "fireworks" }` (or another), visuals off. Pass: that scene shows.
6. **Drawings crossfade.** Visuals on, send new code switching `.pianoroll()` to `.punchcard()`. Pass: the old drawing fades into the new over about half a second, no hard swap, no gap in the music.
7. **Old scene after a short silence.** Owner on Auto, synth: `set_sound` with the fire scene, then `silence` (not end, fade 4), then about 1 s later `set_sound` with caustics. Run it three times. Pass: no fire visible under the caustics any time. The console's `[picture] scene` line shows a small `level` or `kept: false`.
8. **Console and Live line.** Pass: during test 7's silences the console shows no run of repeated `[picture] scene` lines; the controls' debug "Live" line on desktop does not say "session type not supported".

## Report

Write the report as a Markdown file, `docs/test-report-v0.19.3.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what the user saw or said), then the numbers from test 3, then any feedback for Claude Code, numbered.
