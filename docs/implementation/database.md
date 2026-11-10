# Database

The full schema is in [database.sql](database.sql). Copy it to `supabase/migrations/0001_init.sql`.

## Tables at a glance

| Table | What it holds |
|---|---|
| `profiles` | One row per user, created by a trigger on signup. Holds default listener settings. |
| `sessions` | One per conversation. Owner, settings (limits, consent, image feedback), current state, turn counter, `pending_final` flag, `voice` (jsonb, the instance's chosen voice, null if none; migration 0004), `sticky` (jsonb, colour, stack, pad and LFOs kept until Claude changes them; migration 0005), `mode` (the face playing now: `internal` or `external`; migrations 0006 and 0008), `mode_policy` (`auto`, or the face the owner locked; migration 0008). |
| `states` | Every `set_sound` call: intent (what the model sent), effective state (what plays), clamps, analysis, PRNG seed. |
| `listeners` | The owner gets a row with role `owner` and label `you` when the session is created. Link-only listeners have no row: they are not accounts. |
| `invites` | Unused: the player link is open, so there are no invite tokens. Drop it with `redeem_invite` in migration `0002`. |
| `reactions` | Listener actions, with `delivered_at` set once returned to the model. |

## Migration `0002_player_access.sql`
Never edit the applied `0001_init.sql`; add changes in a new migration.
- Listeners need no account. Two security-definer functions, executable by `anon`, are their only door: `get_player_state(id)` (current state and settings, or null) and `player_heartbeat(...)` (bounded: at most 50 devices per session in 5 minutes, values validated and clamped). The tables stay closed to `anon`.
- Triggers broadcast a small nudge on the public channel `player:<id>` when a state is inserted or a session ends or changes settings. The payload is only a hint; players always fetch the real state with `get_player_state`, so a forged broadcast cannot push content.
- `invites` and `redeem_invite` are dropped.
- `states.slow_mood jsonb`: the slow mood after this state (mood-mapping.md, "Background layer"). Null on the first state means "start from this mood".
- `player_heartbeats.volume` and `player_heartbeats.delay` (`real`, 0 to 1): the listener's local controls, returned to the model as `controls`.

## Session IDs
- Generate with `crypto.randomBytes(18).toString('base64url')` (144 bits, 24 characters).
- They appear in URLs (`/s/<id>`) and in every tool call. Access is still checked by RLS, so the ID is not a secret on its own.

## Who writes what

| Write | By | Key used |
|---|---|---|
| Create session + owner listener row | MCP `start_session` | caller's OAuth token |
| Insert state, update session | MCP `set_sound` | caller's OAuth token |
| Claim reactions | MCP tools via `claim_reactions` RPC | caller's OAuth token |
| Insert reaction | Player page, owner only for now | owner's browser session |
| Change settings | Player page (owner only) updates `sessions.settings` and inserts a `limit_changed`/`consent_changed` reaction | owner's browser session |
| Report listening | Player page via `player_heartbeat(...)` (migration `0002`); stores the account in `user_id` if signed in, else null | anyone with the link |
| Read the current state | Player page via `get_player_state(id)` | anyone with the link |

The service role key is not needed for normal operation. Use it only for maintenance scripts (e.g. ending sessions inactive for 30 days).

## Settings are validated twice
`sessions.settings` is JSON. Validate it with the zod `ListenerSettings` schema (see limits.md) when the player writes it, and again when the MCP endpoint reads it. If it fails validation, fall back to the safe defaults.

## Realtime
- `states` and `sessions` are in the `supabase_realtime` publication. Players subscribe to Postgres Changes on `states` (insert, filter `session_id=eq.<id>`) and on `sessions` (update, filter `id=eq.<id>`). RLS applies to Postgres Changes, so only members receive them.
- See realtime.md for payloads and presence.

## Retention
- Keep states and reactions for ended sessions for 90 days, then delete (scheduled job, later).
- Users can delete a session from the sessions page, which cascades.

## Testing the database
`scripts/test-db.sh` applies all migrations to a throwaway Postgres container (with a small stand-in for Supabase's `auth` schema) and runs `supabase/tests/rls.sql`: a stranger sees nothing, an anonymous listener can join and read but not write states or create sessions, ended sessions cannot be joined. It needs Docker.

## Public live counter (migration 0007)
`live_counts()` returns `{sessions, listeners}`: the number of non-ended sessions with at least one player that sent a heartbeat in the last 60 s while `playing` or `muted`, and the number of such players (a device is one listener, and the owner's own tab counts). `not_started` tabs do not count. It is `security definer`, executable by `anon`, and returns two integers only (no ids), so the landing page can show "N sessions live with X humans listening". The page caches the result 20 s per server instance (`apps/web/lib/live-count.ts`) and shows nothing if the call fails.

## Faces (migration 0008)
`sessions.mode` is the face playing now (`internal` default, or `external`); old rows said `inner` and `outer` and were converted. `sessions.mode_policy` is `auto` (the model may switch) or a locked face. `mode_changes` logs every change (`turn`, `to_mode` = `internal`, `external` or `auto`, `by` = `model` or `owner`); members read it, the owner inserts. `set_mode_policy(session, policy)` is the owner's call from the player: it sets the policy, sets the face when locking, and logs it. `get_player_state` returns `mode` and `mode_policy`, and the session broadcast also fires when either changes.
