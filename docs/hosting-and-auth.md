# Hosting, auth and multiple users

## Who does what

### Vercel
- **Web app:** login, session list, the player page, session details.
- **MCP endpoint** `/api/mcp`: Streamable HTTP, added to claude.ai as a custom connector.
- **Analysis:** runs inside the MCP endpoint, rendering with the shared TypeScript engine.

### Supabase
- **Realtime:** Vercel functions are short-lived and cannot hold an open connection to the player. Supabase Realtime does: the MCP tool writes a new state, every open player of that session receives it instantly, and reactions travel back the same way.
- **Postgres:** users, sessions, states, reactions, settings.
- **Auth:** login for the web app, and the OAuth 2.1 server for the connector.

## Flow of one update

1. Claude calls `set_sound` on `/api/mcp` with its access token.
2. The endpoint checks the token, checks that the session belongs to that user, applies the mood mapping and listener limits, and writes the state.
3. Supabase Realtime pushes the state to every player open on that session.
4. The endpoint calls the analysis, reads new reactions, and returns the feedback to Claude.

## OAuth from the start

Supabase Auth can act as an OAuth 2.1 authorization server that follows the MCP auth spec, with discovery metadata and dynamic client registration. That is what claude.ai expects from a custom connector, so no auth server has to be written by hand.

How it works for the user:
1. They add the connector URL in claude.ai (Customize → Connectors → Add custom connector).
2. claude.ai discovers the auth server and registers itself as a client.
3. The user is sent to our login and consent page (on Vercel), signs in with Supabase Auth (email magic link, Google or GitHub), and approves.
4. claude.ai gets an access token (a Supabase JWT) and sends it with every MCP call.
5. The MCP endpoint validates the JWT and knows which user is calling. Row Level Security keeps every query limited to that user's data.

What we build:
- The authorization (login + consent) page in the web app.
- Protected resource metadata on the MCP endpoint, pointing to the Supabase auth server.
- Token validation in the MCP endpoint.

Settings to get right:
- Enable the OAuth 2.1 server and dynamic client registration in Supabase.
- Allow claude.ai's callback URL as a redirect URI.
- Watch the list of registered clients, since dynamic registration lets any MCP client register.

Note: Supabase's OAuth server was in public beta as of late 2025. Check its status before relying on it, and keep a fallback in mind (a small OAuth layer on Vercel in front of Supabase Auth).

## Multiple people

### Several conversations
Each conversation gets its own session from `start_session`, with its own ID and page. Two chats means two sessions, kept apart.

### Several users
Each user signs in through OAuth and only ever sees their own sessions. Everything is scoped by user ID with Row Level Security.

### Several listeners on one session
For example the owner on two devices, or a friend listening in.
- Everyone on the session page hears the same sound, since all players subscribe to the same channel.
- The owner sets limits and the consent level. Other listeners can only change their own volume and mute.
- Reactions from anyone reach Claude, labelled by listener ("listener 2 pressed calmer").
- The owner can invite listeners (a share link that requires login, or a guest link that is listen-only) and can end the session.
- Session IDs are long random values, so links cannot be guessed.

## Data model (first sketch)

| Table | Main columns |
|---|---|
| `sessions` | id, owner_id, created_at, ended_at, settings (limits, consent, image_feedback) |
| `states` | id, session_id, created_at, intent (mood, synth, gesture, colour), effective, final, analysis |
| `reactions` | id, session_id, listener_id, created_at, kind, value, delivered_at |
| `listeners` | session_id, user_id or guest_id, role (owner, listener) |

`reactions.delivered_at` marks which reactions have already been returned to Claude, so each one is reported once.

## Costs and limits to watch
- Function duration: render + analysis should stay under 300 ms.
- Realtime message quotas on Supabase's free tier: one message per update, plus reactions, so low volume.
- Cold starts on the analysis function adding latency to `set_sound`.
