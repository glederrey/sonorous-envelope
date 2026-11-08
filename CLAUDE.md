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
   - `limits.md`: applying listener limits and consent levels
   - `analysis.md`: features, mood estimate, spectrogram
   - `realtime.md`: channels, payloads, presence
   - `player-ui.md`: the session page and controls
   - `testing.md`: tests and acceptance criteria per milestone
5. `docs/sound-model.md`, `docs/feedback.md`, `docs/safety.md`, `docs/mobile.md`: design background.
6. `docs/roadmap.md`: build order. Work milestone by milestone.

## Non-negotiable rules
- Safety rules in `docs/safety.md` and `docs/implementation/limits.md` are enforced on the server, never only in the UI. The model can never exceed listener limits.
- No flashing faster than 3 Hz in the colour field, ever.
- Every database access from the MCP endpoint uses the caller's token so Row Level Security applies. Use the service role key only where the docs say so.
- The same DSP engine code renders in the browser and on the server. Do not reimplement the synth twice.
- Randomness in the engine is seeded, so a state renders identically everywhere.
- Keep tool results compact (target ~150 tokens of JSON for `set_sound`).

## Things to verify before relying on them
Library APIs move. Check the installed versions and their docs for:
- `mcp-handler` (2.x needs the MCP SDK v2 packages and zod ^4.2; 1.x uses `@modelcontextprotocol/sdk` 1.x). Pick one line and stay consistent.
- Supabase OAuth 2.1 server (was in public beta from Nov 2025): dashboard setting names, authorization path, JWKS URL, token claims.
- claude.ai's OAuth redirect URI for custom connectors.

If something in the docs turns out to be wrong, fix the code and update the doc in the same commit.

## Conventions
- TypeScript strict mode. pnpm workspaces.
- Small, focused commits. Update docs when behaviour changes.
- Commit messages in English, imperative mood.
