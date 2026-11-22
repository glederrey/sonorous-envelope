# Realtime

Supabase Realtime connects the MCP endpoint (which writes) to the players (which listen and react).

## Channels
One public Broadcast channel per session: `player:<session_id>`. Listeners have no account, so the player subscribes with the anon key only. The channel carries nudges, never content: the player always reads the real state with `get_player_state` (so a forged message on the public channel can do nothing but cause a fetch). Three parts:

### 1. Broadcast: `state`
- Sent by a database trigger on `states` insert (`realtime.send`, public). Payload `{turn, final}`.
- On receive, the player calls `get_player_state(id)`, which returns `{ended, settings, state: {effective, seed, turn, final, created_at}}`.
- Then: run `hardCaps` locally (defence in depth), then `engine.setState(effective, seed)` via the worklet port, and start the colour glide.
- Ignore a state that is not newer than the one already playing (compare `created_at`).
- Safety net: the player also calls `player_poll(id, known_version)` every second (also while the page is hidden, once the audio has started): `{same: true, now, v}` when nothing changed, the full `get_player_state` answer plus `v` otherwise (migration 0019).

### 2. Broadcast: `session`
- Sent by a trigger on `sessions` when `ended_at`, `settings`, the mode, the mode policy or `listening_until` change. The player refetches; `ended` stops playback and shows "session ended".

### 3. Heartbeat (who is listening)
- Every open player calls `player_heartbeat(session, device, audio, volume, delay)` every 20 s and when its controls change. `audio` is `playing`, `muted` or `not_started`; `volume` is the local slider, 0 to 1. `delay` is sent as null: the echo is Claude's, there is no echo slider.
- It is stored in `player_heartbeats` (one row per device; `seen_at` is stamped by the database; `user_id` is the signed-in account or null).
- `players` in the feedback = rows with `seen_at > now() − 45 s` and `audio = 'playing'`.
- The feedback `controls` field is the volume from **the owner's** most recent heartbeat only. A link-only listener counts as a player but their controls are not reported: besides listening, they can only send emoji reactions (`send_emoji`, the `emoji` event below).

## Guest emojis (#152)
Anyone listening who is not the owner (a link with no account, or a signed-in stranger) can press an emoji (the set is `GUEST_EMOJIS` in `packages/shared/src/emojis.ts`: thumbs up, thumbs down, heart, happy, unhappy, sad, crying). The player calls `send_emoji(session, device, emoji)`; the row goes in `emoji_reactions`, apart from `reactions`, so `claim_reactions` and `heard` never see it. Caps: one press per 2 s and 10 a minute per device, 60 a minute per session (`{ ok: false, reason: 'slow_down' }`, nothing stored).
- An insert trigger sends a Realtime broadcast on the player's channel: topic `player:<session id>`, event `emoji`, payload `{ "emoji": "<key>" }` and nothing else (no device id). Like `state`, it is only a hint on a public channel.
- Only the owner's player acts on it: it floats the glyph over the picture and reads the counts again (debounced). Guests ignore it, and see only their own press float.
- The model gets the counts through the database, not the broadcast: `claim_emojis` (the owner's token) marks them delivered, and the feedback carries one `guests` line.

## Reactions (player → model)
Reactions go through the database, not broadcast, so they are never lost. The owner's button presses insert a row into `reactions` with a `kind` (`packages/shared/src/reactions.ts`: calmer, stormier, softer, harsher, darker, brighter, slower, faster, more_of_this, less_of_this, and the `heard_*` readings). The volume slider and mute are local: the volume reaches the model through the heartbeat (`controls`), not as a reaction.

`describeReactions` turns the rows since the last call into short lines for the feedback, one per kind with a count and how long ago: `"calmer x2, 3 min ago"`. `more_of_this` and `less_of_this` read as "more of this (go further in the direction of your last change)" and "less of this (take back part of your last change)"; a `heard_*` kind reads as the word on its button (`heard_reproach` as "blaming"). Reactions are information about how the sound landed, not orders: a press does not change the sound by itself, the model decides.

## Reconnection
On reconnect the player refetches with `get_player_state` and applies the current state, so a player that dropped catches up. If Realtime is unavailable, the 1 s `player_poll` covers it.
