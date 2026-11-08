# Mobile

## The problem

Mobile browsers suspend Web Audio when the tab goes to the background or the screen locks. iOS is the strictest. Audio also has to be started by a tap.

## Options, from simplest to most work

1. **Second device.** Play on a laptop or speaker, chat on the phone. Zero extra code. Best for testing the idea.
2. **Player inside the chat (MCP Apps).** If the Claude app renders MCP Apps inline, the player stays in the foreground while chatting. To check: whether the mobile app supports it.
3. **Server-rendered audio stream.** The server renders the audio continuously and serves it as a plain `<audio>` stream (like web radio). Media elements keep playing in the background and on the lock screen on iOS and Android, unlike Web Audio. Use the Media Session API for lock-screen controls.
   - Parameter changes arrive with a few seconds' delay. Acceptable, since changes glide anyway.
   - Volume and mute still act instantly on the phone.
   - Costs more server CPU, and needs the numpy synth anyway (shared with the offline analysis).
   - Plan: Web Audio on desktop, stream on mobile.
4. **Native app** with background-audio permission. Most robust, much more work. Only if the project grows.

A hack worth one test: routing Web Audio into an `<audio>` element through `MediaStreamAudioDestinationNode` sometimes keeps it alive in the background on iOS. Unreliable, so don't depend on it.
