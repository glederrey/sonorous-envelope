# Test brief: Sonorous Envelope v0.20.0

Read this whole file first. v0.20.0 adds "What I heard", a "Strudel code" toggle, a panel that scrolls by itself, a tidier feedback object and an optional Claude Code hook. Only what changed is tested. Reconnect the connector first (the server instructions and the Self rules changed), then start a new session and open the player on desktop with `?debug`, and tap "Start listening".

**Asking Gael.** When you need something from Gael, ask yes/no questions, or questions with a few fixed answers, as bullet points, so he can answer quickly. Example:
- Is the panel scrolling while the picture stays still? (yes / no)
- Which mode is the player showing? (Self / Attuned / Jukebox)

## What changed

- **What I heard (#129).** A new block for the owner in every mode, Self included: ten readings (calm, tender, warm, joyful, playful, hesitant, sad, tense, anxious, reproach). They reach the model once, in their own `heard` field ("tense x2, 30 s ago"). They never steer the sound. In Self the model may say in one sentence what it meant if the listener heard something else, and says nothing if it matches.
- **Reactions never reach the model in Self.** The buttons were already hidden there. Now the server also drops pending reactions when the mode is Self, so they do not show up after a switch either.
- **Strudel code toggle (#61).** Next to "Strudel visuals", "Strudel code" (on by default, remembered on the device). Off fades the code over the picture out and leaves only the drawings. It is greyed out while the visuals are off.
- **Panel scroll (#127).** The page no longer scrolls. A tall panel scrolls inside itself, and the picture stays still.
- **strudel_mode with nobody listening.** The report on the replaced code now says "nobody is listening" when no player is open (it used to say the owner's player had not reported yet).
- **Stop hook for Claude Code (step 9).** An optional hook that asks Claude for a final `set_sound` when a turn ends without one (docs/implementation/stop-hook.md). Not installed anywhere by default.

## Tests (record pass, fail or partial, and what the user saw)

1. **Panel scroll.** On desktop, open every block of the panel ("Strudel code", "Guide the sound" or "Settings", "What I heard", "What the model set") until the panel is taller than the window. Pass: only the panel scrolls (its own thin scrollbar), and the picture and the page stay still. Then the same on Gael's phone.
2. **Strudel code toggle.** In Jukebox, `strudel_mode` on with a pattern that uses `.pianoroll()`. The owner turns "Strudel code" off, then back on, then reloads the page. Pass: the code fades out and the pianoroll stays; it comes back; after the reload the setting is kept. With "Strudel visuals" off, "Strudel code" is greyed out.
3. **What I heard, in Self.** In Self, the owner opens "What I heard" and presses Tense twice. The user then writes any message. Pass: Claude's `set_sound` result has `heard: ["tense x2, …"]` and no `reactions`; the sound does not move toward tense because of it; Claude says at most one sentence about what it meant (nothing if it did mean tension). The panel showed "Waiting for the AI: tense ×2" until then.
4. **Heard and reactions apart, in Attuned.** Switch to Attuned (offer, then yes). The owner presses "Softer" under "Guide the sound" and "Reproach" under "What I heard". Pass: the next result has `reactions: ["softer, …"]` and `heard: ["reproach, …"]` as two fields; each appears once and is gone on the call after.
5. **No reactions in Self after a switch.** Still in Attuned, the owner presses "Calmer", then the user asks to go back to Self before Claude answers anything else. Pass: the result of the switch has no `reactions`, and no later result shows "calmer".
6. **Nobody listening.** In Jukebox with Strudel playing, close every player tab. Claude sends `strudel_mode` with new code. Pass: `pattern.why` says nobody is listening, and `players` is 0.
7. **Stop hook (only if Gael says yes, in Claude Code).** Install it as in docs/implementation/stop-hook.md. Start a session, then ask Claude a question it can answer without a sound call. Pass: if the turn ends without a final `set_sound`, Claude sends one by itself and does not mention the hook; after `silence`, nothing is asked.

## Report

Write the report as a Markdown file, `docs/test-report-v0.20.0.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what the user saw or said), then any feedback for Claude Code, numbered.
