# Sonorous Envelope v0.17.1 — test report (round 2)

Tester: Gael (desktop + phone view in Brave devtools). Run by Claude via MCP tools. Session `xAv247O9…`. Date: 2026-11-14.

## Summary

Most of the v0.17.0 findings are fixed: phone squish is gone, the mood picks the right scene 14/14, warp no longer tints, vignette covers all four edges, scene motion follows the beat, flock and fireflies look right. What remains:

1. **Bright base (yellow) breaks six scenes.** Aurora, sunbeam, stars, warp, fireflies and fireworks are invisible or barely visible. No dark veil is visible on aurora.
2. **Aurora streaks still too sharp** (also on a dark base).
3. **Caustics, smoke and fire are low-res** (dashed, stair-stepped lines on caustics).
4. **End-of-session redraw bug persists** (D17 run 2) and a related abrupt colour jump (run 3).
5. Smaller: digital columns miss the right side, fireworks speed control has no visible effect, some motes are hard-edged, leaves only slightly varied.

## Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| A4 | 14 moods pick the right scene (needs ≥11/14) | PASS 14/14 | sad rain, lonely snow, melancholic leaves, nostalgic sunbeam, angry embers, cold anger cracks, tender fireflies, hopeful fire, eager warp, dreamy caustics, dread lightning, awe aurora, serene stars, restless flock. All "fit". Cracks feel aggressive (fits). Aurora background too bright (see B9). |
| A5 | Colour mirrors only what I set; neutral mood = no scene | PASS | Neutral mood: no scene. `picture` reported exactly "ink density 0.3 speed 0.6". |
| A6 | Cold anger no longer the red of angry | PASS (by values) | angry hue 356, cold anger hue 175. User did not comment on the colour; scene cracks fit. |
| A7 | `reads_as` vs sent | See below | Three gaps over 0.3. |
| B8 | Phone squish (aurora, clouds, fire, caustics, lightning, cracks, smoke, sunbeam) | PASS | All 8 natural, no stretch (second run, phone view). Fire and caustics look lower-res than before. |
| B9 | Bright yellow base (hue 55, s 0.9, l 0.75) | FAIL | Aurora: base very bright, aurora weak, streaks too opaque. Sunbeam: not visible. Stars: barely visible. Fireflies: only blue/teal ones visible. Fireworks: darker colours visible, light ones almost vanish. Warp: barely visible. |
| B10 | Vignette on all four edges (phone, Scenes off) | PASS | All four edges darker. Shape follows screen aspect, so it is a tall oval on the phone. |
| B11 | Warp, Gradient off, no pink | PASS | No pink, warp visible. |
| B12 | Smoke / caustics resolution and stutter | FAIL (resolution) | Smoke a bit low-res. Caustics clearly low-res (dashed, stair-stepped lines). No stutter on either. |
| C13 | Fireflies/motes overlap at density 1 | PASS | No overlap. Flock at speed 0.1 and 1: good, speed range clear. Some motes are hard-edged (need minimum blur). |
| C14 | Fireworks trails, density 1, speed 0.1 | PARTIAL | Trails yes, density 1 fine. Speed 0.1 and 1 look the same, speed 0.1 still feels fast. |
| C15 | Cracks hit every beat (density 1, speed 1, Strudel drums 100 BPM) | PASS | |
| C16 | Digital katakana + digits | PASS with bug | Looks great, but the right side of the screen has no columns. |
| C16 | Leaves variety | PARTIAL | Only slightly different shapes. |
| C16 | Aurora without sharp streaks | FAIL | Still hard vertical bars at the bottom of the curtains, even on a dark base. |
| C17 | Sunbeam lean differs per start, never near vertical (5 starts, ink in between) | PASS | R, L, L, R, R. Similar steepness, none vertical. |
| C18 | Vertical lean: sad lights sink | PASS | Clearly. |
| D15 | Plain silence: music and picture fade together | PASS | Together. |
| D3 | Mood change snow → aurora | PARTIAL | Background glides only partly (less abrupt than before). Scene redraws. |
| D17 | Closing sound does not redraw the scene | FAIL | See below. |
| D2-19 | Player toggles side by side, teal with check, no ": on/off", reload keeps choice | PASS | Desktop all three yes, reload and phone "all good" (reported together, not itemised). |
| D2-20 | Landing page on phone | PASS | Burger menu, no horizontal scroll, hero waves hidden, "30 scenes" chip, one-line footer with two logos and version. Menu: Add to your AI, Connector, Two faces, Light theme, Sign in, Sign up. |
| D2-21 | Guest player "Add to your AI" button | NOT TESTED | Needs a guest session. |

