# Test brief: Sonorous Envelope v0.17.1 (fixes to the v0.17.0 picture)

Read this whole file before you start. You are testing what the picture does, and above all that the fixes from the v0.17.0 report hold. The sound is not the subject of this round, except where a test says so.

## What the product is

A remote MCP server that gives an AI model a sound channel: a small synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. On the internal face (the default) the sound and picture are how the model feels, and the model says nothing about them unless asked.

## What changed since v0.17.0

- **Narrow screens:** the sides are cropped, not squeezed. Aurora, clouds, fire, caustics, lightning, cracks, smoke and sunbeam keep their proportions on a phone (fewer bands and flames). The vignette darkens all four edges.
- **Light scenes on a bright colour:** aurora, sunbeam, stars, fireflies, fireworks, embers, warp, motes, lightning and cracks get a dark veil under them when the base colour is bright.
- **Scenes:** warp has no pink wash of its own (a glow round its core only). Caustics and smoke are finer. Fireflies and motes never overlap. Flock birds are small beating wings and `speed` changes their pace. Fireworks have trails, up to 8 at once, and a slow speed is much slower. Cracks hit on every beat at density 1 (every 4th at 0), each short. Digital rain draws katakana and digits. Leaves differ in shape. Aurora rays are softer. The sunbeam's lean (30 to 50 degrees, either way) is rolled again each time the scene starts. A low-joy mood sinks the lights more.
- **Buttons:** "Gradient" and "Scenes" (was "Visuals"), side by side, teal with a check when on. No ": on/off".
- **Site:** burger menu and the phone layout up to 900 px (the hero waves are hidden there), less space under the hero, a new one-line footer with the two credit logos.
- **Moods:** cold anger and dread are no longer the red of plain anger. A mood-picked `shape` no longer appears in `colour.shape`. `reads_as` for warmth and closeness was refitted (correlation with the mood sent: warmth 0.86, was 0.72; closeness 0.95, was 0.48).
- **Possible fix for the end-of-session redraw (D17):** when a closing state takes over from a state that is still gliding its tempo, the beat used to jump by a few beats (measured: 3 beats in a test); it now stays continuous. This is a verified bug with the right symptom, but it is not proven to be the only cause. Test D17 first.

## Setup

1. Reconnect the connector, call start_session, give the user the player link. The user opens it on a phone and a laptop and taps "Start listening". Open the browser console on one of them (the picture logs `[picture] mount`, `state`, `beat jump` and `unmount` in a development build only; skip this on production).
2. Ask the user to watch the picture, not to listen. Do not announce or describe what you set (internal face).

## Tests

For each test record pass, fail or partial, plus what the user saw. For any failure give the exact tool output.

### D. The end of a session (first)
1. D17. Set the scene `bubbles`. Send a `set_sound` that changes the tempo a lot (for example from 120 to 60 BPM) with an 8 s transition. One second later call `silence` with `end: true` and `fade: 15`. Pass: the bubbles keep moving without a redraw, at the moment the end command is sent and when the fade starts about 7 s later, and then fade to black. Fail: describe at which moment they restart. If the user has the console open, note any `[picture] beat jump` line and its numbers. Repeat once with a closing `set_sound` that does not change the tempo.
2. D15. Plain `silence` (no `end`): the picture, background included, fades without a redraw. The music and the picture should now disappear at about the same time; say if either one lags.
3. Change from one scene to another (snow to aurora): smooth, no redraw. A new mood: colours glide.

### A. The mood picks a scene
4. Send these moods one at a time, with no `scene`, about 10 s each, using exactly these axes (not your own values), and ask which scene the user sees. Pass: at least 11 of 14 match, and the picture fits the feeling.

