# Database

The full schema is in [database.sql](database.sql). Copy it to `supabase/migrations/0001_init.sql`.

## Tables at a glance

| Table | What it holds |
|---|---|
| `profiles` | One row per user, created by a trigger on signup. Holds default listener settings. |
| `sessions` | One per conversation. Owner, settings (limits, consent, image feedback), current state, turn counter, `pending_final` flag. |
| `states` | Every `set_sound` call: intent (what the model sent), effective state (what plays), clamps, analysis, PRNG seed. |
| `listeners` | Who can open a session. The owner gets a row with role `owner` and label `you` when the session is created. |
| `invites` | Unused: the player link is open, so there are no invite tokens. Drop it with `redeem_invite` in migration `0002`. |
| `reactions` | Listener actions, with `delivered_at` set once returned to the model. |

## Session IDs
- Generate with `crypto.randomBytes(18).toString('base64url')` (144 bits, 24 characters).
- They appear in URLs (`/s/<id>`) and in every tool call. Access is still checked by RLS, so the ID is not a secret on its own.

## Who writes what

| Write | By | Key used |
|---|---|---|
| Create session + owner listener row | MCP `start_session` | caller's OAuth token |
| Insert state, update session | MCP `set_sound` | caller's OAuth token |
| Claim reactions | MCP tools via `claim_reactions` RPC | caller's OAuth token |
| Insert reaction | Player page | listener's browser session |
| Change settings | Player page (owner only) updates `sessions.settings` and inserts a `limit_changed`/`consent_changed` reaction | owner's browser session |
| Join a session | Player page via `join_session(session_id)` RPC (new in migration `0002`): security definer, adds the caller (anonymous or not) as a listener when the session exists and has not ended, labelled `listener N` | listener's browser session |

The service role key is not needed for normal operation. Use it only for maintenance scripts (e.g. ending sessions inactive for 30 days).

## Settings are validated twice
`sessions.settings` is JSON. Validate it with the zod `ListenerSettings` schema (see limits.md) when the player writes it, and again when the MCP endpoint reads it. If it fails validation, fall back to the safe defaults.

## Realtime
- `states` and `sessions` are in the `supabase_realtime` publication. Players subscribe to Postgres Changes on `states` (insert, filter `session_id=eq.<id>`) and on `sessions` (update, filter `id=eq.<id>`). RLS applies to Postgres Changes, so only members receive them.
- See realtime.md for payloads and presence.

## Retention
- Keep states and reactions for ended sessions for 90 days, then delete (scheduled job, later).
- Users can delete a session from the sessions page, which cascades.
