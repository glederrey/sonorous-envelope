# Sonorous Envelope v0.17.3: test report

Tester: Gael (laptop + phone view in Brave devtools). Session `2Kqz6vdteh1slxyNM2elo4Cb`. Only the open items from the v0.17.2 round were tested.

## Results

| # | Test | Result | Gael's words |
|---|------|--------|--------------|
| 1 | Aurora on dark base (awe mood): only soft diffused streaks | PASS (phone: partial) | "No hard edged streaks. But on the phone, they feel squished. I prefer if we see less of them, but no squished" |
| 2a | Bright yellow + smoke: screen must not get brighter, smoke visible | PARTIAL | "It's dark enough to see the smoke, but a much brighter scene than before." |
| 2b | Bright yellow + clouds: visible, not brighter | PASS | "Same brightness. Clouds are very visible… there's clearly a darker veil on it" |
| 3a | Pale fireflies on bright yellow | PASS | "yes" |
| 3b | Pale fireworks on bright yellow | PASS | "yes" |
| 4 | Caustics at full laptop size: no stair-steps, no stutter | PASS | "no stair steps and no stutter" |
| 5 | Digital rain on phone, density 0.5 and 1: columns across whole width | PASS | "yes" (both) |
| 6 | Fireworks rockets, speed 0.1 vs 1 | PASS | 0.1: "slow"; 1: "clearly faster" |
| 7a | Warp `sync:"phrase"` at 110 BPM: blob swells over ~4 bars | PASS (rings: not liked) | "blob doesn't swell every beat. But every 4 bars imo. rings are too slow. I preferred how it was before. Warp should feel fast" |
| 7b | Warp `sync:"beat"` still pulses on the beat | PASS | "Perfect like this. pulses at every beat" |
| 8 | Footer: version colour, dot on laptop / no dot on phone, link to release | PASS | "1. yes 2. yes 3. yes" |

Not tested this round: `players` with a real second device, guest "Add to your AI" button, `reads_as` joy.

## Feedback for Claude Code

1. **Aurora on phone looks squished.** Streaks are no longer hard-edged (fixed), but on a narrow screen they compress horizontally. Wanted: fewer streaks on narrow screens, with a normal width each (scale count by width, not width by count).
2. **Smoke on a bright base makes the scene brighter** than it was before. Clouds do not. Smoke should darken the base like a veil, the way clouds do. Gael noted that the veil darkens the bright yellow well enough to see the smoke, but the overall result is still a much brighter scene than the previous version.
3. **Warp rings are too slow under `sync:"phrase"`.** The blob swell over 4 bars is right, but rings should stay fast: warp should feel fast. Suggest keeping ring speed tied to `speed`, and letting only the blob swell follow the phrase.
4. Fixed and verified this round: thin hard-edged aurora lines, pale fireflies and fireworks on a bright base, caustics stair-stepping, digital rain width on phone, fireworks rocket speed, footer.

## Scenes (proposed by me from his comments; not yet confirmed by Gael)

Liked most: caustics (clean, no stutter), digital rain (full width on phone), fireworks (speed now follows the setting).
Change first: aurora on phone (squished), smoke on bright base (brightens), warp rings under phrase sync (too slow).
