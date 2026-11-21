# Test brief: Sonorous Envelope v0.22.3 (covers v0.22.2 and v0.22.3)

Read this whole file first. v0.22.2 reworks the player's control panel (Gael's feedback during the v0.22.1 test) and fixes what that test found (docs/archive/test-report-v0.22.1.md). Only what changed is tested.

Before you start: **reconnect the Sonorous Envelope connector** (the `listen` description changed). Start a new conversation and a new session. Gael opens the player on desktop; test 2 also needs his phone.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Example:
- Did the sound change within about 10 s of your press? (yes / no)
- What does the line under "Live tuning" say? (a few words)

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns.

## What changed

- **The panel by sections.** Visible at first: Mute, Volume and Mode (with "Fade to silence after" in Self). Closed sections: **Visuals and Strudel** (Gradient, Scenes, the Strudel switches; a guest gets **Visuals**) and **Feedback to the AI** (Live tuning, "Let the AI see the picture", then "Guide the sound" and "Tell the AI what you heard"). Then a quiet card, **What the AI is doing**: "The code playing" (was "Strudel code"), "What the AI set" (was "What the model set") and "What the AI can see". The "Settings" block is gone. A pressed toggle has an orange tick on a soft teal box; the rows of toggles are evenly spaced.
- **Live tuning lines**, one line each: "Off: your presses reach the AI with your next message." / "On: after each answer, the AI waits for your presses."
- **"The AI", never "the model"**, in the player and on every page (v0.22.3: the tagline too, "Let the AI hum while it thinks", with a redrawn share image).
- **Before Start listening**, "You stay in control of the volume." is on its own line.
- **The press line clears** as soon as the AI's answer arrives.
- **Pictures:** the player takes one 6 s after it becomes visible again (it takes pictures only while visible), and `inspect` snapshot says so when the picture is old. The spectrogram covers the last 10 s.
- **Scrollbar:** thin, no arrows, no grey track.
- **`listen`'s description** says `heard` comes back too, and to ask questions after the last `listen`.

## Tests

**Self**

1. **A new listener's view.** Before Start listening, ask Gael: is "You stay in control of the volume." on its own line (yes/no)? After Start: does he see only Mute, Volume, Mode and two closed sections, then the "What the AI is doing" card (yes/no)? Does any text in the panel still say "model" (yes/no; if yes, which)?
2. **Panel look.** Ask Gael to open "Visuals and Strudel" and "Feedback to the AI": are the ticks orange and the rows evenly spaced (yes/no)? Is the scrollbar thin with no arrows, on desktop (yes/no)? On his phone, does the panel look right (yes/no)?

**Attuned** (offer the switch, switch after his yes; Gael turns on Live tuning)

3. **Live tuning lines.** Ask Gael what the line under Live tuning says when off and when on (one line each?). During a wait Gael presses one button. Pass: once your answer arrives, the line no longer shows that press within about 1 s (yes/no).
4. **Questions after `listen`.** End one message with `listen` and put a short question for Gael after it returns. Pass: Gael can read the question (yes/no).

**Jukebox** (switch after his yes)

5. **Picture when the player comes back.** Start a Strudel pattern with a drawing. Ask Gael to stay in the chat for about a minute (the player hidden), then call `inspect` snapshot. Pass: `of` says the player takes pictures only while visible. Ask Gael to look at the player for about 10 s, then call it again. Pass: a Strudel picture of the current sound (`of: "the current sound"`), spectrogram about 10 s long (`measured.seconds` near 10, or less right after the switch).

## Report

Write the report as a Markdown file, `docs/test-report-v0.22.3.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what Gael saw or said), then any feedback for Claude Code, numbered. A press can appear twice (in `listen`, then in the next sound call, which marks it read): that is by design, not a failure.
