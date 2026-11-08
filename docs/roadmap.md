# Roadmap

Detailed specs for each step are in `docs/implementation/`. Acceptance criteria are in `docs/implementation/testing.md`.

Status key: **done**, **partial** (what is built and what is left), **todo**. Last updated at v0.0.10 (2026-11-08).

1. **Foundations.** **Done** (v0.0.1 to v0.0.7). Next.js on Vercel (Frankfurt) with the domain `sonorous-envelope.com`, release-only deploy, CI, schema with Row Level Security and grants on Supabase, login (email and password, Google, magic link, password reset), designed auth emails through Resend, header with sign out.
2. **OAuth for the connector.** **Done.** Supabase OAuth 2.1 server, consent page, protected resource metadata, token validation on `/api/mcp`. Works in claude.ai. Still to do: the audience (`aud`) check on tokens.
3. **First tools + player.** **Done** (v0.0.9). `start_session`, `set_sound`, `get_feedback`, `silence`; the shared engine (arpeggio, slow bass layer, drone, filter, LFOs, echo, reverb); the player at `/s/<id>`, open to anyone with the link and no account (migration `0002`); owner share link and the sessions list. Not done from the original text: `inspect`, and the landing page's live colour field and "Play a sample".
4. **Analysis + feedback.** **Partial.** Done: compact feedback (`intent`, `playing`, `clamped`, `colour`, `controls`, `players`, `notes`), turn tracking, rate limits. Todo: offline render with the shared engine, perceptual features, `sound`, `reads_as`.
5. **Listener controls.** **Partial.** Done: volume, echo and mute on each device; limits, consent levels and mood floor enforced on the server with safe defaults. Todo: the owner panel to change limits, consent and colour limits, reaction buttons, the reaction log returned to the model.
6. **Gestures.** **Todo.** First set (purr, meow_up, meow_down, chirp, laugh, growl, sigh, hum, pluck, breath), with a switch to mute them. Includes the purr spectral test (no tonal component above 250 Hz). The server instructions already have the wording for them in server-instructions.md, to restore when they ship.
7. **Mood estimate.** **Todo.** Heuristics for all five axes, then an Essentia model for joy and calm to compare.
8. **Several listeners.** **Partial.** Done: the open link; listeners can only listen and see, limits and reactions stay with the signed-in owner. Todo: labelled reactions. Optional later: comments or reactions from listeners, through a bounded no-account function.
9. **Final-update enforcement in Claude Code.** **Todo.** A `Stop` hook that asks the server (`GET /api/hook/turn-status?session=<id>`, authenticated) whether the latest state is final; if not, it blocks the stop and tells the model to call `set_sound` with `final: true`. Check the current Claude Code hook format before building.
10. **Opt-in spectrogram.** **Todo.** `image_feedback` setting and `inspect` tool.
11. **Mobile.** **Later.** Server-rendered audio stream on an always-on host; MCP Apps player if the mobile app supports it.
12. **Richer visuals.** **Idea, not scheduled.** More shapes, gradients and motion for the colour field. Notes in [visuals.md](visuals.md).

### Behaviour changes made along the way
- v0.0.10: the server instructions treat the sound as the model's own state, not ambience for the user. It writes first, sets the sound mid-answer, and never announces or offers to adjust it (server-instructions.md, "Why it reads this way").
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

Steps 1 to 10 and the landing page are being built first. Step 11 (mobile) comes later; step 12 is an idea.

One pull request per testable group, with one commit per piece of work inside it. Each group is released before the next one builds on it.
1. Steps 1 and 2, with the static landing page. **Released** (v0.0.1 to v0.0.8, including the sign-in redesign and emails).
2. Steps 3 and 4: **released in part** (v0.0.9, v0.0.10). Built: tools, engine, player, basic feedback. Left from this group: the analysis half of step 4 (`reads_as`, `sound`), `inspect`.
3. Steps 5 and 6: listener controls (owner panel, reactions) and gestures. **Next.**
4. Steps 7 to 10: mood estimate, labelled reactions for several listeners, the `Stop` hook and the spectrogram.
