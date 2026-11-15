# Test report: Sonorous Envelope v0.19.4

- **Date:** 2026-11-15, 19:52–19:57 (Europe/Zurich)
- **Session id:** `I9meRGcPlEZJP75PGp8AsUf8`
- **Device and browser:** desktop, Chromium-based browser with DevTools open, player at `?debug`
- **Setup:** the player opened, the "Live: engine running, keep-alive playing." line showed under "Leave this page, then come back…", and sound played after "Start listening" (players: 1).

| # | Test | Result | What the user saw or said / what the tools returned |
|---|------|--------|------------------------------------------------------|
| 1 | Picked scene reported | **Pass** | "Can you play some house" → Jukebox → `strudel_mode` on, 124 bpm, `.pianoroll()`, no colour. `playing.picture`: `motes (picked for the music) density 0.75 speed 0.63, sync beat`. The user heard the groove and saw the pianoroll. |
| 2 | Drawings back on | **Pass** (with feedback) | Visuals off: the motes scene showed. Visuals back on: the scene faded under the drawings, with no black. **But** turning visuals *off* still dips to black before the motes appear (see feedback 1). |
| 3 | No glide after Strudel | **Pass** | `strudel_mode` off (Strudel was at 124 bpm, synth state at 138), then `set_sound` straight away with calm 0.85: it started at 60 bpm with no "tempo X to Y" note. The user heard no speeding up or slowing down. |
| 4 | Pace held | **Pass** | Self (calm, 60 bpm) → Attuned offered → "for a lift, please" → switched with calm 0.20, joy 0.90. `clamped`: "pace held … (tempo 163 to 60 bpm, rate 1/16 to 1/4); send again to go further. reads_as reads the held sound, so its calm is higher than sent: do not correct for that". The user confirmed the pace stayed slow, but said it "doesn't feel super lifting since it's slow". A second call glided 60 → 155 bpm over 8 s. |

## Feedback for Claude Code

1. **Make the visuals toggle symmetric.** Turning "Strudel visuals" on now crossfades (scene fades under the drawings, no black). Turning them off still goes to black first, then fades the scene in. The owner wants both directions to behave the same way, either both through black or both as a direct crossfade. A direct crossfade both ways fits the v0.19.4 change best.
2. **The pace hold leaves a first Attuned "lift" flat.** This is expected under the care rule, but the first sound of a lift was slow (60 bpm) and the user noticed. Consider adding a hint to the `clamped` text or the Attuned guidance to follow up with a second `set_sound` (with a transition) to reach the requested pace. In this run, joy also read 0.62 against 0.90 sent ("held down by smoothness, brightness"), just under the 0.3 correction threshold, so the held sound undersold both calm and joy.
3. **Small inconsistency in the tempo note in test 4.** `clamped` says "tempo 163 to 60", while the follow-up call glided to 155 bpm with calm 0.25. That is consistent with a small mood difference, so no fix is needed. It's noted only so the numbers in this report aren't read as a mismatch.
