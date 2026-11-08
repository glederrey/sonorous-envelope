# Realtime

Supabase Realtime connects the MCP endpoint (which writes) to the players (which listen and react).

## Channels
One channel per session: `session:<session_id>`. The player subscribes with its logged-in browser client. Three features on that channel:

### 1. Postgres Changes: new states
- Table `states`, event `INSERT`, filter `session_id=eq.<id>`.
- Payload: the new row. The player reads `effective`, `seed`, `id`, `final`, `turn`.
- On receive: run `applyLimits` locally with the current settings (defence in depth), then `engine.setState(effective, seed)` via the worklet port, and start the colour glide.
- Ignore states older than the one already playing (compare `created_at`).

### 2. Postgres Changes: session updates
- Table `sessions`, event `UPDATE`, filter `id=eq.<id>`.
- Used for: settings changed on another device, session ended (`ended_at` set → stop and show "session ended").

### 3. Presence
- Each open player tracks `{ user_id, label, device: "desktop"|"mobile", audio: "playing"|"muted"|"not_started", volume: number, delay: number }` (`volume` and `delay` are the local sliders, 0 to 1).
- The MCP endpoint needs the count of players with `audio: "playing"` for the `players` field. Presence is only available to subscribers, so:
  - Each player also writes a heartbeat: `upsert` into a small table `player_heartbeats (session_id, user_id, device_id, audio, seen_at)` every 20 s and on audio state change.
  - The heartbeat also carries `volume` and `delay` (two numeric columns on `player_heartbeats`, added in migration `0002`). The feedback `controls` field is the value from the owner's most recent heartbeat, or from the most recent one of any listener if the owner has none.
  - `players` = rows with `seen_at > now() − 45 s` and `audio = 'playing'`.
  - Add this table to the migration (RLS: members insert/update their own rows; members select).

The table is defined in database.sql.

## Reactions (player → model)
Reactions go through the database, not broadcast, so they are never lost:
- Button presses: insert into `reactions` with `kind` and optional `value`.
- Volume slider: apply locally at once; insert one `volume` reaction when the slider is released (debounce 1 s), with `{from, to}`.
- Echo slider: same as volume, one `delay` reaction on release with `{from, to}`.
- Mute/unmute: local at once, plus a reaction.
- Owner settings changes: update `sessions.settings`, plus a `limit_changed` / `consent_changed` / `gestures_off` / … reaction with `{field, from, to}`.

How reactions read in feedback (`listener` array):

| kind | text |
|---|---|
| calmer, softer, brighter, darker, slower, faster | `"<label>: pressed calmer"` |
| more_of_this / less_of_this | `"<label>: wants more of this"` / `"…less of this"` |
| volume | `"<label>: volume 0.8→0.5"` |
| delay | `"<label>: echo 0.5→0.1"` |
| mute / unmute | `"<label>: muted"` / `"unmuted"` |
| limit_changed | `"<label>: set max_volume 0.6→0.4"` |
| consent_changed | `"<label>: consent ambient→expressive"` |
| gestures_off/on | `"<label>: turned gestures off"` |
| image_feedback_changed | `"<label>: image feedback off→on_request"` |

Reaction buttons do not change the sound by themselves (the model decides), except that the player applies an immediate, temporary local nudge so the press feels responsive: calmer/slower → tempo ×0.9, softer → local gain ×0.85, darker → cutoff ×0.8, brighter → cutoff ×1.2, faster → tempo ×1.1. The nudge lasts until the next state arrives.

## Reconnection
- On reconnect, fetch the session's `current_state_id` row and apply it, so a player that dropped catches up.
- If Realtime is unavailable, poll `sessions.current_state_id` every 5 s as a fallback.
