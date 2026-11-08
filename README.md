<img src="docs/brand/app-icon.svg" width="64" alt="Sonorous Envelope logo">

# sonorous-envelope

An MCP server that gives an LLM a non-verbal channel: a small synthesizer (arpeggiator, filter, LFO, drone, delay), short sound gestures, and a colour field. The model can update the sound at any point while it works and must update it at the end of every message. It gets back an analysis of what is actually playing, and the listener can react by changing it.

Status: design phase. Nothing is built yet.

## The name

"Sonorous envelope" carries two meanings:
- **In synthesis**, the envelope (ADSR) is the shape a sound takes over time: how it attacks, holds and fades.
- **In psychoanalysis**, Didier Anzieu's *sonorous envelope of the self* (*l'enveloppe sonore du Soi*) is the bath of sound that holds a person before it means anything.

The name says both how the project works and what it is for.

## The idea in one paragraph

Text is the only channel an LLM normally has. This project adds a second one that is ambient and non-verbal. The user turns the connector on at the start of a conversation and opens the session's player page. During each turn, the model describes a mood (and optionally exact synth settings, gestures and colour). A player on the listener's device renders it and glides from the previous state. The server returns what was really produced: the effective settings, perceptual audio features, the colour, a mood estimate on the same axes as the intent, and the listener's reactions. The model can then adjust. The listener always stays in control: volume, mute, limits, and buttons like "calmer" or "softer".

## Docs

- [Architecture](docs/architecture.md): session flow, when updates happen, components, tools
- [Hosting, auth and multiple users](docs/hosting-and-auth.md): Vercel + Supabase, OAuth, sessions, several listeners
- [Sound and colour model](docs/sound-model.md): mood axes, synth override, gestures, colour
- [Emotion to sound](docs/emotion-to-sound.md): the research behind the mapping (cues, chords, arpeggios, gestures), and [references](docs/references.md)
- [Feedback loop](docs/feedback.md): what the model gets back, the mood estimate, the optional spectrogram image
- [Mobile](docs/mobile.md): how to keep sound playing on phones
- [Safety and consent](docs/safety.md): limits, consent levels, and why they matter
- [Roadmap](docs/roadmap.md): build order
- [Design system](docs/design-system.md): colours, type, logo and UI components for the web app ([open the artifact](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY))
- [Implementation spec](docs/implementation/): everything needed to build it (start with [CLAUDE.md](CLAUDE.md))

## Decisions so far

- Everything lives in the MCP server, including the usage guidance (no separate skill).
- Remote server from the start, so it works in claude.ai (web and mobile), Claude Desktop and Claude Code.
- Web app, MCP endpoint and analysis on Vercel; state, live updates and auth on Supabase.
- Proper OAuth 2.1 from the start.
- The MCP is turned on at the start of a conversation; each conversation gets its own session.
- The model may update the sound at any time during a turn, including mid-reasoning, and must make a final update at the end of each message.
- The main input is a set of mood axes. Raw synth parameters are an optional override.
- One-off gestures (purr, chirp, sigh…) play over the background.
- Feedback starts without images. The spectrogram image is an opt-in setting because it costs tokens.

## Open questions

- Should colour always follow the sound, or can the model set it independently?
- How should warmth, closeness and spontaneity be estimated from audio? Existing emotion models only cover valence and arousal.
- Is the mood estimate useful to the model, or does it pull the sound toward what the estimator expects?
- Is a slow bass arpeggio heard as a background mood, apart from the mid arpeggio? (See docs/emotion-to-sound.md, "Open questions".)
- Does the listener's echo and volume visibility make the model read its own sound better, or does it start compensating for them?
- Does the Claude mobile app render MCP Apps (UI inside the chat)?
