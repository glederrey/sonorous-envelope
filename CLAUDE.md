# sonorous-envelope — instructions for Claude Code

You are building a remote MCP server that lets an LLM express itself through a synthesizer and a colour field, with feedback on what it produced and on how the listener reacted. Read the docs before writing code.

## Read in this order
1. `README.md`: the idea and decisions.
2. `docs/architecture.md`: components and session flow.
3. `docs/hosting-and-auth.md`: Vercel + Supabase, OAuth, multiple users.
4. `docs/implementation/` (the build spec):
   - `stack-and-layout.md`: packages, folders, env vars, commands
   - `database.md` + `database.sql`: schema, RLS, Realtime
   - `auth.md`: OAuth 2.1 with Supabase, step by step
   - `mcp-tools.md`: exact tool schemas, behaviour, errors, feedback format
   - `server-instructions.md`: the verbatim `instructions` text for the MCP server
   - `engine.md`: the shared DSP engine (browser AudioWorklet + Node offline render)
   - `mood-mapping.md`: mood axes → synth parameters, with formulas
   - `limits.md`: the safety rules that remain (listener limits are removed for now)
   - `analysis.md`: features, mood estimate, spectrogram
   - `realtime.md`: channels, payloads, presence
   - `player-ui.md`: the session page and controls
   - `../design-system.md`: the visual design system (artifact link, tokens, logo). Follow it for all UI work.
   - `testing.md`: tests and acceptance criteria per milestone
5. `docs/emotion-to-sound.md` (the evidence behind the mapping), `docs/sound-model.md`, `docs/feedback.md`, `docs/safety.md`, `docs/mobile.md`: design background.
6. `docs/roadmap.md`: build order. Work milestone by milestone.

## Non-negotiable rules
- Listener limits and consent levels are removed for now (Gael's decision, 2026-11-09): Claude decides how it sounds and looks, the listener only sets the volume. They come back later as a designed piece of work. What stays, enforced on the server and again in the player: the colour never pulses faster than 3 Hz, the master volume never goes above 0.9, and Claude cannot set the volume (`docs/implementation/limits.md`).
- No flashing faster than 3 Hz in the colour field, ever.
- Every database access from the MCP endpoint uses the caller's token so Row Level Security applies. Use the service role key only where the docs say so.
- The same DSP engine code renders in the browser and on the server. Do not reimplement the synth twice.
- Randomness in the engine is seeded, so a state renders identically everywhere.
- Keep tool results compact (target ~250 tokens of JSON for `set_sound`; `playing` mirrors what Claude can set, so it can check its choices arrived).

## Things to verify before relying on them
Library APIs move. Check the installed versions and their docs for:
- `mcp-handler`: decided on the 2.x line (`mcp-handler` 2.3, `@modelcontextprotocol/server` v2, zod 4). Do not mix in `@modelcontextprotocol/sdk` 1.x. `registerTool` takes a full zod object as `inputSchema`; auth info is `ctx.http?.authInfo`.
- Supabase OAuth 2.1 server (was in public beta from Nov 2025): dashboard setting names, authorization path, JWKS URL, token claims.
- claude.ai's OAuth redirect URI for custom connectors.

If something in the docs turns out to be wrong, fix the code and update the doc in the same commit.

## Conventions
- TypeScript strict mode. pnpm workspaces.
- Small, focused commits. Update docs when behaviour changes.
- Commit messages in English, imperative mood.