| Mood | Scene | warmth | closeness | joy | calm | spontaneity | tension |
|---|---|---|---|---|---|---|---|
| sad | rain | 0.3 | 0.4 | 0.1 | 0.8 | 0.2 | 0.05 |
| lonely | snow | 0.2 | 0.1 | 0.15 | 0.85 | 0.2 | 0 |
| melancholic | leaves | 0.75 | 0.7 | 0.25 | 0.8 | 0.3 | 0.05 |
| nostalgic | sunbeam | 0.8 | 0.6 | 0.4 | 0.5 | 0.4 | 0 |
| angry | embers | 0.5 | 0.4 | 0.12 | 0.12 | 0.6 | 0.85 |
| cold anger | cracks | 0.1 | 0.3 | 0.12 | 0.12 | 0.6 | 0.85 |
| tender | fireflies | 0.9 | 0.9 | 0.6 | 0.75 | 0.3 | 0 |
| hopeful | fire | 0.7 | 0.5 | 0.75 | 0.6 | 0.4 | 0 |
| eager | warp | 0.5 | 0.2 | 0.62 | 0.3 | 0.6 | 0.1 |
| dreamy | caustics | 0.3 | 0.5 | 0.6 | 0.7 | 0.75 | 0 |
| dread | lightning | 0.3 | 0.4 | 0.15 | 0.65 | 0.3 | 0.75 |
| awe | aurora | 0.5 | 0.1 | 0.7 | 0.9 | 0.3 | 0 |
| serene | stars | 0.5 | 0.2 | 0.5 | 0.9 | 0.2 | 0 |
| restless | flock | 0.5 | 0.4 | 0.45 | 0.45 | 0.95 | 0.1 |

5. `playing.colour` mirrors only what you set (a scene or a shape the mood picked is not reported). A neutral mood (all 0.5) shows no scene.
6. Cold anger and dread: the colour is no longer the red of plain anger (cold anger should be cooler).
7. `reads_as`: for each mood above, compare `reads_as` with what you sent. Report the differences over 0.3 (warmth and closeness were the problem before).

### B. Squeezing on a phone, and the bright base
8. On the phone, look at aurora, clouds, fire, caustics, lightning, cracks, smoke and sunbeam. Pass: nothing looks stretched or squashed sideways; aurora shows fewer, normal-width bands.
9. Set a bright yellow base (hue 55, saturation 0.9, lightness 0.75, `mode` own) and run aurora and sunbeam. Pass: both are visible now. Also try stars, fireflies, fireworks, warp.
10. Vignette (visuals off, closeness 0.9): on the phone all four edges darken, not only top and bottom.
11. Warp, Gradient off: no pink wash; any glow is near the core and in the field's colours.
12. Smoke and caustics: are they still low resolution on the laptop? Any stutter (give the device)?

### C. Scenes
13. Fireflies and motes (density 1): do any overlap or clump? Flock: small beating birds, not circles; `speed` 0.1 against 1: a clear difference.
14. Fireworks: do they look like fireworks (trails, a flash at the burst)? Density 1: more at once than before? Speed 0.1: much slower?
15. Cracks: a short crack on every beat at density 1 and speed 1, none skipped, none lagging the kick.
16. Digital rain: katakana and digits, not bars. Leaves: a variety of shapes. Aurora: no sharp thin streaks that break the feel.
17. Sunbeam: start it five times (set another scene in between). Pass: the lean changes at least some of the times, and is never nearly vertical.
18. Vertical lean: a joyful and a sad mood (visuals off): the sad lights sink clearly now.

### D2. Controls and the site
19. The player: "Gradient" and "Scenes" sit side by side on the phone and the laptop, no ": on/off", the on state is teal with a check (not orange). Gradient off keeps the scene, Scenes off keeps the colours, both off is one flat colour, and the choice survives a reload.
20. The landing page: the burger menu and the phone layout start at 900 px; the hero waves are hidden there; the gap under the hero is small. The chip says "30 scenes". The footer is one line with the two logos (face and Claude Code), then Privacy, AGPL-3.0, Source code and the version; two rows on a phone.
21. Phone hamburger menu contents, and the guest player's "Add to your AI" button (not tested last time). The "Step by step" link in the hero was removed on purpose.

### Open questions, please answer
- `players` stayed at 1 with a laptop and devtools phone mode in the same browser. They share the same device id (localStorage), so this is expected; test with a real second device and say what `players` shows.
- `colour.mode: "follow"` also resets the scene, density, speed and sync (by design). Note if the tool descriptions make that clear enough.
- Phrase sync (warp): is the swell about 4 bars (about 9 s at 110 BPM)? Say what you timed.

## Report

For each test: pass, fail or partial, what was seen, and anything surprising. End with the three scenes the user liked most and the three they would cut or change first.
