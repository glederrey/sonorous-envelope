# Sonorous Envelope v0.17.0: visuals test report

Tester: Gael. Date: 2026-11-14. Devices: laptop (desktop browser) and phone (Brave devtools device mode). Session on the internal face unless noted; Strudel drums used for beat tests (external face, on request).

Summary: all 30 scenes work and look good. The old bug of the scene being redrawn when a session ends is still there (D17). The other main problems are horizontal squishing on narrow screens, light-based scenes (aurora, sunbeam) being invisible on a bright base, the mood-to-scene picker matching the brief on only 6 of 14, and a few style items.

## Results

| Test | Result | What was seen |
|---|---|---|
| A1 mood picks scene | **FAIL** (6/14, pass needs 11) | Matches: sad rain, lonely snow, angry embers, cold anger cracks, tender fireflies, awe aurora. Misses: melancholic gave rain (expected leaves), nostalgic gave fireflies (sunbeam), hopeful gave motes (fire), eager gave bubbles (warp), dreamy gave fire (caustics), dread gave cracks (lightning), serene gave fire (stars), restless gave no scene (flock). User found the picture fitted the feeling every time. Axis values were chosen by me, so some misses may be my values landing next to a neighbouring mood. First run was void (scene names not noted); the second run is the one scored. |
| A2 playing.colour mirrors | PASS | A scene I set shows as `playing.picture` (e.g. "ink density 0.75 speed 0.25"); scenes the mood picked were never reported. Note: a mood-picked `shape: "glow"` does appear in `colour.shape` (nostalgic, tender) although I did not send it. |
| A3 neutral mood | PASS | All axes 0.5: gradient only, no scene. |
| B4 set fire, mood changes | PASS | Fire appeared and stayed through a mood change. |
| B5 ink and none | PASS | Ink drops appeared (user: "if I'm correct"); `none` removed the scene. |
| B6 all 30 scenes | PASS | No schema error, 30 different pictures, none empty or broken. Aurora faint on a bright base (see E18). |
| B7 density and speed | PARTIAL | Smoke: 1 streak at 0.1 density, 5 at 1, clearly slower and faster. Flock: density clear; speed weak (0.1 about the same as default, 1 only slightly faster and more spread). Fireworks: density clear (one at a time vs many; user wants 1 to go higher), speed clear but slow is only mildly slower. Rain: light vs heavy, clearly slower and very fast. |
| B8 sync | PASS | Tested on warp with Strudel drums. Beat: rings follow the kick ("perfect"). Free: not in sync. Phrase: starts on, then swells; user timed it at roughly 4 beats, but the brief says a 4-bar swell (about 9 s at 110 BPM), so it may be faster than specified. |
| C9 three parts | PASS | Gradient off stops the colours and keeps the scene; Visuals off removes the scene and keeps colours moving; both off gives one flat colour (brownish base); the choice survives a reload. See finding 7 (warp adds its own pink). |
| C10 vignette | PASS (laptop) / PARTIAL (phone) | Close mood: edges darker than centre on the laptop; distant mood: only corners. On the phone only top and bottom darken, not left and right. |
| C11 vertical lean | PARTIAL | High joy: lights centre-upper, though they also pass through the bottom. Low joy: colours dimmed and circled the centre; no clear sink. |
| C12 shape | PASS | Glow gathers, sweep rides a ring, wash spreads; all three look different. |
| C13 no pulse | PASS | 30 s at 120 BPM with Visuals off: nothing flashed with the beat. |
| D14 scene change | PASS | Snow to aurora: smooth fade out and fade in, no redraw. |
| D15 silence | PASS (picture) | Picture, background included, faded to black with no redraw. The music faded faster than the image. |
| D16 new mood | PASS | Green to orange, colours glided, no jump. |
| D17 end of session (extra) | **FAIL** | Bubbles scene, closing sound with an 8 s transition, then `silence` with `end: true` and a 15 s fade. The bubbles were redrawn from scratch at the moment the end command was sent (the tool said the fade would start 7 s later). This is the old bug, still present. Plain `silence` without `end` (D15) does not do it. |
| E17 performance | PASS with note | Nothing stuttered. Smoke and caustics feel low resolution (laptop). |
| E18 bright background | PARTIAL | Smoke and clouds: fine (they turn dark on a bright base). Aurora: barely visible. Sunbeam: shafts invisible, only the dust dots show. |
| E19 flock | PASS | Enough birds; groups split and rejoin. Birds are plain circles. |
| E20 warp tempo | PASS | Rings follow the tempo at 160 BPM and are not too fast. |
| E21 sunbeam lean | PARTIAL | Three runs in one session had the same lean (matches "per session"); user prefers it to change every time. Looked good in devtools. Not tested across sessions; the 40 degree minimum was not measured. |
| E22 cracks | PARTIAL | Not on every beat: roughly every 1.25 beats at density 0.5. At density 1 and speed 1 they follow the tempo but lag the kick. |
| F23 landing page | PASS | Chips: A synthesizer, A colour field, 30 visuals, Strudel. Three sections below the hero. |
| F24 Add to your AI | PARTIAL | Page, five tabs, numbered steps and badges are right (Claude and ChatGPT Tested, the rest Not tested yet; 5/5/4/4/3 steps). Header links present on desktop. No "Step by step" link found in the hero (only the plain hint text). Phone hamburger menu and the guest player's Add to your AI button not tested. |
| F25 Connector page | PASS | "The tools" and "How it works" are separate sections. |
| F26 /safety | PASS | 404, and nothing links to it. |

