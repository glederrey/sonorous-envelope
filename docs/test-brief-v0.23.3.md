# Test brief: Sonorous Envelope v0.23.3

Read this whole file first. v0.23.3 fixes what the v0.23.2 full pass found (`docs/archive/test-report-v0.23.2.md`). Everything else passed there and is not tested again. Only the four fixes that need a person to hear or see them are here; the server changes are covered by automated tests.

Before you start: **reconnect the Sonorous Envelope connector** (tool notes changed), start a new conversation and a new session. Gael opens the player on desktop; test 4 needs his phone.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly.

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns.

## What changed

- **Allow Strudel off, then on again**, with nothing new from you in between: the same pattern comes back, in time. After a mode lock it still does not (you are told, and you bring the next sound).
- **Softer and calmer.** When you have read "softer" since your last sound (in a result or through `listen`), your next `set_sound` or `recall` plays at least 2 dB quieter than the last; after "calmer", no louder. `clamped` says `level lowered: the listener asked for softer, …` or `level held: the listener asked for calmer, …`.
- **One-call synth settings.** When your last call set `synth` fields and this one does not, and their values moved back to the mood's, `notes` says `your last synth settings lasted one call, so the mood's values are back: …`. `recall` now also gives the `tempo …` and `rate …` notes.
- **`/m/<id>`**: the fade-in after Start listening is even across the screen. **`/moments` on a phone**: the name, Save and Cancel of a rename sit on one line.

## Tests

**Jukebox** (offer the switch in words, switch after his yes)

1. **Strudel comes back.** Start a pattern with a drawing (`strudel_mode`). Ask Gael to turn "Allow Strudel" off, wait a few seconds, then turn it on again, without you sending anything in between. Ask:
   - Did the pattern stop when it was off? (yes / no)
   - Did the same pattern come back, in time, when it was on again? (yes / no)

**Attuned** (offer the switch, switch after his yes)

2. **Softer is softer.** Play a sound at a medium level. Ask Gael to press "softer" under "Guide the sound", then send your next `set_sound` with a calmer mood. Pass: `clamped` has `level lowered: the listener asked for softer`, and `sound.loudness_db` is at least 2 lower than before. Ask:
   - Was the new sound quieter? (yes / no)
3. **One-call settings.** Send `synth.arp.tempo` 120 with the mood you have, then a plain `set_sound` with the same mood and no `synth`. Pass: `notes` has `your last synth settings lasted one call, so the mood's values are back: arp.tempo 120 to …`.

**Moments (Gael alone)**

4. **Fade and rename.** Ask Gael to open any saved moment's link on desktop, and Account → Moments on his phone:
   - On desktop, after Start listening, does the colour fade in evenly, the corners as bright as the middle? (yes / no)
   - On the phone, after Rename, are the name, Save and Cancel on one line, with the buttons above still lined up? (yes / no)

## Report

Write the report as a Markdown file, `docs/test-report-v0.23.3.md`: a short header (date, session id, server version, device and browser), one table (test, pass / fail / partial / not run, what Gael saw or said, tool fields that matter), then any feedback for Claude Code, numbered.
