# Sonorous Envelope v0.17.4: test report

Tester: Gael (laptop + phone view in Brave devtools). Session `301uG8frDirBmY1edndZdDcc`. Only the three open items from the v0.17.3 round were tested.

## Results

| # | Test | Result | Gael's words |
|---|------|--------|--------------|
| 1 | Aurora on phone (dark base, awe mood): fewer streaks, normal width, not squished; laptop as before | PASS | "phone: fewer streaks: yes, squished: no; Desktop as before: yes" |
| 2 | Smoke on bright yellow (hue 55, sat 0.9, light 0.75): dark like smoke on a dark colour, clearly visible | PASS | "Smoke is white but on a darker scene (on second image I removed the visuals)" |
| 3 | Warp `sync:"phrase"` at 110 BPM (Strudel beat): blob swells over ~4 bars, rings fast again | PASS | "yes, yes" |

Not tested this round: `players` with a real second device, guest "Add to your AI" button, `reads_as` joy.

## Feedback for Claude Code

1. All three v0.17.3 open items are fixed in v0.17.4: aurora on phone, smoke on bright base, warp rings under phrase sync.
2. Test 3 was checked on the laptop only, with a Strudel 110 BPM beat. Phone view for warp phrase sync was not looked at.
3. Smoke on the bright yellow base: the gradient with visuals removed (second screenshot) is yellow-green, and with smoke on the scene is darker, olive. Smoke itself is white-ish. Fine as is; noting it in case a "dark smoke" look was intended.
4. Still open: `players` with a real second device, guest "Add to your AI" button, `reads_as` joy.

## Scenes (proposed by me; not confirmed by Gael)

Liked most: caustics, digital rain, fireworks (from v0.17.3).
Change first: none from this round; all three open items now pass.
