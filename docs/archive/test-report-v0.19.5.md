# Test report: Sonorous Envelope v0.19.5 (only the fixes)

- **Date:** 2026-11-15, 20:35–20:37 (Europe/Zurich)
- **Session id:** `TECXaeDW4CCahgFi3p32Wf0y` (server version v0.19.5)
- **Device and browser:** desktop, player opened with `?debug` (browser not recorded)

| Test | Result | What the user saw or said |
|---|---|---|
| 1. Visuals off | Pass | Jukebox, Strudel on with a piano pattern using `.pianoroll()` (player reported `ran: true`, 2 events per cycle, no errors), no colour beyond the hidden-drawings scene (`waves`). Off: the drawings and their black background faded out over about 1.5 s while the scene came up underneath, with no moment of black. On: the scene and the drawings crossfaded the same way, again with no black. |
| 2. Lift | Pass | Self with a calm sound (D dorian, 58 BPM, 1/4). Claude offered Attuned and the user said "Yes, give me a lift, I need more energy". The first `set_sound` (mode attuned, joy 0.85, calm 0.25, 6 s) returned `pace held` (155 → 58 BPM, 1/16 → 1/4) with the new advice to send again with a transition of 8 s or more. Claude sent the same mood again right away with a 10 s transition: tempo 155 and rate 1/16, no clamp, note "tempo 58 to 155: it glides over 10 s". The user heard it stay calm and then rise to a livelier pace over several seconds, with no jump in tempo, note rate or loudness, and said it "definitely" felt like the lift asked for. reads_as after the lift: joy 0.85, calm 0.36, spontaneity 0.68. All within 0.3 of what was sent. |

## Feedback for Claude Code

1. Both fixes work as described. The new `pace held` wording was clear enough to act on without guessing: it says when to send again (if the listener asked for more energy), how soon (now) and how (a transition of 8 s or more).
2. The note rate changes from 1/4 to 1/16 in one step, while the tempo glides. The user heard no jump this time, probably because the tempo is low at the start of the glide. A rate switch at a higher starting tempo could still be noticeable, so it may be worth checking.
3. Small point: after `strudel_mode` with `on: false`, the result's `intent` showed default values (0.5/0.5/0.5/0.8/0.2), not anything Claude sent. It's harmless, but it could be misread as the current mood.
