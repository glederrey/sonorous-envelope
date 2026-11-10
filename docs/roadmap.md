# Roadmap

Detailed specs for each step are in `docs/implementation/`. Acceptance criteria are in `docs/implementation/testing.md`.

Last updated at v0.1.9 (2026-11-09, after the second outside test). Step numbers (1 to 12) are stable names used by other docs; the order of work is the checklist below. Issues are on GitHub: `#N`.

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

### 3. Owner controls and gestures (steps 5 and 6)
- [ ] **Step 5, second half.** Reaction buttons for the owner and the reaction log returned to the model; the owner-side `rest_after` setting with its notice. (The limits, consent and colour-limits panel is dropped: those limits were removed on 2026-11-09 and come back as a designed piece.)
- [ ] **Step 6. Gestures.** First set (purr, meow_up, meow_down, chirp, laugh, growl, sigh, hum, pluck, breath), with a switch to mute them, and the purr spectral test (no tonal component above 250 Hz). Wording is ready in server-instructions.md, to restore when they ship.

### 4. Modes and richer output
- [ ] **#16 Modes.** `mode` on `start_session`, fixed per session, per-mode guidance in the result, different feedback emphasis. Inner (the sound is Claude's own state, never announced), outer (Claude may talk about the sound), and Strudel (below).
- [ ] **#18 Strudel as a separate mode.** Decided: Strudel is its own `mode`, not a replacement for the built-in synth. Claude writes Strudel code, the player runs it in the browser and shows the code to listeners. The AGPL licence is already set up for it ([licensing.md](licensing.md)). Needs a design for safety and feedback first (limits on code, volume cap, what feedback means). Sonic Pi stays out: it cannot run in a browser. Do after #16.
- [ ] **Step 12. Richer visuals.** More shapes, gradients and motion for the colour field ([visuals.md](visuals.md)).
- [ ] **Landing page extras.** Live colour field behind the hero, "Play a sample" button.

### 5. Later
- [ ] **Step 7. Mood estimate.** Heuristics for all five axes, then an Essentia model for joy and calm to compare.
- [ ] **Step 8. Several listeners, second half.** Labelled reactions; optional comments or reactions from link listeners through a bounded no-account function.
- [ ] **Step 9. Final-update enforcement in Claude Code.** A `Stop` hook that asks the server (`GET /api/hook/turn-status?session=<id>`, authenticated) whether the latest state is final; if not, it blocks the stop and tells the model to call `set_sound` with `final: true`. Check the current Claude Code hook format first.
- [ ] **Step 10. Opt-in spectrogram.** `image_feedback` setting and `inspect` tool.
- [ ] **Step 11. Server-rendered audio stream** on an always-on host. No longer needed for background playback on Android (solved with the keep-alive file), but it would give every listener the identical sound (#34) and may be the only way on iPhone. Cost guard rails if built: render only while someone listens, caps on streams and listeners, stop after a few minutes of silence, auto-stop host. Echo and volume would stop being per listener. MCP Apps player if the mobile app supports it.
- [ ] **#11 Sitemap and robots.** Not scheduled.

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
