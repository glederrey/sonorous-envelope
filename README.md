<img src="docs/brand/app-icon.svg" width="64" alt="Sonorous Envelope logo">

# sonorous-envelope

An MCP server that gives an LLM a non-verbal channel: a small synthesizer (arpeggiator, filter, LFO, drone, delay) or Strudel code, and a colour field with moving scenes. The model can update the sound at any point while it works and must update it at the end of every message. It gets back an analysis of what is actually playing, and the listener can react to it.

Status: built and in use, heading to v1.0.0.

## The name

"Sonorous envelope" carries two meanings:
- **In synthesis**, the envelope (ADSR) is the shape a sound takes over time: how it attacks, holds and fades.
- **In psychoanalysis**, Didier Anzieu's *sonorous envelope of the self* (*l'enveloppe sonore du Soi*) is the bath of sound that holds a person before it means anything.

The name says both how the project works and what it is for.

## The idea in one paragraph

Text is the only channel an LLM normally has. This project adds a second one that is ambient and non-verbal. The user turns the connector on at the start of a conversation and opens the session's player page. During each turn, the model describes a mood (and optionally exact synth settings, a voice, short phrases and colour). A player on the listener's device renders it and glides from the previous state. The server returns what was really produced: the effective settings, perceptual audio features, the colour, a mood estimate on the same axes as the intent, and the listener's reactions. The model can then adjust. The listener controls the volume and mute of their own device, and the owner has buttons like "calmer" or "softer" that tell the model how the sound landed.

## Docs

- [Implementation spec](docs/implementation/): everything needed to build it (start with [CLAUDE.md](CLAUDE.md)):
  - [Stack, layout and architecture](docs/implementation/stack-and-layout.md): components, session flow, folders, env vars, commands
  - [Auth](docs/implementation/auth.md): OAuth 2.1 with Supabase, owner and listeners, auth emails
  - [Database](docs/implementation/database.md) and [realtime](docs/implementation/realtime.md): schema, RLS, channels
  - [MCP tools](docs/implementation/mcp-tools.md) and [server instructions](docs/implementation/server-instructions.md)
  - [Engine](docs/implementation/engine.md), [mood mapping](docs/implementation/mood-mapping.md) and [analysis](docs/implementation/analysis.md): the sound, the axes, the feedback
  - [Limits](docs/implementation/limits.md): the safety rules that remain
  - [Player UI](docs/implementation/player-ui.md), [Strudel](docs/implementation/strudel.md), [stop hook](docs/implementation/stop-hook.md), [testing](docs/implementation/testing.md)
- [Emotion to sound](docs/emotion-to-sound.md): the research behind the mapping, with references
- [The picture](docs/visuals.md): scenes, gradients and movement for the colour field
- [Mobile](docs/mobile.md): how to keep sound playing on phones
- [Licensing](docs/licensing.md): why AGPL, and what it requires
- [Design system](docs/design-system.md): colours, type, logo and UI components for the web app ([open the artifact](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY))

## Decisions so far

- Everything lives in the MCP server, including the usage guidance (no separate skill).
- Remote server from the start, so it works in claude.ai (web and mobile), Claude Desktop and Claude Code.
- Web app, MCP endpoint and analysis on Vercel; state, live updates and auth on Supabase.
- Proper OAuth 2.1 from the start.
- The MCP is turned on at the start of a conversation; each conversation gets its own session.
- The model may update the sound at any time during a turn, including mid-reasoning, and must make a final update at the end of each message.
- The main input is a set of mood axes. Raw synth parameters are an optional override.
- Everything stays in TypeScript. The mood estimate is a set of transparent heuristics; no external emotion model.
- Feedback is text. A picture of the sound (the player's view and a spectrogram) comes only when the model asks for it with `inspect`, because it costs tokens, and the owner can switch it off.

## License

AGPL-3.0-or-later (see [LICENSE](LICENSE)), chosen because the Strudel mode uses Strudel, which is AGPL. Details and what it means for the project: [docs/licensing.md](docs/licensing.md).

## Open questions

- Is the mood estimate useful to the model, or does it pull the sound toward what the estimator expects?
- Is a slow bass arpeggio heard as a background mood, apart from the mid arpeggio? (See docs/emotion-to-sound.md, "Open questions".)
- Does seeing the listener's volume make the model read its own sound better, or does it start compensating for it?
- Does the Claude mobile app render MCP Apps (UI inside the chat)?
