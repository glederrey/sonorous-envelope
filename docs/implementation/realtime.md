# Realtime

Supabase Realtime connects the MCP endpoint (which writes) to the players (which listen and react).

## Channels
One public Broadcast channel per session: `player:<session_id>`. Listeners have no account, so the player subscribes with the anon key only. The channel carries nudges, never content: the player always reads the real state with `get_player_state` (so a forged message on the public channel can do nothing but cause a fetch). Three parts:

### 1. Broadcast: `state`
- Sent by a database trigger on `states` insert (`realtime.send`, public). Payload `{turn, final}`.
- On receive, the player calls `get_player_state(id)`, which returns `{ended, settings, state: {effective, seed, turn, final, created_at}}`.
- Then: run `hardCaps` locally with the settings (defence in depth), then `engine.setState(effective, seed)` via the worklet port, and start the colour glide.
- Ignore a state that is not newer than the one already playing (compare `created_at`).
- Safety net: the player also calls `get_player_state` every 5 s while the tab is visible, in case the live connection drops.

### 2. Broadcast: `session`
- Sent by a trigger on `sessions` when `ended_at` or `settings` change. The player refetches; `ended` stops playback and shows "session ended".

### 3. Heartbeat (who is listening)
- Every open player calls `player_heartbeat(session, device, audio, volume, delay)` every 20 s and when its controls change. `audio` is `playing`, `muted` or `not_started`; `volume` and `delay` are the local sliders, 0 to 1.
- It is stored in `player_heartbeats` (one row per device; `seen_at` is stamped by the database; `user_id` is the signed-in account or null).
- `players` in the feedback = rows with `seen_at > now() − 45 s` and `audio = 'playing'`.
- The feedback `controls` field is the volume and echo from **the owner's** most recent heartbeat only. A link-only listener counts as a player but their controls are not reported: they can only listen.

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
