# Database

The full schema is in [database.sql](database.sql). Copy it to `supabase/migrations/0001_init.sql`.

## Tables at a glance

| Table | What it holds |
|---|---|
| `profiles` | One row per user, created by a trigger on signup. Holds default listener settings. |
| `sessions` | One per conversation. Owner, settings (limits, consent, image feedback), current state, turn counter, `pending_final` flag, `voice` (jsonb, the instance's chosen voice, null if none; migration 0004), `sticky` (jsonb, colour, stack, pad and LFOs kept until Claude changes them; migration 0005), `mode` (the mode playing now: `internal`, `external` or `sandbox`; migrations 0006, 0008 and 0016), `mode_policy` (`auto`, or the mode the owner locked; migrations 0008 and 0016; locking Self from Attuned or Jukebox also silences the current synth state in place and marks it `owner_silenced`, migration 0017), `guided_mode` (the mode whose rules the model last received, null for sessions from before migration 0016; migration 0016). |
| `states` | Every `set_sound` call: intent (what the model sent), effective state (what plays), clamps, analysis, PRNG seed. |
| `listeners` | The owner gets a row with role `owner` and label `you` when the session is created. Link-only listeners have no row: they are not accounts. |
| `invites` | Unused: the player link is open, so there are no invite tokens. Drop it with `redeem_invite` in migration `0002`. |
| `reactions` | Listener actions, with `delivered_at` set once returned to the model. |
| `saved_moments` | Frozen keepsakes of one state, with a public link (migration 0027, below). |
| `emoji_reactions` | Emoji presses from listeners who are not the owner (migration 0028, below). |

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
| Guest emoji | Player page via `send_emoji(...)` (migration `0028`) | anyone with the link |
| Claim guest emojis | MCP tools via `claim_emojis` RPC | caller's OAuth token |
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
`sessions.mode` is the mode playing now (`internal` default, `external` or `sandbox`; shown as Self, Attuned, Jukebox); old rows said `inner` and `outer` and were converted. `sessions.mode_policy` is `auto` (the model may switch) or a locked mode. `sessions.guided_mode` is the mode whose guidance the model last got in a tool result (lazy guidance): it is set by `start_session` and by the MCP server, with the caller's token, when it sends the rules of a new mode. `mode_changes` logs every change (`turn`, `to_mode` = `internal`, `external`, `sandbox` or `auto`, `by` = `model` or `owner`); members read it, the owner inserts. `set_mode_policy(session, policy)` is the owner's call from the player: it sets the policy, sets the face when locking, and logs it. `get_player_state` returns `mode` and `mode_policy`, and the session broadcast also fires when either changes.

## Live tuning (migration 0019)
`sessions.listening_until` (timestamptz, null when nobody waits): set by the MCP tool `listen` to the end of its wait and cleared when the wait ends. `get_player_state` returns it, `player_poll` includes it in the version, and the `sessions_broadcast` trigger fires when it changes, so the player shows "Claude is listening" at once. The revert is `supabase/revert/0019_listening.down.sql`.

## Snapshots (migration 0020)
Table `snapshots`, one row per session (`session_id` primary key, `state_id`, `image` a JPEG data URL, `measured` jsonb, `volume`, `taken_at`), replaced on every capture. RLS: only the session owner can select it; nobody writes it directly. The owner's player writes through RPC `put_snapshot(p_session, p_state, p_image, p_measured, p_volume)`, which checks that the caller owns the session, that the image is a `data:image/jpeg;base64,` URL of at most 350000 characters, that the state belongs to the session, and that `measured` is a small object; an ended session takes no more. The MCP `inspect` tool reads it with the caller's token. The revert is `supabase/revert/0020_snapshots.down.sql`.

## Snapshot seen (migration 0024)
`snapshots.seen_at` (timestamptz) and `snapshots.seen_image` (text, a copy of `image`) record what the model was last given: the live `image` is replaced every 30 s, so the owner needs the exact picture the model saw. RPC `mark_snapshot_seen(p_session)` (security definer, owner only, authenticated) sets `seen_at = now()` and `seen_image = image`; the MCP `inspect` snapshot calls it. Both columns are covered by the owner's select policy. The revert is `supabase/revert/0024_snapshot_seen.down.sql`.

## Moments (migration 0022)
`sessions.moments` (jsonb, default `{}`): the model's musical memory, a map from a name (up to 40 characters, at most 12 per session) to a self-contained moment: `{ kept_at, turn, effective, intent_mood, analysis, sticky, voice, note }`. The model's own client writes it (the owner's `sessions_owner_update` policy). It is not in `get_player_state` or `player_poll`: the player does not need it. Tool: `moment` (mcp-tools.md). The revert is `supabase/revert/0022_moments.down.sql`.

`sessions.motifs` (jsonb, default `{}`): the phrases the model named in `set_sound` `motif` (roadmap #128), a map from a name (up to 40 characters, at most 12 per session) to `{ notes, beats, kept_at, turn }`: the note names as sent (`E4`, `-` a rest) and the beats of each. The model's own client writes it (the owner's `sessions_owner_update` policy). It is not in `get_player_state` or `player_poll`: the phrase reaches the player inside the state that plays it (`EngineState.motif`). The revert is `supabase/revert/0025_motifs.down.sql`.

## Notes to the developers (migration 0021)
Tables `dev_feedback` (`id`, `created_at` truncated to the day (the hour until migration 0023), `kind` bug/idea/confusion/worked, `source` model/user, `body` 80 to 1000 characters, `app_version`, `mode` self/attuned/jukebox, `engine` synth/strudel, `status` new/seen/done/dismissed) and `dev_feedback_quota` (`user_id`, `day`, `n`: the only link to an account, no text). Both have RLS on, no policies and no grants for `anon` or `authenticated`; the service role reads and updates them. The only way in is RPC `send_dev_feedback(p_kind, p_source, p_body, p_version, p_mode, p_engine)` (security definer, `authenticated` only): it checks every field, strips control characters, refuses a text sent in the last 7 days (`duplicate`), enforces 3 notes per user per day and 50 per day overall (migration 0023; 5 and 200 before), deletes every daily count from before today on each send, and inserts one row. Errors start with `dev_feedback: ` (`sign in first`, `unknown kind`, `unknown source`, `too short`, `too long`, `global limit`, `duplicate`, `daily limit`). Tool: `tell_developers` (mcp-tools.md).

## Strudel (migration 0010)
`sessions.allow_code` (owner's switch, default true; RPC `set_allow_code`: off strips the pattern from the current state and silences it, keeping what it took in `intent.stopped_pattern`; on again puts it back while the mode is Attuned or Jukebox, 0029. A lock to Self through `stop_pattern` drops what was kept, so it is final), table `pattern_reports` (one row per Strudel state: `ok`, `error`, `events_per_cycle`, `notes`) written only by RPC `report_pattern`, which checks that the caller owns the session and keeps the first report. `get_player_state` also returns `allow_code` and the state `id`. The states themselves need no migration: the pattern is `effective.engine` and `effective.pattern` inside the existing jsonb.

## Delete account (migration 0026)
RPC `delete_my_account()` (security definer, `authenticated` only, `search_path` empty) deletes the caller's own row in `auth.users`; with no signed-in user it raises `not signed in` (42501). Every table with user data references `auth.users` on delete cascade, so this removes the profile, every session with its states, reactions, moments, snapshots and motifs, the listener rows, the player heartbeats, the developer-note quota, and the OAuth consents and grants. Shared links stop working with the sessions. The app still does not use the service role: this definer function is how account deletion works. Settings has the button (server action `deleteAccount`). The revert is `supabase/revert/0026_delete_account.down.sql`.

## Saved moments (migration 0027)
`saved_moments` (#151): a keepsake of one thing playing, outside the session. Columns: `id` (22 characters of base64url from a uuid, unguessable like a session id), `owner_id` (references `auth.users`, on delete cascade), `session_id` (references `sessions`, on delete set null; never returned publicly), `name` (1 to 80), `saved_by` (`human`: the button, or the AI saving because the listener asked in words; `ai`: the AI on its own), `effective` (jsonb, a frozen copy of the state), `seed` (the state's own seed), `voice_seed` (`voiceSeedOf(session id)`, which drives the grid's per-step randomness and the picture's seed, so the replay matches), `app_version`, `turn` (the state's turn in its session), `fingerprint` (md5 of the frozen state, the voice seed and the state seed; the seed is left out for a Strudel pattern, which does not use it), `created_at`. A unique index on `(owner_id, fingerprint)`: one owner saves a moment once. RLS: the owner reads, renames and deletes. The grants allow `update (name)` only, so the sound can never change, the AI included; there is no insert grant. Two functions:
- `save_moment(p_session, p_name, p_by, p_voice_seed, p_app_version) returns { id, name, saved_by, already }` (security definer, `search_path` empty, `authenticated` only): the one write path for the button and the `moment` tool. The state is copied on the server from `current_state_id`; the client never sends state JSON or code. It needs the caller to own the session (`not_owner`), a state that sounds (`nothing_playing`: volume above 0.001, or a Strudel pattern), a trimmed name of 1 to 80 characters and `p_by` of `human` or `ai` (`bad_input`). Saving what is already saved (same fingerprint) writes nothing and returns the first save with `already: true`, before any cap. Caps: the AI's own saves are spaced by at least 5 turns of the session, so a long session allows more than a short one (`ai_too_soon`); the listener's saves have no per-session cap (one per state at most, by the fingerprint); 200 per owner (`saves_full`), 10 per owner per minute (`too_fast`). Errors are `raise exception 'saved_moment: <code>'`. It freezes the copy: no one-shot `motif`, no `transition.delay`, no `grid.fromTempo`, `grid.glide` or `grid.fromRate`.
- `get_saved_moment(p_id) returns { name, saved_by, created_at, effective, seed, voice_seed, app_version }` or null (security definer, `anon` and `authenticated`): the public read behind `/m/<id>`. It never returns `owner_id` or `session_id`: the session id is the live player's only credential.
"Exactly the same" holds while the engine does not change: `app_version` is stored with each moment so a later change can be traced. The revert is `supabase/revert/0027_saved_moments.down.sql` (it deletes every saved moment).

## Guest emojis (migration 0028)
`emoji_reactions` (#152): `id`, `session_id` (cascade), `device_id` (4 to 40 characters), `emoji` (a key checked against the list in `packages/shared/src/emojis.ts`: change both together), `created_at`, `delivered_at`. RLS: only the session's owner can select, and update `delivered_at` (column grant); there is no insert or delete grant, so only the function writes. Kept apart from `reactions` so `claim_reactions` and `heard` never see a guest.
- `send_emoji(p_session, p_device, p_emoji) returns { ok } or { ok: false, reason: 'slow_down' }` (security definer, `search_path` empty, `anon` and `authenticated`). Caps: 1 per 2 s and 10 per minute per device, 60 per minute per session. Raises for a bad emoji or device id, or a missing or ended session. Deletes the session's rows older than a day on each insert.
- A trigger on insert broadcasts `{ emoji }` on `player:<session id>`, event `emoji` (no device id).
- `claim_emojis(p_session) returns table (emoji, created_at)` (security invoker, owner only through RLS): marks undelivered rows delivered and returns them, like `claim_reactions`.
The revert is `supabase/revert/0028_guest_emojis.down.sql`.
