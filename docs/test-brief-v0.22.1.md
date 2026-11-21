# Test brief: Sonorous Envelope v0.22.1

Read this whole file first. v0.22.1 fixes what the v0.22.0 test found (docs/archive/test-report-v0.22.0.md). Only what changed is tested. You can run it in the claude.ai project for tests: the brief is in the project knowledge.

Before you start: **reconnect the Sonorous Envelope connector** (the `listen` description and the mode rules changed). Start a new conversation and a new session. Gael opens the player on desktop; test 7 also needs his phone.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Example:
- Did the sound change within about 10 s of your press? (yes / no)
- What does the line under "Guide the sound" say? (a few words)

## What changed

- **`listen` after a press another call claimed.** While it waits, `listen` now also returns a press made during the wait even if a call sent in the same batch already marked it read. The rules now say: call `listen` once your final call has returned, never in the same batch.
- **Lines after a wait.** After a wait with a press: "The AI is answering your press…". After a wait with no press: "Not listening now: your presses reach the AI with your next message." Live tuning stays on.
- **More of this / Less of this** reach the model as "more of this (go further in the direction of your last change)" and "less of this (take back part of your last change)": a press always asks for an audible change.
- **"Reproach" is now "Blaming"** (the model reads `blaming`).
- **Motif notes outside the voice's scale** are named in the result: `motif notes outside the voice's F# lydian: … (fine if you meant it)`.
- **The Strudel snapshot shows what Gael sees**: the dark backdrop, the dimmed drawings and the code (no code when "Strudel code" is off).
- **On reload, Strudel's code comes in with the first sound**, not before it.
- **Player polish** (v0.22.0 visual feedback): "Your AI" for the owner before Start listening; a slim scrollbar kept inside the rounded panel (phone too); a wider panel on desktop; "Tell the AI what you heard" and "What the AI can see"; one or two lines per tool on How it works.

## Tests

**Self**

1. **Motif outside the voice.** Start in Self with a voice in a clear scale (e.g. `F# lydian`). Send a motif with some notes outside it (e.g. `E4 G4 A4 C5 B4`). Pass: the result's notes name the notes outside the scale. Then send one inside it (e.g. `F#4 G#4 A#4 C#5`). Pass: no such note. Ask Gael whether the second phrase sounded more "in the tune" (yes/no).
2. **Your AI and the panel.** Ask Gael: before Start listening, did the box say "Your AI is making this sound" (yes/no)? Is the scrollbar inside the rounded corners, on desktop and on his phone (yes/no each)? Does "Tell the AI what you heard" have a "Blaming" button (yes/no)?

**Attuned** (offer the switch, switch after his yes; Gael turns on Live tuning)

3. **Same-batch press.** Once, on purpose, send the final `set_sound` and `listen` in one parallel batch. Ask Gael beforehand to press Calmer as soon as the listening line shows. Pass: `listen` returns `calmer` (not `idle` after 20 s). From then on, call `listen` only after the final call has returned.
4. **Lines after a wait.** Gael presses a button during a wait. Pass (ask Gael): while you answer, the line says "The AI is answering your press…" (yes/no). Then let a wait end with no press. Pass: the line says "Not listening now: your presses reach the AI with your next message." and Live tuning is still on (yes/no each).
5. **More of this.** Gael presses "More of this" during a wait. Pass: the press reads `more of this (go further in the direction of your last change)`; your answer changes the sound audibly in that direction, and Gael hears a change (yes/no). Then "Less of this": Gael hears part of the change taken back (yes/no).
6. **Blaming.** Gael presses "Blaming" under "Tell the AI what you heard". Pass: the next result's `heard` says `blaming, … ago`.

**Jukebox** (switch after his yes)

7. **Strudel snapshot.** Start a Strudel pattern with a drawing (e.g. `.pianoroll()`), "Strudel code" on. After about 15 s call `inspect` snapshot. Pass: the image shows a dark backdrop, the drawing, and your code as text; Gael says it looks like his screen (yes/no). Gael turns "Strudel code" off; ask again after about 35 s. Pass: no code in the image.
8. **Code on reload.** Gael reloads the player while the pattern plays and presses Start listening. Pass (ask Gael): the code came in together with the music and the drawings, not before them (yes/no).

**Anywhere**

9. **How it works.** Ask Gael: on How it works, is each tool one or two lines on desktop (yes/no)?

## Report

Write the report as a Markdown file, `docs/test-report-v0.22.1.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what Gael saw or said), then any feedback for Claude Code, numbered. A press can appear twice (in `listen`, then in the next sound call, which marks it read): that is by design, not a failure.
