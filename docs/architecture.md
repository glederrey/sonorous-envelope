# Architecture

## The core constraint

An LLM cannot play sound. It can only call tools, and only during its turn. So the sound has to live in a separate player that keeps running between turns, and the model talks to it through an MCP server.

```
 ┌──────────┐  tool calls   ┌────────────┐  WebSocket   ┌───────────────────┐
 │   LLM    │ ────────────▶ │ MCP server │ ───────────▶ │ Player (browser)  │ ──▶ speakers + screen
 │ (Claude) │ ◀──────────── │  (state)   │ ◀─────────── │ Web Audio + canvas│ ◀── listener controls
 └──────────┘  feedback     └────────────┘  reactions   └───────────────────┘
                                  │
                                  └─ offline render + analysis (features, mood estimate, optional spectrogram)
```

## Session flow

1. **Activation.** The user turns the MCP on at the start of a conversation. The model calls `start_session`, which returns the player link (and opens it automatically when running locally). The user taps once to start audio.
2. **During a turn.** The model may call `set_sound` whenever it wants, including in the middle of its reasoning, since Claude can call tools between reasoning steps. The user reads the answer while it is being written, so they hear the sound change as the answer forms.
3. **End of a turn.** The model must make one last call with `final: true`. This is the state that plays while the user reads and replies.
4. **Between turns.** The player loops and evolves the final state. The listener's reactions are logged and returned on the next call.

## Enforcing the final update

- **Claude Code:** a hook checks whether a `final: true` call happened in the turn and refuses to end the turn otherwise.
- **claude.ai and the mobile app:** no hooks, so this relies on the server's `instructions` (loaded automatically with the server) and the skill. Models follow this well but not perfectly.
- **Fallback:** if a turn ends without a final call, the server keeps the last state and adds a note to the next feedback ("no final update last turn").

## Components

### MCP server
- Holds the current state, the listener's limits and settings, and a log of listener reactions.
- Exposes the tools (see below).
- Pushes every new state to the connected player(s) over a WebSocket.
- Renders a few seconds of the effective state offline and analyses it, so feedback does not depend on the browser.

### Player
- A single web page using Web Audio (oscillators, BiquadFilter, LFOs, arpeggiator scheduler, gesture samples, delay, reverb) and a canvas for the colour field.
- Loops and evolves the current state until the next update. Changes glide over a transition time chosen by the model, within listener limits.
- Shows listener controls: volume, mute, limits, consent level, image-feedback setting, and reaction buttons (calmer, softer, brighter, slower, more of this, less of this).
- Sends listener actions to the server immediately, and applies them locally without waiting.

### Listener
- Hears and sees the player and reacts through the controls. Reactions reach the model on its next tool call.

## Tools (draft)

| Tool | Purpose | Returns |
|---|---|---|
| `start_session()` | Start a session, return the player link and current settings | Link, settings |
| `set_sound(mood, synth?, gesture?, colour?, transition?, final?)` | Update the sound. Any time during a turn; once with `final: true` at the end | Compact feedback (see feedback.md) |
| `get_feedback()` | Read the current state and pending reactions without changing anything | Compact feedback |
| `inspect(what)` | Ask for heavier feedback: `spectrogram`, `history`. Only if image feedback is enabled | Image or longer text |
| `silence(fade)` | Fade to silence | Confirmation |

Each `set_sound` call sends a complete state rather than a patch. That keeps each update self-contained and avoids drift.

## Deployment options

### Local (start here)
Claude Desktop or Claude Code runs the MCP server on the listener's computer (stdio transport). The server also serves the player on `http://localhost:<port>`. No hosting and no accounts needed.

### Remote
Host the server publicly (Streamable HTTP transport) and add it to claude.ai as a custom connector. The player is a hosted page that joins a session with a short code. This works on web and mobile, but see mobile.md for background audio.

### In-chat UI (MCP Apps)
The MCP Apps extension lets a server return interactive UI that the client renders inside the conversation. If the client supports it, the player can sit inline next to the messages. Keep the standalone page anyway, since it works everywhere.

## MCP or skill?

Both, for different jobs.

- **MCP = plumbing.** A skill is instructions plus scripts. It cannot hold a live connection or state between messages, and in claude.ai it runs in a cloud sandbox that cannot play sound to the user. A skill that only emits JSON in the reply would also give no feedback. The live channel must be an MCP server.
- **Skill = how to express.** How to choose mood axes, when to use the synth override or a gesture, the final update rule, treating listener reactions as information about their taste, staying subtle by default, when silence is right, and respecting limits. A short version also goes in the server's `instructions`.

## Tech choices (tentative)

- Server: Python (official MCP SDK). Python makes the analysis side easier (numpy, librosa, Essentia).
- Offline render: a numpy version of the synth so the server can render the same state without a browser. Also reused for the mobile audio stream.
- Player: plain HTML + Web Audio + canvas, no framework.
