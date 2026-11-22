# Testing

`pnpm typecheck` and `pnpm test` (Vitest, all packages) run in CI on every pull request. A test never reads a doc: when behaviour changes, update the doc in the same commit.

## Automated tests

### packages/engine
- Determinism: same state + seed → identical buffers (Node).
- No NaN/Infinity, output within ±1 for random valid states.
- Glide: changing cutoff produces a smooth centroid change, no clicks.
- Arp: note events match the pattern, rate and density for known seeds.
- Bass layer: renders its own note events at the requested step; no events when `bass.on` is false.
- Motif: first bar after the lead-in, repeat, late joiner, same id, new id, master cap.
- Shared timeline: engine onsets match `beatsAt` (a fractional write, a rate change, a glide).
- `drive = 0` is bit-identical to the same state without the drive stage.

### packages/shared
- Mood mapping: monotonicity, bounds, snapshots, variety over moods in [0.4, 0.7]^5 (mood-mapping.md, "Unit tests to write").
- Limits: each clamp rule (volume 0.9, echo, `listenerDb`, `pulseHz` at 3 Hz) with adversarial inputs.
- Analysis: features on synthetic signals; `reads_as` orders the reference moods the same way as the intent; round trips of warmth and joy.
- Feedback builder: omits empty fields, rounding, compact length.
- Zod schemas reject out-of-range values with readable errors.
- Picture (`visual.test.ts`): the frame model is pure, `capFrame` holds small elements to 10% of the view and 400 items.

### apps/web
- `verifyToken`: valid token, expired token, token without `client_id`, wrong issuer.
- Tools (`lib/mcp/*.test.ts`, with a fake database): session resolution, rate limit, error shapes, modes and locks, the instructions length.
- `service.integration.test.ts` and `scripts/test-api.sh`: the tool code against a real Postgres behind PostgREST (needs Docker).
- `scripts/test-db.sh`: all migrations on a throwaway Postgres, then `supabase/tests/rls.sql`: a second user cannot read or write another user's session, an anonymous listener can read and send heartbeats but not write states (needs Docker).
- `emails/templates.test.ts`: `emails/dist/` is up to date and templates use only variables Supabase provides.
- Stop hook: `scripts/claude-code/sonorous-stop-hook.test.ts`.

## Manual checks
- MCP Inspector (`npx @modelcontextprotocol/inspector`): OAuth flow, list tools, call each tool.
- claude.ai web: add the connector, run a conversation of 10+ messages, check the final call happens every message.
- Mobile: open the player on a phone while chatting on the laptop; then chat on the phone with the player in another tab, and note what happens to audio (mobile.md).
- Look at the picture on `/dev/visuals` and the controls on `/dev/controls`.

## Before a release
1. `pnpm build`, `pnpm typecheck` and `pnpm test` pass; migrations apply (`scripts/test-db.sh`) and the RLS tests pass.
2. **OAuth:** claude.ai can add the connector, the consent page appears, and an authenticated `tools/list` succeeds. A request without a token gets 401 with the `WWW-Authenticate` header.
3. **Tools and player:** `start_session` returns a working link; `set_sound` changes the sound in the open player within about 1 s; glides are smooth; colour follows.
4. **Feedback:** it includes `sound` and `reads_as`, analysis stays under 300 ms and the feedback stays compact.
5. **Reactions:** presses appear in the next feedback exactly once; settings are rejected for non-owners.
6. **Several listeners:** a second browser opens the player link with no account and hears the same sound; it cannot change settings.
7. **Final-update hook (Claude Code):** a turn without a final call is blocked and the model is told to make one.
8. **Mobile:** audio behaves as described in mobile.md.
