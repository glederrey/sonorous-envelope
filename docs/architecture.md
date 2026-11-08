# Architecture

## The core constraint

An LLM cannot play sound. It can only call tools, and only during its turn. So the sound has to live in a separate player that keeps running between turns, and the model talks to it through an MCP server.

Everything lives in the MCP: the tools, the state, the feedback, and the guidance on how to use them (in the server's `instructions`). There is no separate skill.

```
 ┌──────────┐ Streamable HTTP ┌──────────────────────┐   write    ┌───────────────────┐
 │  Claude  │ ──────────────▶ │ Vercel               │ ─────────▶ │ Supabase          │
 │ (any app)│ ◀────────────── │  /api/mcp (tools)    │ ◀───────── │  Postgres (state, │
 └──────────┘  feedback       │  analysis (in /mcp)  │   read     │   reactions, logs)│
                              │  web app (player)    │            │  Realtime         │
                              └──────────────────────┘            │  Auth (OAuth 2.1) │
                                                                  └─────────┬─────────┘
                                                        live push / reactions│
                                                                  ┌─────────▼─────────┐
                                                                  │ Player (browser)  │──▶ speakers + screen
                                                                  │ Web Audio + canvas│◀── listener controls
                                                                  └───────────────────┘
```

Hosting, auth and multi-user details are in [hosting-and-auth.md](hosting-and-auth.md).

## Remote first

On claude.ai, an MCP server is added as a custom connector, and Claude reaches it from Anthropic's cloud, not from the user's device. Local (stdio) servers only work in Claude Desktop. So the server is remote from day one, with a public URL and the Streamable HTTP transport. One deployment then works in claude.ai on the web, the mobile app, Claude Desktop and Claude Code.

## Session flow

1. **Activation.** The user turns the connector on at the start of a conversation. The model calls `start_session`, which creates a session and returns its ID and player link. The user opens the link and taps once to start audio.
2. **During a turn.** The model may call `set_sound` whenever it wants, including in the middle of its reasoning, since Claude can call tools between reasoning steps. The user reads the answer while it is being written, so they hear the sound change as the answer forms.
3. **End of a turn.** The model must make one last call with `final: true`. This is the state that plays while the user reads and replies.
4. **Between turns.** The player loops and evolves the final state. Listener reactions are stored and returned on the next call.

Every call carries the `session_id`. Claude does not tell the server which conversation a call comes from, so the ID returned by `start_session` stays in the model's context and travels with each call. If it is missing, the server falls back to the user's most recent active session and says so in the feedback.

## Enforcing the final update

- **Server instructions** (all clients): the rule is stated in the MCP server's `instructions`, which load automatically with the connector. Models follow this well but not perfectly.
- **Claude Code**: a hook can also check whether a `final: true` call happened in the turn and refuse to end the turn otherwise.
- **Fallback**: if a turn ends without a final call, the server keeps the last state and notes it in the next feedback ("no final update last turn").

## Components

### MCP endpoint (Vercel)
- Exposes the tools (see below) over Streamable HTTP, authenticated with OAuth.
- Writes each new state to Supabase, which pushes it to the session's players.
- Reads pending reactions and the latest analysis, and returns compact feedback.
- Carries the usage guidance in its `instructions`: how to choose mood axes, when to use the synth override or a gesture, the final-update rule, reading reactions as information about the listener's taste, staying subtle by default, when silence is right, respecting limits.

### Analysis (inside the MCP endpoint, TypeScript)
- Renders a few seconds of the effective state offline with the same DSP engine the player uses, and computes perceptual features and the mood estimate (see implementation/engine.md and implementation/analysis.md).
- One engine for browser and server guarantees the feedback describes what the listener hears. Heavier models such as Essentia would need Python and a separate host later.

### Player (web app on Vercel)
- Session page `/s/<session_id>`, open to anyone with the link and no account. Listeners can only listen and see; only the signed-in owner can change limits or react (see hosting-and-auth.md, "Owner and listeners").
- Web Audio (oscillators, BiquadFilter, LFOs, arpeggiator scheduler, gestures, delay, reverb) and a canvas for the colour field.
- Subscribes to the session's Realtime channel and glides to each new state over the transition time, within listener limits.
- Controls: volume, mute, limits, consent level, image-feedback setting, reaction buttons (calmer, softer, brighter, slower, more of this, less of this).
- Sends listener actions to Supabase immediately and applies them locally without waiting.
- Session details: current mood intent vs estimate, history of states, reaction log.

### Supabase
- Postgres for users, sessions, states, reactions and settings, protected with Row Level Security.
- Realtime for the live link between the MCP endpoint and the players.
- Auth as the OAuth 2.1 server for the connector and as the login for the web app.

## Tools (draft)

| Tool | Purpose | Returns |
|---|---|---|
| `start_session()` | Create a session for this conversation | `session_id`, player link, current settings |
| `set_sound(session_id, mood, synth?, gesture?, colour?, transition?, final?)` | Update the sound. Any time during a turn; once with `final: true` at the end | Compact feedback (see feedback.md) |
| `get_feedback(session_id)` | Read the current state and pending reactions without changing anything | Compact feedback |
| `inspect(session_id, what)` | Heavier feedback: `spectrogram`, `history`. Only if image feedback is enabled | Image or longer text |
| `silence(session_id, fade)` | Fade to silence | Confirmation |

Each `set_sound` call sends a complete state rather than a patch. That keeps each update self-contained and avoids drift.

## In-chat player (MCP Apps)

The MCP Apps extension lets a server return interactive UI that the client renders inside the conversation. claude.ai on the web supports it, so the player could also sit inline next to the messages. Support in the mobile app is not documented, so the standalone page stays the main player.

## Tech choices (tentative)

- Web app and MCP endpoint: Next.js (TypeScript) on Vercel, with Vercel's MCP handler.
- Analysis: TypeScript, in the MCP endpoint, using the shared engine.
- Data, live updates and auth: Supabase.
- Player: Web Audio + canvas, no audio framework.
