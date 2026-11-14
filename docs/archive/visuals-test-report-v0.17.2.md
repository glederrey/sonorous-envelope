# Sonorous Envelope v0.17.2 — test report (round 3)

Tester: Gael (laptop + phone view in Brave devtools). Run by Claude via MCP tools. Sessions `0n0QMXkZ…` (first D17 run 2 attempt, repeated), `qZBEuiaH…` (D17 run 2, passed), `lQrY8aTB…` (everything else). Date: 2026-11-14.

## Summary

The end-of-session and mood-change problems from v0.17.1 are fixed (D17 runs 1, 2 and 3 all pass, no redraw, no jump). The bright yellow base now works for aurora, sunbeam, stars, warp and fireflies. Smoke and fire are now perfect. The mood table still passes 14/14. What is left:

1. **Aurora:** looks very good on a dark base, but thin hard-edged streak lines remain (user wants only diffused streaks).
2. **Smoke and clouds on a bright base:** the screen gets much brighter and the clouds are too faint (the darkened base is applied to the light scenes only).
3. **Caustics:** better, but some lines still look like stairs.
4. **Digital rain on the phone:** columns only fill the left half of the screen (laptop is fine).
5. **Fireworks speed:** sparks follow the speed now, rockets do not (same speed at 0.1 and 1).
6. **Phrase sync (warp):** no 4-bar swell visible, motion is per beat.

## Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| D1 | D17 run 2: bubbles, joyful → sad closing sound (8 s), `silence end:true fade 15` 1 s later | PASS | "No jumps, good fade between the two moods and good fade to the end of the session. No restarts." First attempt was repeated at the user's request and its result was not scored; the repeat passed. |
| D2 | D17 run 3: mood change, plain `silence` 1 s later | PASS | "Keeps gliding, no jumps." |
| D3 | D17 run 1: closing sound changes only the tempo (130 → 70 over 8 s), `silence end:true` | PASS | No redraw, no jumps; bubbles slowly changed speed with the tempo. |
| D4 | Snow → aurora, mood picks, no `scene` sent | PASS | "All good for this test." Side observation (see feedback 6): after a silence, the next sound brings the old animation back and then fades to the new scene. |
| D5 | Plain `silence`: music and picture fade together | PASS | "All good." |
| B6 | Bright yellow base (hue 55, s 0.9, l 0.75): aurora, sunbeam, stars, warp, fireflies | PASS | All five clear. |
| B6 | Fireworks | PASS (mostly) | "Clear for most of the colors." |
| B6 | Smoke | PARTIAL | Clear, but "the screen became much brighter and the smoke is black." |
| B6 | Clouds | FAIL | "Too faint, still very bright color." |
| B7 | Awe mood alone | PASS | "Better than before." Thin streaks still there (see C8). |
| C8 | Aurora, dark base and awe mood: no hard bars at the foot, soft rays | PARTIAL | Dark base: "Looks very good." Hard bars at the foot are gone, but thin non-diffused streak lines remain (circled in screenshots). |
| C9 | Smoke at full size (laptop) | PASS | "Perfect." |
| C9 | Fire at full size (laptop) | PASS | "Perfect as well." |
| C9 | Caustics at full size (laptop) | PARTIAL | "Better but there are still some lines that look like stairs." No stutter reported on any of the three. |
| C10 | Digital rain reaches the right side | PARTIAL | Laptop good. Phone: columns only fill the left part of the screen. |
| C11 | Fireworks speed 0.1 vs 1 | PARTIAL | Sparks now clearly slow at 0.1 and much faster at 1. Rockets going up are the same speed at both. User suggests slowing the rockets at low speed for a better impression of speed. |
| C12 | Motes not hard-edged | PASS | "All good." |
| C12 | Leaves varied | PASS | "Many more shapes. Love it." (A lobed maple leaf was not named explicitly.) |
| C13 | 14 moods pick the scene in the table | PASS 14/14 | Rain, snow, leaves, sunbeam, embers, cracks, fireflies, fire, warp, caustics, lightning, aurora, stars, flock. #13 was first reported as seeds; the user then compared stars and seeds side by side and confirmed it was stars. |
| D2-14 | `mode:"follow"` + `scene:"fire"` in one call | PASS | Colours came back to the mood (h 50), fire kept (`picture` "fire density 0.5 speed 0.5"), visible on screen. |
| D2-15 | `reads_as` tender / cold anger | IMPROVED / SAME | Cold anger warmth sent 0.1 reads 0.21 (v0.17.1: 0.47). Tender warmth sent 0.9 reads 0.53 (0.59), tender joy sent 0.6 reads 0.32 (0.28). |
| D2-16 | Guest player "Add to your AI" button | NOT TESTED | Needs a guest session. |

### Open questions

- **`players` with a real second device:** the count showed 2 while the phone and the laptop were both open and 1 on other calls, but the phone here is devtools in the same browser, so it is not a real second-device test. Still open.
- **Phrase sync (warp), swell of about 4 bars (about 8.7 s at 110 BPM):** NO. With a 110 BPM beat in Strudel the user saw the middle white blob expand on every beat, new rings every 2 beats, and each ring lasting about 2 beats. There was no slow 4-bar swell. If a 4-bar swell is intended for warp under `sync: phrase`, it is not happening.

## Feedback for Claude Code

1. **Aurora:** remove the thin hard-edged streak lines inside the curtains (even on a dark base). Only diffused streaks, please. The base and the foot of the curtains are good now.
2. **Smoke and clouds on a bright base:** apply the same darkened base that the light scenes get. On yellow, smoke makes the whole screen much brighter and clouds are too faint on a very bright colour.
3. **Caustics:** some lines still show stair-stepping at full laptop size. Smoke and fire are fine, so the same fine build should apply.
4. **Digital rain on the phone:** columns only cover the left part of the screen. Spread them over the full width on narrow screens (laptop is fine).
5. **Fireworks speed:** the rockets going up should slow down at low speed, so the speed control reads clearly (0.1 and 1 look the same for the rockets).
6. **Restart after silence:** when the sound starts again after a plain `silence`, the old animation comes back first and then fades to the new scene. Probably better to start directly on the new scene (or crossfade from nothing). User is not sure whether it is good or not.
7. **Phrase sync on warp:** per-beat motion only, no 4-bar swell. Either fix or document that `sync: phrase` does not swell warp.
8. **Pale colours on a bright base:** fireflies and fireworks in pale colours are still weak on bright yellow (only the darker or blue ones show).
9. **Minor:** `synth.arp.tempo` is "for this call only": the tempo went back to the mood tempo on the next mode switch. Fine, but worth a line in the tool description since it is a handy way to set a BPM.
10. **`reads_as` for tender:** warmth 0.9 reads 0.53 and joy 0.6 reads 0.32. Joy remains the weakest estimate, as expected.

## Not tested this round

Guest player "Add to your AI" button, `players` with a real second device.

## Scenes liked most / change first (proposed from your comments, please confirm)

Liked most:
1. **Leaves** ("many more shapes. Love it").
2. **Aurora on a dark base** ("looks very good").
3. **Smoke and fire** (both "perfect"; smoke on a dark base).

Change first:
1. **Aurora's thin streak lines** (the last thing keeping it from being finished).
2. **Clouds (and smoke) on a bright base.**
3. **Caustics stair-stepping** (digital rain on the phone is a close fourth).
