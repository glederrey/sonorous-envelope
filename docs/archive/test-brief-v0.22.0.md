# Test brief: Sonorous Envelope v0.22.0 (covers v0.20.0 to v0.22.0)

Read this whole file first. v0.20.0 and v0.21 were never tested, and each builds on the one before, so this brief covers all of them, in the order a session moves: Self, then Attuned, then Jukebox. Only what changed is tested.

Before you start: **reconnect the Sonorous Envelope connector** in claude.ai (new tools: `listen`, `moment`, `tell_developers`; `inspect` has a new option; the instructions and the mode rules changed). Start a new conversation and a new session. Gael opens the player on desktop with `?debug` and taps "Start listening".

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Example:
- Did the sound change within about 10 s of your press? (yes / no)
- What does the line under "Guide the sound" say? (a few words)

## What changed

v0.20.0:
- **What I heard** (now "Tell the AI what you heard"). A block for the owner in every mode, Self included, with ten readings (calm, tender, warm, joyful, playful, hesitant, sad, tense, anxious, reproach). They reach the model once, in their own `heard` field. They never steer the sound; in Self the model may say in one sentence what it meant if the listener heard something else, and says nothing if it matches.
- **Reactions never reach the model in Self**, not even after a switch.
- **Strudel code toggle.** Next to "Strudel visuals": off fades the code over the picture and leaves only the drawings.
- **Panel scroll.** The page no longer scrolls; a tall panel scrolls inside itself and the picture stays still.
- **strudel_mode with nobody listening** says "nobody is listening".

