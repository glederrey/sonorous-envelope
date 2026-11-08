# Roadmap

Detailed specs for each step are in `docs/implementation/`. Acceptance criteria are in `docs/implementation/testing.md`.

1. **Foundations.** Next.js app on Vercel, Supabase project (tables, Row Level Security, Realtime), login with Supabase Auth. *Done: app on Vercel (Frankfurt), release-triggered deploy, CI, schema with RLS and grants on Supabase. Left: login.*
2. **OAuth for the connector.** Supabase OAuth 2.1 server with dynamic client registration, login and consent page, protected resource metadata and token validation on `/api/mcp`. Test by adding the connector in claude.ai.
3. **First tools + player.** `start_session` and `set_sound` (mood axes + synth override + `final` flag) with the usage guidance in the server instructions. Session page with the Web Audio player (arpeggiator, filter, LFO, drone, delay) and colour background, updated through Realtime. The player link is open to anyone and needs no account: listeners read through `get_player_state` and `player_heartbeat` (migration `0002`) and follow a Realtime Broadcast, no invites and no anonymous users.
4. **Analysis + feedback.** Offline render with the shared engine, perceptual features, HSL colour, compact feedback.
5. **Listener controls.** Volume, mute, limits, consent levels, reaction buttons, reaction log returned to the model.
6. **Gestures.** First set (purr, meow_up, meow_down, chirp, laugh, growl, sigh, hum, pluck, breath), with a switch to mute them. Includes the purr spectral test (no tonal component above 250 Hz).
7. **Mood estimate.** Heuristics for all five axes, then an Essentia model for joy and calm to compare.
8. **Several listeners.** The open player link itself comes earlier, with step 3. Listeners can only listen and see; limits and reactions stay with the signed-in owner. Optional later: comments or reactions from listeners, through a bounded no-account function.
9. **Final-update enforcement in Claude Code.** A `Stop` hook that asks the server (`GET /api/hook/turn-status?session=<id>`, authenticated) whether the latest state is final; if not, it blocks the stop and tells the model to call `set_sound` with `final: true`. Check the current Claude Code hook format before building.
10. **Opt-in spectrogram.** `image_feedback` setting and `inspect` tool.
11. **Mobile.** Server-rendered audio stream on an always-on host; MCP Apps player if the mobile app supports it.

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

Steps 1 to 10 and the landing page are being built first. Step 11 (mobile) comes later.

One pull request per testable group, with one commit per piece of work inside it. Each group is released before the next one builds on it.
1. Steps 1 and 2, with the static landing page: login, OAuth, token check on `/api/mcp`. Tested by adding the connector in claude.ai.
2. Steps 3 and 4: `start_session`, `set_sound`, the engine, the player with the open link, analysis and feedback. *Built so far: everything except the analysis half of step 4 (offline render features, `reads_as`, `sound`), which comes in the next PR. Also deferred: `inspect`, gestures, reaction buttons, the owner settings panel.*
3. Steps 5 and 6: listener controls and gestures.
4. Steps 7 to 10: mood estimate, several listeners, the `Stop` hook and the spectrogram.