## Feedback for Claude Code

### Layout and controls
1. **Hero waves on phone:** hide them below about 640 px (they are 300 px of decoration under the status card and look out of place). Alternatively shrink to about 80 to 100 px.
2. **Gradient and Visuals toggles:** put the two buttons side by side, on the phone as well as the laptop.
3. **Toggle labels:** drop ": on/off"; show state by look (with `aria-pressed`) and add a non-colour cue such as a check or dot. Do not use the orange fill; it is the same as the Sign up button. Use teal or the outlined style of the Auto/Internal/External selector.
4. **Rename Visuals to Scenes everywhere:** the player button, the landing chip ("30 scenes"), docs and tool descriptions.
5. **Hero "Step by step" link:** the brief says it should go to Add to your AI; none was found.

### Rendering
6. **Squishing on narrow screens:** aurora, clouds, fire, caustics, lightning and cracks stretch horizontally on a phone. Suggested fix, for Claude Code to verify in the code: for background-filling scenes, use uniform units based on screen height, crop the sides (like `object-fit: cover`) and scale the element count with the visible area. Scenes that must stay fully in view (flock, circuit, network, scope) should simulate in real pixels, so nothing is scaled or cropped. Aurora on a phone should show fewer bands, not compressed ones.
7. **Scene tint:** warp adds a pink colour wash of its own that stays when Gradient is off (snow does not). A scene should only draw its own elements, with any glow local to them and derived from the mood's colours.
8. **Low-resolution smoke and caustics:** probably an upscaled small buffer; render at the device's own resolution or with proper smoothing.
9. **Vignette:** draw it in screen space on all four edges; on a phone only the top and bottom darken.
10. **Light-based scenes on a bright base:** aurora and sunbeam are invisible on a bright yellow base (smoke and clouds adapt well). Cap the base lightness while a light scene (aurora, sunbeam, stars, fireflies and so on) is on and report it in `clamped`, or draw a darker veil under those scenes.
11. **Aurora look:** a few thin bright streaks stand out too sharply and break the aurora feel.
12. **Minimum spacing:** fireflies and motes must not overlap or cluster; give them a minimum distance.
13. **Flock:** draw small far-away birds, not circles; speed has little effect.
14. **Other style items:** leaves need more variety of shape; digital rain should use Matrix-style glyphs, not small bars; fireworks should look like real fireworks and density 1 can go higher; fireworks and flock slow settings should be slower.
15. **Cracks:** make each hit short and fixed-length, one per beat; they currently skip or lag beats (a new crack seems to wait for the previous one to finish).
16. **Sunbeam lean:** re-roll the lean each time the scene starts, not only per session (the 40 degree floor was not measured).
17. **Vertical lean (C11):** visible when joyful, hardly at all when sad.
18. **Picture and sound fade:** on `silence` the music fades faster than the picture; consider matching them.

25. **Scene redrawn when the session ends (old bug, still present):** with `silence` and `end: true`, the scene restarts from nothing the moment the end command arrives, before the fade has begun. Reproduce: set any scene (bubbles), play a closing `set_sound` with a long transition, then call `silence` with `end: true`. Plain `silence` (no `end`) fades cleanly, so look at what the end path does to the picture, probably a re-render when the session state changes to ended.

### Mood picker and server
19. **Mood to scene:** 6 of 14 matched the brief. Publish an axis table per mood, or return the picked scene in a separate field such as `scene_suggested`, so the test can be scored without eyes.
20. **Colour for cold anger and dread:** both come out the same red (hue 356, saturation 0.57) as plain anger. Cold anger should be cooler.
21. **`reads_as` gaps:** warmth read 0.66 when 0.2 was sent (lonely) and 0.59 for dread; closeness read 0.51 for 0.1. These exceed the 0.3 correction rule.
22. **Player count:** `players` stayed at 1 with the laptop and the phone (devtools in the same browser) both open; check whether they count separately.
23. **`colour.mode: "follow"`** also resets the scene and sync, so a scene sent in the same call is lost. Probably as documented, but easy to trip over.
24. **Phrase sync:** check the swell length against the 4 bars in the spec.

## Scenes (proposed; to confirm with the tester)

Liked most (from comments): warp on the beat ("looks amazing, I love it"), clouds and smoke when they turn dark on a bright base ("really gives a different vibe"), and flock for its numbers and the way groups split and rejoin.

First to change: aurora (squished on phone, faint on bright base, sharp streaks), sunbeam (invisible on bright base), and flock, fireworks and digital for their look (circles, balls, small bars).

## Not tested

Phone hamburger menu contents, the guest player's Add to your AI button, Cursor, GitHub Copilot and Anything else app tabs (marked Not tested yet), sunbeam across new sessions, and any browser other than the ones used.
