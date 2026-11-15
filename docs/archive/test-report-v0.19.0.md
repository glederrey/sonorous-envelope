# Test report: Sonorous Envelope v0.19.0

Tested on 15 November 2026, on the real domain (sonorous-envelope.com), with the player in the browser. Three sessions: Part A (hand-over, started in Attuned), Part B (modes, started with no mode), and a fresh one for test 9b and tests 10 to 12.

Test 4 (closing) was run after tests 5 to 7, because it ends the session.

## Results

| # | Test | Result | What the user saw / said |
|---|---|---|---|
| 1 | Hand-over, straight away | **Pass** | "went to black and silent for ~1-2 sec. Then, synth + stars. No auroras" |
| 2 | Hand-over after ~3 s | **Pass** | "I saw black, then stars fading in. No auroras. Stars faded from black". The aurora was set behind the code so a leak would show. |
| 3 | Hand-over after ~8 s | **Pass** | "it stayed black the whole time, no auroras. fade started from black" |
| 4 | Closing sequence | **Pass** | Black first, no stars or aurora, waves from black, end fade "looks fine" (same as v0.18.5 as far as the user remembers). "Strudel visuals" was off during this run. |
| 5 | Controls panel blur | **Pass** | 360 px, 1,089-character pattern: blurred behind the panel, no code readable, same look over the code and over warp; the "Exit fullscreen" button matches. |
| 6 | "Strudel visuals" off | **Pass** | Off: black, then a calm fade to the scene. Back on: cuts straight to the code, with no black (feedback 2). Music kept playing. |
| 7 | Fade-in after silence | **Partial** | Scene and colour came up together from black, no colour patch, but "it came with the fireflies as well that faded out". The previous scene came back during the fade-in. |
| 8 | Start in Self | **Pass** | `guidance` describes Self only (Strudel appears once, as "no Strudel"). The pill shows "Self", the Mode control shows Auto, no reaction buttons. |
| 9 | Offer before switching | **Pass** | "I need to focus for an hour": offered in words, switched only after "yes please". The result said "switched to external (Attuned)" and carried the Attuned `guidance` with the Strudel part. The pill shows "Attuned"; the reaction buttons appear. |
| 9b | Comfort | **Pass** | In Self: gentle, offered in words, switched after a yes, then eased slowly over long transitions. User: "soothing", "smooth", "calmer gradually. Loved it." The user said that in Self, real unease should show (feedback 16). |
| 10 | Into Jukebox | **Pass** | "futuristic techno with blues inspiration": a clear request, so switched at once and said so in one sentence. Jukebox `guidance` arrived; `strudel_mode` on worked (about 47 events per cycle, 7 sounds). User: yes to everything. |
| 11 | Owner lock Attuned ↔ Jukebox | **Pass** | The pattern kept playing both ways. Each next result carried the new `guidance`, the lock line, and "the owner switched the mode to …". |
| 12 | Owner lock to Self | **Partial** | The pattern faded to nothing; Self `guidance`, the lock line and the owner note arrived; `strudel_mode` on was refused. But `set_sound` with a mode went through with only a note (no refusal), and the error code is still `internal_face`. No comment on the lock in the reply. |
| 13 | Guidance once | **Pass** | Only the first result after a change carried `guidance`; the next two had none. |
| 14 | Redirects | **Pass, one question** | `/faces` lands on "Modes · Sonorous Envelope" (canonical `/modes`, "The three modes" section). `/guide` lands on "How it works · Sonorous Envelope". The brief also says "`/guide` is titled 'Guide'": should the "How it works" page now be titled "Guide"? |
| — | Reactions while Strudel plays (extra) | **Partial** | The buttons show, the presses reach the model through `get_feedback`, and the music followed "faster" and "harsher". But `strudel_mode` neither reports nor clears reactions, so the player stays on "Waiting for Claude: faster, harsher". |

## Feedback for Claude Code

### Player and picture

