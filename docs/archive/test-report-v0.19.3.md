# Test report: Sonorous Envelope v0.19.3 (fixes only)

- **Date:** 2026-11-15, 19:36–19:45 (Europe/Zurich)
- **Session id:** `_Jx-gf7RD2ILUezNqjBMqcBz`
- **Device and browser:** desktop, Chromium-based browser, player opened with `?debug`, DevTools console open
- **Tester:** Gael (owner), Claude as the model

| # | Test | Result | What the user saw or said |
|---|---|---|---|
| 1 | Version | Pass | `start_session` returned `version: "v0.19.3"`. |
| 2 | First sound | Pass | First `set_sound` (Self, plain mood) had no "tempo X to Y" note. Its only note: the first sound became the voice. |
| 3 | Warmth and waves | Pass | Sine → sawtooth → square → triangle, with a note on each move. All readings within 0.2 (numbers below). The user heard the wave change each time and the volume stayed even. |
| 4 | Attuned pace | Pass | `clamped`: "pace held … (tempo 162 to 91 bpm, rate 1/16 to 1/8)". Level went from −27 to −35 dB. The user heard no jump in speed or volume, and heard it get brighter/wobblier (lydian, amp LFO) without getting faster. |
| 5 | Scene behind Strudel | Pass (one issue) | The user asked for "old school berliner techno, 140 bpm", so I switched to Jukebox and sent a pattern with `.pianoroll()` and no colour. With visuals off: **bubbles** (pink, yellow, orange background), moving with the beat. Visuals back on: the drawings returned with a fade and no cut, **but the scene dips to black first and then the drawings fade in**. Going the other way (drawings → scene) crossfades directly, without black. Same pattern with `colour: { scene: "fireworks" }`, visuals off: fireworks shown, no gap in the music. |
| 6 | Drawings crossfade | Pass | `.pianoroll()` → `.punchcard()`: the user saw it fade, with no hard swap and no gap in the music. The console logs `[picture] strudel drawings crossfade`. |
| 7 | Old scene after a short silence | Pass | Fire → `silence` (fade 4) → ~1 s → caustics, three times: no fire under the caustics any time. Console after each silence: `[picture] scene {from: null, to: 'caustics', level: 0}`, so the old scene was dropped. A direct fire↔caustics change while playing logs `{from: 'caustics', to: 'fire', fade: 2, level: 1, kept: true}`, as expected. Run 1 caveat: my `silence` went out about 1–2 s after the fire call instead of ~5 s (tester error), so fire had barely faded in (`state … tau 0.37, vol 0`). |
| 8 | Console and Live line | Pass (console) / not checked (Live) | Console: across the silences the sequence is `state (vol 0)` → `level (1→0, span 4)` → `state (caustics)` → `level (afterSilence: true)` → `scene`. No run of repeated `[picture] scene` lines and no scene logged during the silence. The user wasn't sure whether he had seen repeats; the screenshots show none. Debug "Live" line: the user wasn't sure where to look, so this was not verified. |

## Test 3 numbers

Self, plain moods, closeness 0.5, joy 0.6, calm 0.6, spontaneity 0.4. Root E, dorian.

| Warmth sent | `reads_as` warmth | Gap | Wave | Cutoff | Roughness | Brightness | Level |
|---|---|---|---|---|---|---|---|
| 0.8 | 0.84 | +0.04 | sine | 882 Hz | 0.47 | low | −26 dB |
| 0.3 | 0.32 | +0.02 | sawtooth | 2606 Hz | 0.47 | high | −29 dB |
| 0.1 | 0.17 | +0.07 | square | 3325 Hz | 0.47 | high | −25 dB |
| 0.55 | 0.72 | +0.17 | triangle | 1516 Hz | 0.45 | low | −27 dB |

Later, with the same voice in lydian: warmth 0.7 read 0.74–0.76 (triangle).

## Feedback for Claude Code

1. **Return to Strudel drawings dips through black.** Drawings → scene (visuals off) crossfades directly. Scene → drawings (visuals on) fades the scene to black first and only then fades the drawings in. Make it a straight crossfade in both directions.
2. **The picked scene isn't reported.** With no colour in `strudel_mode`, `playing.picture` says only `"sync beat"`, both in the result and in `get_feedback`. It should name the scene the server picked (here bubbles), as it does when one is sent (`"fireworks density 0.5 speed 0.73, sync beat"`).
3. **Spurious glide note after Strudel off.** After `strudel_mode on: false` the synth comes back silent, but the next `set_sound` said "tempo 162 to 91: it glides over 2 s". Nothing was playing on the synth, so apply the same rule as the first-sound fix here: no glide note, and no glide.
4. **Warmth 0.55 reads high.** It reads 0.72 (+0.17), slightly above the server-side range quoted in the brief (0.62–0.71) and close to the 0.2 limit. The other three are tight. The triangle band could pull mid warmth down a little.
5. **`reads_as` after "pace held".** On the Attuned switch, calm read 0.77 against 0.15 sent (gap 0.62). The tool description tells the model to correct gaps above 0.3, and a correction would undo the hold on the very next call. Suggest a note in `clamped`/`notes` such as "reads_as reflects the held pace; no correction needed", or leave calm out of the gap check for that call.
6. **Jukebox switch undoes the hold at once.** Switching to Jukebox with `set_sound` (mood kept) glided 91 → 162 bpm on the synth for a moment before Strudel started. It's allowed (a new call), but a mode switch made only to start Strudel could skip the synth change. Minor.
7. **"Live" line.** Not verified this round. Please say where the line appears in the debug controls, so it can be checked quickly next time.
