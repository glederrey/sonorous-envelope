# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: a person who talks to Claude (claude.ai, Desktop, Code) and listens to the sound beside the chat. They sign in once, to connect the connector, and then mostly use the player.

Secondary: friends who open a shared player link (`/s/<id>`) with no account, to listen while someone else's Claude plays.

## Product Purpose

A remote MCP server that gives an LLM a non-verbal channel: a small synthesizer and a colour field. The model sets a mood during its turn, a player renders it, and the server returns what actually played plus the listener's reactions. The listener always stays in control (volume, mute, limits, reaction buttons).

## Positioning

A sound and colour channel for an LLM, with feedback on what was really produced. Not a music generator and not a visualiser.

## Operating Context

Sessions start from a chat. The player stays open in a tab or on a second screen while the user reads. Pages outside the player (landing, guide, safety, login, sessions, settings) are short and mostly read or fill a form.

## Capabilities and Constraints

Next.js on Vercel, Supabase (auth, Postgres, Realtime). Safety limits are enforced on the server. No flashing faster than 3 Hz. Live: `start_session`, `set_sound`, `get_feedback`, `silence` and the player at `/s/<id>`. Not yet: gestures, reaction buttons, the owner settings panel, `inspect`, audio analysis (`reads_as`). The landing page must not claim features that are not shipped.

## Brand Commitments

Name "sonorous envelope", lowercase wordmark in JetBrains Mono. Logo: an ADSR envelope drawn as one stroke, amber to teal. Design system in `docs/design-system.md` and `docs/brand/tokens.json` (dark first, Roboto and JetBrains Mono, Lucide icons).

## Evidence on Hand

Logo files in `docs/brand/`. No testimonials, customers or audio samples exist yet; do not invent them.

## Product Principles

1. The listener is in control, always.
2. Say only what has shipped.
3. Sound and colour are the content; the interface recedes.
4. Sign-in is for the owner only; listening needs no account.

## Accessibility & Inclusion

Safety first: no colour-only signals, mute always visible, text at 4.5:1 or more, reduced-motion respected.