### D17 detail (end of session)

- Run 1 (closing sound changes tempo only): no redraw. PASS.
- Run 2 (closing sound changes mood, `silence end:true`): the scene was redrawn and the colour gradient changed at the moment the closing command was applied, then faded normally. FAIL.
- Run 3 (mood change, then plain `silence` 1 s later with an 8 s transition running): no redraw, but the background changed abruptly instead of gliding. Plain mood changes alone glide correctly.
- Hypothesis: the closing state replaces a state that is still gliding, and the picture restarts from the closing state. User proposed fixing it by fading the scene quickly first, then running the closing command. My view: that hides the bug and loses the picture during the goodbye; better to carry the current picture state into the closing state.

### A7 — `reads_as` vs sent (gap over 0.3)

| Mood | Axis | Sent | reads_as |
|------|------|------|----------|
| cold anger | warmth | 0.1 | 0.47 |
| tender | warmth | 0.9 | 0.59 |
| tender | joy | 0.6 | 0.28 |

Next largest: tender closeness 0.9 → 0.67; melancholic warmth 0.75 → 0.48; dreamy warmth 0.3 → 0.56; dread calm 0.65 → 0.4 (all under 0.3). `reads_why` says warmth/joy are held down by smoothness, brightness and mode, so the model is clamping by design: either say so in the tool description or let warmth and joy go further. Level clamps (+4 dB) also fired on angry, dread and melancholic.

## Feedback for Claude Code

1. **Bright bases:** when the base lightness is high (about >0.6), switch the "white" scenes (stars, sunbeam, fireflies pale ones, fireworks pale ones, warp) to a dark variant, as smoke and clouds already do. Alternatively, cap the base lightness for these scenes.
2. **Aurora:** apply the dark veil / lightness cap so the base stays dark under the aurora (the awe mood base reads too bright). Soften the vertical streaks: lower opacity, blur the bottom edges, vary width. This is the third round with this finding.
3. **Resolution:** caustics, smoke and fire look low-res on desktop and phone. Render at a higher internal resolution, or smooth when upscaling. Caustics lines show dashes and steps.
4. **End-session redraw (D17):** the closing sound must not reset the scene or colour. Carry over the current picture state; keep the glide when `silence end:true` arrives during a transition.
5. **Digital:** columns do not cover the right side of the screen. Spread them over the full width.
6. **Fireworks speed:** 0.1 and 1 look the same. Make the speed range visible (0.1 clearly slow).
7. **Motes:** set a minimum softness so no mote is hard-edged.
8. **Leaves:** more shape variety.
9. **Scene change on mood change (snow → aurora):** the background only partly glides and the scene redraws. Cross-fade the scenes.
10. **`mode:"follow"` with a scene in the same call drops the scene** (seen again with `strudel_mode` colour). Either apply the reset first and then the scene, or document it.
11. **`reads_as` gaps:** see the A7 table. Cold anger warmth 0.1 reads 0.47; tender joy 0.6 reads 0.28.
12. **Vignette:** it follows the screen shape (tall oval on the phone). Fine as is; keep it screen-space.
13. Cold anger vs angry colour is now different by hue (175 vs 356). Please confirm by eye if this matters.

Still open from v0.17.0: `players` count with a real second device, phrase sync swell (about 4 bars) timing, clarity of `mode:"follow"` in the tool descriptions.

## Not tested this round

Guest player "Add to your AI" button; hamburger menu contents were checked at 375 px only; sunbeam across separate sessions (only across scene switches inside one session).

## Scenes liked most / change first (proposed from your comments, please confirm)

Liked most:
1. **Digital** ("looks really cool").
2. **Lightning** ("fits very well").
3. **Warp on the beat** (earlier: "Looks amazing, I love it").

Honourable mentions: stars/motes for serene ("very relaxing"), flock (speed range and group behaviour).

Change first:
1. **Aurora** (too bright base, sharp streaks, weak on bright bases).
2. **The white scenes on bright bases** (sunbeam, stars, warp, pale fireflies and fireworks).
3. **Caustics, smoke and fire resolution.**