1. **Strudel start has no fade.** The code appears in one go when Strudel starts (seen in tests 2 and 3). The code and its animation should fade in together.
2. **"Strudel visuals" back on cuts straight to the code.** Turning it off goes through black and fades; turning it back on should do the same.
3. **The old scene comes back after a silence (test 7).** After `silence` (not end), the next `set_sound` with caustics brought the previous scene (fireflies) up with it, which then faded out. Only the new scene should fade in from black.
4. **The Mode row doesn't show the mode in effect under Auto.** Only Auto is highlighted, so you have to read the pill. Proposal agreed with the user: Auto keeps its filled highlight (the owner's choice); the mode in effect gets a lighter mark (an outline or a dot) that moves when the model switches; a locked mode gets the filled style.
5. **The Attuned description is too long.** It's the only mode description that doesn't fit on one line on desktop.
6. **Rename "How is it landing?" to "Guide the sound".** The current label is unclear, and "nudge" is hard for non-native speakers.
7. **"Waiting for Claude: …" should be neutral**, like "Waiting for the AI: …", since other models can use the connector.

### Server and MCP

8. **`strudel_mode` ignores reactions.** Its results don't include `reactions` and don't mark them as read. The model only sees them through `get_feedback`, and the player keeps saying "Waiting for…" after the music has already changed. `strudel_mode` should report and clear them like `set_sound`.
9. **Use the listener's names for the modes in the MCP.**
   - Mode values: `self` / `attuned` / `jukebox`, keeping `internal` / `external` / `sandbox` (and `inner` / `outer`) as aliases.
   - Results should lead with the listener's name: "Jukebox (sandbox)", not "sandbox (Jukebox)".
   - The guidance should tell the model to use only Self, Attuned and Jukebox with the user.
   - Why: the host's tool summary showed "Switching to sandbox mode", which confused the user.
10. **Error code `internal_face`** (when `strudel_mode` is refused in locked Self) is a leftover from the old naming; rename it (`self_locked`, say).
11. **`set_sound` with a mode while locked** is not refused: the call goes through with the note "mode stays internal (Self)…". Either refuse it like `strudel_mode`, or change the brief to say it's ignored with a note.
12. **The owner-stop note contradicts Jukebox.** The owner went Jukebox → Self → Jukebox before the model's next call. The result was Jukebox, but the note still said the pattern stop "is final: do not try to bring it back", while the Jukebox guidance allows Strudel. The note should depend on the mode now in effect. (`strudel_mode` on did work afterwards.)
13. **The old mood carries over into Self after an owner switch.** After the lock to Self, "mood kept from your last call" made the calm Attuned mood (played for the user) the model's Self state until its next call. After an owner switch to Self, the sound should start neutral or stay silent until the model sends its own state.
14. **An ended session still gives advice.** The `silence` with end result says "set_sound brings the synth back" although the session is over.
15. **The picture keeps the old scene's density and speed.** In Jukebox, the circuit scene for 124 bpm techno inherited density 0.25 / speed 0.08 from the calm sound before, so the model had to set them by hand. When a new scene is chosen without density or speed, the mood or bpm could decide them.

### Readings and guidance

16. **Self vs Care is unclear.** In 9b, in Self, the model held back its own unease about the nightmare because of the Care rule. The user's view: in Self, if the model feels unease, it should show it, gently. Say this explicitly in the Self guidance: your reaction may show, kept soft (a touch of tension, slower, quieter), but never mirroring the user's panic.
17. **"Start near where they are" was misread.** On the switch to Attuned in 9b, the model raised the tempo from 57 to 80 bpm to "meet a racing heart" before easing. It still landed well, but it goes against "low, slow, soft". Suggest wording like: "start soft and slow, never faster or louder than what is playing now".
18. **`reads_as` runs below what is sent.**
    - Joy 0.6 read as 0.27, because the voice's scale went to dorian ("held down by mode, smoothness").
    - Warmth reads 0.15 to 0.3 below what is sent across all sessions ("held down by smoothness, brightness").
    - This keeps prompting corrections. Either the mapping or the reading needs adjusting.

### Instructions and host

19. **The player link was missed at the start.** The model wrote the link in text between tool calls, which the host shows only as a summary, so the user never saw it. Make sure the link reaches the user: for example, say in the `start_session` note and the instructions to give the link in the final reply text of the turn, after the last tool call.
