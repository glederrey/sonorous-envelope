# Test brief: Sonorous Envelope v0.21.0

Read this whole file first. v0.21.0 closes the feedback loop: the listener's buttons can reach the model inside the same message (live tuning), the model can look at what the player shows and plays (snapshots), it can keep a sound and bring it back later (moments), and it can send an anonymous note to the developers. Only what changed is tested.

Before you start: **reconnect the Sonorous Envelope connector** in claude.ai (three new tools: `listen`, `moment`, `tell_developers`; `inspect` has a new option). Start a new conversation and a new session, and have Gael open the player on desktop with `?debug` and tap "Start listening".

**Asking Gael.** Gael is the listener and owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Example:
- Did the sound change within a few seconds of your press? (yes / no)
- What does the line under "Guide the sound" say? (a few words)

## What changed

- **Live tuning (`listen`).** In Attuned and Jukebox, the owner can turn on "Live tuning" under "Guide the sound". Then, after each answer, the model calls `listen` as its very last call: it waits up to 20 s and returns as soon as the owner presses a button, so the model answers the press in the same message (a new `set_sound`, or new Strudel code). The player shows "The AI is listening: your presses reach it now (N s)". Nothing pressed for 20 s: the message ends. `listen` never changes the sound and never waits in the middle of an answer. In claude.ai, pressing stop ends the wait at once and no press is lost (it arrives with the next sound call).
- **Snapshots (`inspect` with `what: "snapshot"`).** The owner's player takes one small picture 6 to 14 s after each new sound (then every 30 s): the picture on top (colour, scene, Strudel drawings), a spectrogram of the last 8 s of what the player played below (low notes at the bottom, a white line where the current sound began), plus measured numbers (loudness, brightness, onsets per second). The model gets it as an image on request. Owner setting "Let the AI see the picture" under Settings (on by default; it was planned off).
- **Moments (`moment`).** The model can keep the sound and picture playing now under a name (`keep`), list them, and bring one back exactly later (`recall`), in any mode. A Strudel moment comes back only where Strudel is allowed.
- **Notes to the developers (`tell_developers`).** The model, or the user through it, can send an anonymous, specific note (bug, idea, confusion, worked) to the developers. Vague notes under 80 characters are refused; at most 5 a day. The model says in one sentence that it sent one.

## Tests (record pass, fail or partial, and what Gael saw or said)

1. **Live tuning, synth.** Switch to Attuned (offer, then yes). Ask Gael to open "Guide the sound" and turn on "Live tuning". Write any short message. Pass: your answer's text is complete before you call `listen`; Gael sees "The AI is listening … (N s)"; he presses "Softer" and the sound changes within about 10 s while the same message is still running; you answer with one final `set_sound`, call `listen` again, and after 20 s with no press the message ends on its own.
2. **Stop while listening (claude.ai).** With live tuning on, while you are listening, Gael presses "Calmer" and then at once presses stop in the chat and writes "what did I just press?". Pass: the chat stops at once (no 20 s wait); "calmer" shows up exactly once in a result (your next sound call's `reactions`, or an earlier one if a call was already on its way), never lost; the player's "listening" line disappears within about 20 s.
3. **Live tuning with Strudel.** Switch to Jukebox, start a Strudel pattern with `.pianoroll()`, live tuning on. Gael presses "Faster". Pass: you answer within the same message with new code (`strudel_mode`), not `set_sound`.
4. **No live tuning in Self.** Switch back to Self and ask yourself to listen once (call `listen`). Pass: the result is `not_in_this_mode`, and in Self you do not talk about the sound.
5. **Snapshot, synth.** In Attuned, send a clear scene (for example aurora or rain) and ask Gael to tell you when it has played for 15 s; then call `inspect` with `what: "snapshot"`. Describe the picture and the sound to Gael in one or two sentences. Pass: you get an image; `of` is "the current sound"; Gael says your description matches what he sees (yes/no). Note the `measured` numbers in the report.
6. **Snapshot, Strudel.** In Jukebox with a `.pianoroll()` pattern, ask Gael to tell you when it has played for 15 s, then call `inspect` snapshot. Pass: the image shows the pianoroll and the spectrogram shows the drums (vertical stripes).
7. **Snapshot off.** Gael turns off "Let the AI see the picture" under Settings. Call `inspect` snapshot. Pass: `image_feedback_off`. Gael turns it back on.
8. **Moments.** Keep the sound playing now as `moment` keep "first light". Send two different moods. Then `moment` recall "first light" with final=true. Pass: Gael says the sound and the picture came back as they were (yes/no); `moment` list shows the name.
9. **Notes to the developers.** Send one real, specific note of your own about this session (`from: model`). Then try a vague one: "great tool, thanks!" padded to nothing more. Pass: the first returns `sent: true` and you tell Gael in one sentence; the vague one is refused with `too_short` (its message asks for what happened, what was expected and what would help), or you decide not to send it. Write in the report what your note said.

## Report

Write the report as a Markdown file, `docs/test-report-v0.21.0.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what Gael saw or said), then any feedback for Claude Code, numbered.
