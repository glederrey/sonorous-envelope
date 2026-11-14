# Test brief: Sonorous Envelope v0.17.4 (only what is still open)

Read this whole file first. Everything that passed in the v0.17.3 report is **not** tested again. Test only the three items below. You test the picture, not the sound.

## What the product is

A remote MCP server that gives an AI model a sound channel: a synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. On the internal face (default) the model says nothing about the sound or picture unless asked.

## Setup

Reconnect the connector, call start_session, give the user the player link. The user opens it on a laptop and a phone (devtools is fine) and taps "Start listening". Ask the user to watch, not listen. Do not announce what you set.

## Tests (record pass, fail or partial, and what the user saw)

1. **Aurora on the phone.** Scene `aurora`, dark base, awe mood, phone view. Pass: fewer streaks than on the laptop, each at a normal width, not squished. Also glance at the laptop: it should look as before (soft, no thin lines).
2. **Smoke on bright yellow** (hue 55, saturation 0.9, lightness 0.75). Pass: the scene is dark like smoke on a dark colour, not much brighter; the smoke is clearly visible.
3. **Warp, `sync: "phrase"` at 110 BPM.** Pass: the middle blob swells slowly over about 4 bars and the rings are fast again (one every two beats, as with `sync: "beat"`).

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy.

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