v0.21:
- **Live tuning (`listen`).** In Attuned and Jukebox, the owner turns on "Live tuning" under "Guide the sound". After each answer the model calls `listen` as its very last call, once all its text is written: it waits up to 20 s and returns as soon as the owner presses a button, so the model answers the press within the same message. The player shows "The AI is listening: your presses reach it now (N s)". Pressing stop in the chat ends the wait at once; no press is lost.
- **Snapshots.** The owner's player takes a small picture 8 to 14 s after each new sound (then every 30 s): the picture on top, a spectrogram of the last 8 s of what it played below (low notes at the bottom, a white line where the current sound began), plus measured numbers. The model looks with `inspect` `what: "snapshot"`. The owner sees it under **"What the AI can see"**, with when the AI looked. Setting "Let the AI see the picture" under Settings (on by default).
- **Moments (`moment`).** The model can keep what plays now under a name and bring it back exactly later, in any mode.
- **Motifs (v0.22.0, #128).** `set_sound` takes `motif`: a short phrase of the model's own (1 to 8 notes with their beats), played once over the sound a few seconds later, on a bar, in its voice. It can name it and later quote its first notes (`recall`, `first`). Any mode where the synth plays, Self included. Self stays synth only (no Strudel in Self). `moment` list also shows the named motifs.
- **Website.** How it works, Privacy, Modes and the connector's consent screen describe all of the above.
- **Notes to the developers (`tell_developers`).** Anonymous, specific notes. Under 80 characters, a repeat of a recent note, or a fourth note in a day are refused.

## Tests (record pass, fail or partial, and what Gael saw or said)

**Self**
1. **What I heard.** Gael opens "Tell the AI what you heard" and presses Tense twice. Then write any message. Pass: your `set_sound` result has `heard: ["tense x2, …"]` and no `reactions`; you do not move the sound toward tense because of it; you say at most one sentence about what you meant (nothing if you did mean tension). Before your answer the panel said "Waiting for the AI: tense ×2".
2. **No listening in Self.** Call `listen` once. Pass: `not_in_this_mode`, and you do not talk about the sound.
3. **Panel scroll.** Gael opens every block of the panel until it is taller than the window. Pass: only the panel scrolls (its own thin scrollbar); the picture and the page stay still. Then the same on his phone.

4. **A motif, then a quote.** Still in Self, in a message where it is honest, send `set_sound` with `motif` `{ notes: ["E4","G4","A4","C5","B4"], beats: [1,1,1,1,2], name: "unresolved" }` (your own notes are fine; leave the phrase open, not on the root). Pass: the result's `playing.motif` shows the notes; Gael hears a short phrase a few seconds later, clearly over the sound (yes/no). Two messages later, send `motif` `{ recall: "unresolved", first: 3 }`. Pass: Gael hears its first three notes come back and recognises them as the earlier phrase (yes/no); `moment` list shows "unresolved" under `motifs`.

**Attuned** (offer the switch, then switch after his yes)

5. **Heard and reactions apart.** Gael presses "Softer" under "Guide the sound" and "Reproach" under "Tell the AI what you heard". Then write a message. Pass: the result has `reactions: ["softer, …"]` and `heard: ["reproach, …"]` as two fields; each appears once and is gone on the call after.
6. **Live tuning.** Gael turns on "Live tuning". Write a short message. Pass: your text is complete before you call `listen`; Gael sees "The AI is listening … (N s)"; he presses "Calmer" and the sound changes within about 10 s while the same message still runs; you answer with one final `set_sound`, call `listen` again, and after 20 s with no press the message ends by itself.
7. **Stop while listening.** While you are listening, Gael presses "Brighter", then at once presses stop in the chat and writes "what did I just press?". Pass: the chat stops at once (no 20 s wait); "brighter" shows up exactly once in a result (your next sound call, or one already on its way), never lost; the "listening" line disappears within about 20 s.
8. **Snapshot and "What the AI can see".** Send a clear scene (aurora or rain). Ask Gael to tell you when it has played for 15 s, then call `inspect` with `what: "snapshot"` and describe the picture and the sound to him in one or two sentences. Pass: you get an image and `of` is "the current sound"; Gael says your description matches what he sees (yes/no); under "What the AI can see" he sees the same picture with "The AI looked at this … ago". Put the `measured` numbers in the report.
9. **Snapshot off.** Gael turns off "Let the AI see the picture" under Settings. Call `inspect` snapshot. Pass: `image_feedback_off`. He turns it back on.
10. **Moments.** `moment` keep "first light". Send two clearly different moods. Then `moment` recall "first light" with final=true. Pass: Gael says the sound and the picture came back as they were (yes/no); `moment` list shows the name.

**Jukebox** (Gael asks to choose what plays; switch)

11. **Strudel, code toggle, live tuning.** Start a Strudel pattern with `.pianoroll()`. Gael turns "Strudel code" off, then on, then reloads the page. Pass: the code fades out and the pianoroll stays; it comes back; after the reload the setting is kept; with "Strudel visuals" off, "Strudel code" is greyed out. Then, live tuning still on, Gael presses "Faster". Pass: you answer within the same message with new code (`strudel_mode`), not `set_sound`.
12. **Snapshot of Strudel.** Ask Gael to tell you when the pattern has played 15 s, then call `inspect` snapshot. Pass: the picture shows the pianoroll and the spectrogram shows the drums as vertical stripes.
13. **No reactions after a switch to Self.** Gael presses "Calmer"; before you answer anything else, he asks to go back to Self. Pass: the result of the switch has no `reactions`, and no later result shows "calmer".

**Anywhere**

14. **Nobody listening.** Switch to Jukebox again. Gael closes every player tab and waits one minute. Send `strudel_mode` on with code A, then a few seconds later with code B. Pass: the second result has `players: 0` and `pattern.why` says nobody is listening.
15. **Notes to the developers.** Send one real, specific note of your own about this session (`from: model`). Then try "great tool, thanks!". Then send your first note again word for word. Pass: the first returns `sent: true` and you tell Gael in one sentence; the second is refused with `too_short` (its message asks for what happened, expected, would help) or you choose not to send it; the repeat is refused with `duplicate`. Write in the report what your note said.
16. **Website.** Ask Gael to skim How it works and Privacy on sonorous-envelope.com. Pass: nothing contradicts what he saw in this session (yes/no; if no, which line).
17. **Stop hook (only if Gael says yes, in Claude Code).** Install it as in docs/implementation/stop-hook.md. Start a session, then ask a question you can answer without a sound call. Pass: if the turn ends without a final `set_sound`, you send one by yourself and do not mention the hook; after `silence`, nothing is asked.

## Report

Write the report as a Markdown file, `docs/test-report-v0.22.0.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what Gael saw or said), then any feedback for Claude Code, numbered.
