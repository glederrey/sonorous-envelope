# Roadmap

Detailed specs for each step are in `docs/implementation/`. Acceptance criteria are in `docs/implementation/testing.md`.

Last updated at v0.12.7 (2026-11-10, after the eighth outside test). Step numbers (1 to 12) are stable names used by other docs; the order of work is the checklist below. Issues are on GitHub: `#N`.

## Checklist, in the order we plan to do it

### Done
- [x] **Step 1. Foundations** (v0.0.1 to v0.0.7). Next.js on Vercel (Frankfurt), domain `sonorous-envelope.com`, release-only deploy, CI, schema with Row Level Security on Supabase, login (email and password, Google, magic link, password reset), designed auth emails through Resend.
- [x] **Step 2. OAuth for the connector.** Supabase OAuth 2.1 server, consent page, protected resource metadata, token validation on `/api/mcp`. Works in claude.ai.
- [x] **Step 3. First tools and player** (v0.0.9). `start_session`, `set_sound`, `get_feedback`, `silence`; the shared engine; the player at `/s/<id>`; owner share link and the sessions list.
- [x] **Open player link with no account** (v0.0.9). Listeners only listen and see; limits and controls stay with the signed-in owner (hosting-and-auth.md, "Owner and listeners").
- [x] **The sound is Claude's own state** (v0.0.10). Claude writes first, sets the sound mid-answer, never announces it.
- [x] **Basic feedback** (step 4, first half): `intent`, `playing`, `clamped`, `colour`, `controls`, `players`, `notes`; turn tracking; rate limits.
- [x] **Licence and footer.** AGPL-3.0-or-later, footer with licence, source and version on every page (AGPL section 13). See [licensing.md](licensing.md).
- [x] **Phone: layout and controls** (v0.0.12). Burger menu on phones, touch baseline (no tap flash, hover only for mice, press feedback, safe-area padding, status-bar colour), one control panel on the player (status, mute, volume and echo sliders, share link), hide-controls button, QR code ("Open on phone", wide screens only), the player fits the screen with no scrolling when the controls are hidden. Light theme fixes (v0.0.12) and the hero fade (v0.0.13).
- [x] **Phone: music follows Claude in the background** (v0.0.14 to v0.0.20, #19). Tested on Android Chrome. Chrome treats a page as playing media only if a real media file plays, so the player loops a 60 s near-silent file (`public/keepalive.wav`, 16-bit, about -84 dBFS, element volume 0.05) and sets a live Media Session (no seek bar). That keeps the tab alive with the screen off and in another app, shows a lock-screen player, and lets the page's requests through. Muting pauses the file, so the lock-screen player shows Play. A worker timer and the worker's own state fetch, one check at a time, a Resume button, and a `?debug=1` report on the player URL. See the history in [roadmap notes](#behaviour-changes-made-along-the-way). Also played on an iPhone.
- [x] **Claude names the session** (v0.0.15). `title` on `set_sound`; the sessions page shows the date when there is none.
- [x] **New sessions start at "anything"** (v0.0.19, temporary). One constant, `NEW_SESSION_CONSENT` (limits.md).
- [x] **Local listener controls** (step 5, first half): volume, echo and mute on each device; limits, consent and mood floor enforced on the server.

### 1. Phone first (done)
- [x] **#15 Volume on the phone.** Fine on Android. On an iPhone the sound is quieter (the web volume of an audio element is ignored there) and a linear slider did little, so the slider now works in decibels (-48 to +12 dB, 80 is unity, still shown 0 to 100) and the engine accepts a gain up to 4 (v0.1.0, `lib/volume.ts`). The `audioSession` playback type is set for iOS.
- [x] **Tested on an iPhone** (a borrowed one): the sound plays; quieter than Android, which the volume change addresses. Background playback on iPhone is not tested in depth.

### 2. Listening and sound quality
- [x] **#30 Sessions always show as active.** The sessions page says "Active" for every session that was not ended, and nothing ever ends a session except the cap of 10. Decided: derive it from the last sound (`INACTIVE_AFTER_S`, 30 minutes, whatever the fade setting) and show "last sound 2 h ago" once inactive. Small, do it first.
- [x] **Sessions lifecycle** (2026-11-09): inactive after 30 min, shown as ended and ended by `start_session` after 7 days without a sound, 'Older' group after 1 day, an End session button on the sessions page.
- [x] **Limits removed, volume the listener's, colours free** (2026-11-09): see safety.md. Limits come back later as a designed piece.
- [x] **Presence between turns.** (built; owner-side setting and notice wait for step 5.) The sound that keeps playing reads as a heartbeat, and people said goodbye several times. Decided: (1) an owner setting `rest_after`, off or in seconds, default 5 min for the inner voice and off for the outer voice (the listener of outer-voice music wants it as long as possible); `resting` in the feedback only when on; (2) when the user says the session is over, Claude plays a short closing sound of its own and calls `silence` with `end: true`, which ends the session. No automatic figure from the player. `rest_after` is shared: Claude and the owner can both change it, while safety boundaries stay owner-only (limits.md, "Who can change what"). Spec: player-ui.md, "Presence between turns"; safety.md. The 30-minute `INACTIVE_AFTER_S` for the #30 label is decided and independent. A coarse clock offset is enough, no need for #34.
- [x] **#34 Everyone should hear exactly the same thing.** (built 2026-11-09 as option (a), see engine.md "Shared timeline"; the text below is the original problem statement.) Today each device starts its own engine and gets changes a moment apart, so the arpeggio and the movements are shifted, and echo is a per-listener setting. Options: (a) a shared clock: each state carries its start time, the player keeps a server-clock offset and starts the engine at the right position, so every device renders the same samples; (b) the server stream of step 11, which is identical for everyone by construction. Either way the echo can no longer be per listener (it becomes a session setting, owner's choice). Decide between (a) and (b) with step 11.
- [x] **#17 Music is too similar.** (built: stretch, voice, instructions; listen and tune by ear.) First outside test: instances that send only the five axes all give four rising, slightly hesitant notes; the manual synth gave clearly different results. Cause: the mapping's thresholds and rounding collapse the middle band (0.4 to 0.7) onto one shape, and instances send cautious values (0.45 to 0.72). Plan, in order:
  1. **Stretch the axes** (`stretch(x) = clamp(0.5 + 1.6·(x − 0.5), 0, 1)`) and make form depend on them: spontaneity picks `as_played` or `random`, closeness sets octaves and an open voicing, calm sets the rate.
  2. **A voice of its own**: the instance chooses root, scale, chord shape, note order, octaves and wave at the start; it persists by default and the instance may change it at any time. A seeded character from the session id is the fallback when it chooses none.
  3. **Rewrite the instructions**: the override is free, the mapping is the safety net, use the full range.
  Specs: mood-mapping.md ("Stretch", "Voice", top note), sound-model.md, server-instructions.md ("Planned changes"). Includes a regression test: moods in [0.4, 0.7]^5 must give several distinct shapes. The old idea of a variety note in the feedback ("you have sent this same shape three turns in a row") is kept as a later option: first see whether stretch and voice are enough.
- [x] **Polyphony and the amp LFO.** (built: `osc.stack`, `pad`, amp LFO to 80 Hz; no consent row or harshness term since the limits are gone.) `osc.voices` is unison only (confirmed), the arpeggio is monophonic, the drone is the only real polyphony, and the LFO stops at 12 Hz. Plan: `osc.stack` (intervals, so each arp note is a chord), a `pad` layer separate from the drone, and an amp LFO up to about 80 Hz (purr grain near 25 Hz, growl grain 30 to 70 Hz). The fast amp LFO is roughness: it needs a consent row and a harshness term, and it never drives the colour pulse. Specs: engine.md, limits.md, mcp-tools.md ("Planned changes"), sound-model.md.
- [x] **"What Claude set" panel** in the player: shows the last mood, the effective sound, any clamps and Claude's latest `note` (decided 2026-11-09: the note is shown to the owner and listed in `inspect` history, not echoed in every feedback). Small; fits step 5.
- [x] **Step 4, second half. Analysis.** (built: `sound`, `reads_as`, `inspect` history; see analysis.md. Spectrogram stays with step 10.) Offline render with the shared engine, perceptual features, `sound`, `reads_as`; the `inspect` tool.
- [x] **Audience (`aud`) check** on OAuth tokens (step 2 leftover). Supabase documents `aud` as the constant `authenticated`, so the check is a token-type check, not resource binding (auth.md). Confirm the connector still works after the release.
- [x] **Second outside test (2026-11-09, a model tested through the connector; ChatGPT works too).** Done: `rest_after` default 5 to 15 min; user-facing text says "the model" instead of "Claude". The four findings:
  - [x] **Voice drifts when none is set** (v0.1.9). Without a `voice`, scale, root and wave are redrawn from the mood on every call. Now `set_sound` takes `keep_voice: true`, which stores what plays now as the session voice, and a call that moved the voice says so in `notes` ("no full voice: the mood moved the voice from X to Y"). Spec: mcp-tools.md.
  - [x] **Say how a tempo change was applied.** The result shows only the end state; the tempo steps at the state start (shared grid, #34). Add a short `tempo` note (`stepped`) to `playing` or state it in the tool description.
  - [x] **`reads_as` hint.** Joy sent at 0.6 read about 0.28, and brightness stayed "very low" at a 3200 Hz cutoff. Add a one-line "pulled by" hint per axis (mode, density, wave, cutoff) so the model can see which parameters move it. Check the joy estimate in the calibration by ear.
  - [x] **Mood-free synth test.** `mood` is optional on `set_sound`; left out, the last mood stays and a note says so. With `keep_voice` this covers synth-only tests.
  - Not changing: the fade itself (correct), a wait tool (not our channel).
- [x] **Sound after dictation (first outside test).** (built; phone-tested 2026-11-10, dictation works well.) On a phone the sound nearly disappears while the user dictates. Probably the system ducking other audio when the mic opens. Add `statechange` and keep-alive `pause` handling that resumes without a tap, add the events to the `?debug=1` report, test `navigator.audioSession` on iOS, and document the fallback (player on another device). Spec: [mobile.md](mobile.md), "Dictation", and player-ui.md, "Mobile notes".
- [x] **Calibration by ear** (below), after the above. (Done 2026-11-10: calibration sounds pretty good. A five-round guessing game with a model followed; its findings are in "Third outside test".)

### Third outside test (2026-11-10)
A model played five rounds of a chosen emotion and the user guessed (two near hits, two partials, one miss). Findings and what we did:
- [x] **Valence tangled with brightness and mode.** A minor mood on a square wave with an open filter read joy 0.52 against 0.2. The estimator now reads joy from mode and consonance, with brightness and tempo only nudging it (analysis.md). No new valence axis: joy and calm already are valence and arousal.
- [x] **Calm hard to push down.** Calm 0.12 sent read 0.48. The estimator now counts tempo and roughness and uses narrower density and loudness ranges: the most urgent mood reads about 0.3.
- [x] **Fear, awe and anger overlap.** New optional `tension` control and `reads_as.tension` (mood-mapping.md, "Tension").
- [x] **Tempo jumps.** The tempo now glides over the transition, with the shared timeline kept (engine.md, `ramp.ts`).
- [x] **The note leaks the answer.** The server cannot hide tool-call arguments, and the mood numbers leak as much as the note. Done: the instructions say to leave `note` out in a guessing game, and the player has a switch that hides the "What the model set" panel. Not done, on purpose: a hidden channel for the note.
- Honesty caveat: acting out an emotion tests how well the sound communicates, not the model's state. It is the argument for the outer mode (#16).

### Fourth outside test (2026-11-10, v0.7.1 to v0.11)
Gael's first look at the owner controls, and a scripted test by a model on the live session. What we did:
- [x] Invitee panel is volume, mute, hide, share row only. Owner panel: reaction buttons only on the external face, with a "waiting for Claude" line (the server cannot push to the model); every press counts; Settings block; fade select readable.
- [x] The `/s/` scrollbar came from the drift and breathe lights moving past the box (transforms count as overflow). They now animate inside it.
- [x] Guessing-game hide switch and wording removed.
- [x] Inner and outer became **internal and external faces** (Anzieu). Default `auto`: starts internal; the model may offer a switch in words and switch only after a yes or a clear request; the server enforces 2 finished messages and 2 minutes before going external; an owner lock (Auto, Internal, External) is final; every change is logged and shown in `inspect`; everyone sees the face. Migration 0008.
- [x] ~~Gestures~~ (removed in v0.12 after the next test found them inaudible; see below): six (dropped meow_up as an appeal, meow_down, hum, breath), louder at 0.5, a session setting for everyone (default on for external, off for internal), soft and no growl on the internal face, `gesture: played | skipped: reason` and `gestures: off` in the result.
- [x] Tension: a fifth stack level (semitone, tritone, major seventh) and a per-note clash reading so the top step is heard. Calm reading a little lower under tension is the sound, not a fault (documented).
- [x] Turn counter: a turn is one message (3 minutes stale limit), so a batch of calls no longer reports "no final update last turn".
- [x] Landing: live counter (`live_counts`, migration 0007), samples levelled by measured loudness and played louder, Play and Stop share a pill, the faces section and the `/faces` page with reading, the guide explains faces.
- [x] Closed (v0.12.7): the tension readback after a big drop (a ghost reading of 0.47 during a glide) and the swings by gesture tail were not reproduced. Tension is now read from the clash inside one onset, so a tail or a glide cannot leave a ghost reading, and the gestures are gone. `reads_as` joy under `keep_voice` stays low by design (the scale sets joy); the instructions now say so.

### Fifth outside test (2026-11-10, v0.11.1)
Gael and a model ran the test list on the live site. Passed: owner panel, reactions round trip, auto rules, owner lock, internal face, turn counter, landing, faces and guide. Found, and what we did (v0.12):
- [x] **Gestures removed** (inaudible in the test, and against the ask-in-words rule): schema, engine voice, owner setting, result fields, guidance, guide, samples.
- [x] **Cooldown removed** (Gael, after the test; the model agreed with dropping the timer and keeping consent). It had started from the owner's changes too: **Cooldown started from the owner's changes** (a user who set Auto and said yes within 2 minutes got no switch). It now counts only the model's own switches.
- [x] **The reading swung with identical settings** (random note order differed per call, since the analysis used the playback seed). It now uses one fixed seed: the same sound always reads the same.
- [x] The start state no longer shows as "turn 0" in `inspect`.
- [x] Phone chip and status line shortened (lock icon for "locked"); dropdown lists follow the page theme; the live counter has its own box with a slow teal to amber dot; "Step by step" hides below 420 px.
- [x] **Sticky first voice**: without a voice of its own, the first sound the model sets becomes its voice (scale, root, note order, wave) and stays until it sends a voice, so a mood that barely moves cannot move the key. The cost: joy no longer lifts the scale by itself.
- [x] The "How is it landing?" block starts closed when the controls open.
- [x] Tension adds about 6 dB across a five-step sweep; the 4 dB cap limits a call, not the climb over several calls. Decided: fine. A climb over several calls is the gradual move the Care rules ask for, and the listener's volume stays theirs; a cumulative cap would block a deliberate build.
- [x] Instructions trimmed from about 900 to about 790 words (v0.12.8): the feedback fields moved into the `set_sound` description, the synth and voice persistence into the schema descriptions. Further cuts would touch the Care rules and the face rules, which are design, not detail; a test keeps them under 800.

### Sixth outside test (2026-11-10, v0.12.3)
Voice bands, tension, faces and reactions passed; the visuals were all good. Done after it:
- [x] The live counter's glow follows the dot (teal, then amber), not teal only.
- [x] Reactions: **Stormier** (opposite of calmer) and **Harsher** (opposite of softer) added, "More of this" and "Less of this" moved to the end as a like or dislike signal (migration 0009).
Seventh test (v0.12.4): the new buttons and the long mode transition passed. Done after it: the dot glow is a ring in the dot's own colour, two pulses per colour step; the arpeggio no longer switches off at calm above 0.9 with low joy; the instructions say one-call synth settings revert. Open, from the tests:
- [x] **Tension reading depended on rate and density, not on the voice** (v0.12.7: it now counts the clash inside one onset only, and reads 0, 0.22, 0.45, 0.73, 1.0 for 0.1 to 0.9 on every voice and rate; the tester's four-voice table showed the voice moved it by at most 0.12). Earlier: **Tension reading depends on the voice** (C dorian sine at 0.4 read 0.81, A minor sawtooth at 0.5 read 0.06): the low stack levels alone will not fix it; the estimate follows rate and density too.
- [x] **Loudness can jump on a small request** ("stormier" took the level from -26 to -19 dB in one call): a call now raises the level by at most 4 dB (v0.12.6), with a note.
- [x] **Roughness follows tempo and density more than timbre** (harsher step read 0.90 to 0.50): documented as note-level dissonance, not timbre.
- [x] **`playing` did not echo osc.detune or filter.resonance**, so a caller cannot confirm they were applied.
- [x] Reaction counts: one press shows x1 (checked in the v0.12.5 test); the earlier x2 was two presses.
- [x] **Tension reads flat up to 0.5** (fixed in v0.12.7, see above) (sent 0.1, 0.3, 0.5, 0.7, 0.9 read 0.00, 0.00, 0.06, 0.55, 1.00): the stack steps at 0.12, 0.3 and 0.5 add little clash. Retune `RANGES.clash` or the low stack levels.
- [x] **Very calm states turn the arpeggio off** (fixed in v0.12.5: the arp stays on), so the spontaneity reading is flat (0.05 at calm 0.9). Keep a minimal arp on, or document that there is no timing to read.
- [x] **The middle voice band is narrow.** (Closed: by ear, a 20 s joy jump from 0.1 to 0.95 does not jump; the narrow dorian band is the hysteresis.) From phrygian, joy 0.4 stays phrygian and 0.7 goes straight to lydian (hysteresis, by design); dorian shows around 0.5. Listen by ear whether the mode change eases in over a long transition.

### Eighth test (2026-11-10, v0.12.7)
Tension reads 0, 0.22, 0.45, 0.73, 1.0 on every voice and rate and at calm 0.2 and 0.9; the joy bands still switch at the same thresholds, with the tension term lowering joy by 0.05 to 0.07. Noted, by design and not open: tension 0.6 and 0.7 share a stack, so they read the same (the reading follows the stack steps); a sound with tension also reads less calm (it is denser and more resonant); joy reads a little lower in the lydian band than in v0.12.3 (0.67 against 0.74) and 0.7 and 0.95 read the same (the scale caps joy, and tempo and brightness nudge it, so a slow closing sound in dorian reads 0.29).

### 3. Owner controls and gestures (steps 5 and 6)
- [x] **Step 5, second half.** (built 2026-11-10; tested as the owner in the fourth to eighth outside tests.) Reaction buttons for the owner and the reaction log returned to the model; the owner-side `rest_after` setting with its notice. (The limits, consent and colour-limits panel is dropped: those limits were removed on 2026-11-09 and come back as a designed piece.)
- [x] **Step 6. Gestures.** Built 2026-11-10, then removed in v0.12: the tester found them inaudible, and they went against the ask-in-words rule (see the fifth outside test).

### 4. Modes and richer output
- [x] **#16 Modes.** (built 2026-11-10 as inner and outer, now the internal and external faces with an auto policy; Strudel not started, see #18.) `mode` on `start_session`, fixed per session, per-mode guidance in the result, different feedback emphasis. Inner (the sound is Claude's own state, never announced), outer (Claude may talk about the sound), and Strudel (below).
- [ ] **#18 Strudel as a separate mode.** Decided: Strudel is its own `mode`, not a replacement for the built-in synth. Claude writes Strudel code, the player runs it in the browser and shows the code to listeners. The AGPL licence is already set up for it ([licensing.md](licensing.md)). Needs a design for safety and feedback first (limits on code, volume cap, what feedback means). Sonic Pi stays out: it cannot run in a browser. Do after #16. Not started: it runs model-written code in a browser page on our origin, which needs its own sandbox design (a sandboxed iframe, a code length limit, a gain cap enforced outside the code) before any line is written.
- [ ] **Step 12. Richer visuals.** First step built 2026-11-10: radial and conic gradients (`shape`) and `breathe` ([visuals.md](visuals.md)). Scenes, shapes and particles are still open.
- [x] **Landing page extras.** "Hear what to expect": five emotion samples (tender, nervous, awe, irritated, relief) on the shared engine, `apps/web/components/sample-player.tsx` and `apps/web/lib/samples.ts`, tested in a browser on 2026-11-10 (plays, stops, no console errors); the live colour field behind the hero is the line animation merged in #59. Samples are our own imagined states: tune by ear.

### 5. Later
- [x] **Step 7a. Mood estimate, heuristics.** `reads_as` for all five axes and tension, calibrated with `pnpm calibrate` (analysis.md).
- [ ] **Step 7b. Essentia model** for joy and calm, to compare with the heuristics.
- [ ] **Step 8. Several listeners, second half.** Labelled reactions; optional comments or reactions from link listeners through a bounded no-account function.
- [ ] **Step 9. Final-update enforcement in Claude Code.** A `Stop` hook that asks the server (`GET /api/hook/turn-status?session=<id>`, authenticated) whether the latest state is final; if not, it blocks the stop and tells the model to call `set_sound` with `final: true`. Check the current Claude Code hook format first.
- [ ] **Step 10. Opt-in spectrogram.** `image_feedback` setting and `inspect` tool.
- [ ] **Step 11. Server-rendered audio stream** on an always-on host. No longer needed for background playback on Android (solved with the keep-alive file), but it would give every listener the identical sound (#34) and may be the only way on iPhone. Cost guard rails if built: render only while someone listens, caps on streams and listeners, stop after a few minutes of silence, auto-stop host. Echo and volume would stop being per listener. MCP Apps player if the mobile app supports it.
- [x] **#11 Sitemap and robots.** Added (`apps/web/app/sitemap.ts`, `robots.ts`).

### First outside test (2026-11-09)
Session, player and `set_sound` feedback worked: changes were heard live without reopening the page, and the owner's volume and echo reached the instance. Four findings, all now in the checklist above and in the specs: sound cut during dictation, instances too alike, the sound reading as a presence between turns, and the limits of polyphony and the LFO. Two more observations went into [emotion-to-sound.md](emotion-to-sound.md), "Open questions": cautious axis values that do not match what the instance's `note` says, and the `note` field never being sent back.

### Behaviour changes made along the way
- v0.0.10: the server instructions treat the sound as the model's own state, not ambience for the user. It writes first, sets the sound mid-answer, and never announces or offers to adjust it (server-instructions.md, "Why it reads this way").
- v0.0.14 to v0.0.20 (background playback): four browser-side attempts failed on a real phone before the fix, and the debug report is what showed why. A worker timer and worker fetch (v0.0.14, v0.0.16) did not help; routing the synth through an audio element (v0.0.17) did not either. The report showed the page and audio alive but requests stalled, and there was no lock-screen player: Chrome never counted the page as playing media. A 1 s blob and a MediaStream element do not qualify; a real 60 s file does (v0.0.18). Then: near-silent file (v0.0.19), live media session, and muting pauses the file (v0.0.20).
- v0.0.19: new sessions start at the "anything" consent level, as a temporary exception.
- Open player link with no account (instead of invites or anonymous sign-ins): see hosting-and-auth.md, "Owner and listeners".

## Landing page

Spec: [player-ui.md](implementation/player-ui.md), "The landing page". It is not a numbered step because it grows with the others:
- **With step 1:** the static page, all seven sections, no JavaScript needed. Replaces the current placeholder. The connector URL in "Add it to Claude" is built from `PUBLIC_BASE_URL`; the "Sign in" link works once login exists.
- **After step 3:** the live colour field behind the hero and the optional "Play a sample" button, both on the shared engine.
- **With every tool that ships:** mark it live on the `/guide` page.
- **Before the public launch:** check the claude.ai connector menu names in section 4 (see CLAUDE.md, "Things to verify").

## Calibration by ear

The mapping in mood-mapping.md is a first guess. After step 3 and again after step 6, set aside a listening session:
- Play the eight corners of joy × calm × warmth and check each reads as the emotion in the chord-quality table.
- Check the two arpeggios: is the slow bass layer heard as a background mood, apart from the mid arpeggio? If not, drop the mapped drone or change the update fraction (0.25).
- Compare the gestures to their sources (meow request vs complaint, purr vs growl).
- Tune the constants marked "starting value". Record results in docs/emotion-to-sound.md, "Open questions".

## Scope

The order of work is the checklist at the top. Step 11 (server-rendered audio) is now optional: background playback works on Android without it, but it may be the way to #34 and to iPhone support.

One pull request per testable group, with one commit per piece of work inside it. Each group is released before the next one builds on it.
1. Steps 1 and 2, with the static landing page. **Released** (v0.0.1 to v0.0.8).
2. Steps 3 and 4, first half. **Released** (v0.0.9, v0.0.10).
3. Phone first: **done** (v0.0.12 to v0.1.0).
4. Listening and sound quality: #30 and presence between turns, dictation, #34, #17 (stretch, voice, instructions), polyphony and the amp LFO, the "what Claude set" panel, the analysis half of step 4. **Next.** It is a lot for one pull request: suggested split, (a) #30, presence and dictation, which are player-side; (b) #17 and the instructions; (c) stack, pad and the amp LFO with their limits; (d) #34 and analysis.
5. Steps 5 and 6: owner controls, reactions, gestures.
6. Modes and richer output (#16, #18, visuals).
7. Later items.
