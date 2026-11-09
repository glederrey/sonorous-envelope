# Mobile

## The problem

Mobile browsers suspend Web Audio when the tab goes to the background or the screen locks. iOS is the strictest. Audio also has to be started by a tap.

## Options, from simplest to most work

1. **Second device.** Play on a laptop or speaker, chat on the phone. Zero extra code. Best for testing the idea.
2. **Player inside the chat (MCP Apps).** claude.ai on the web supports MCP Apps. The mobile app supports remote connectors, but MCP Apps support there is not documented. To check.
3. **Server-rendered audio stream.** The server renders the audio continuously and serves it as a plain `<audio>` stream (like web radio). Media elements keep playing in the background and on the lock screen on iOS and Android, unlike Web Audio. Use the Media Session API for lock-screen controls.
   - Parameter changes arrive with a few seconds' delay. Acceptable, since changes glide anyway.
   - Volume and mute still act instantly on the phone.
   - Needs a long-running process, which Vercel functions are not. This part would run on a small always-on host (Fly.io, Railway or a VPS), reusing the shared TypeScript engine in Node.
   - Plan: Web Audio on desktop, stream on mobile.
4. **Native app** with background-audio permission. Most robust, much more work. Only if the project grows.

A hack worth one test: routing Web Audio into an `<audio>` element through `MediaStreamAudioDestinationNode` sometimes keeps it alive in the background on iOS. Unreliable, so don't depend on it.

## Dictation: the sound nearly disappears when the mic opens

Found in the first outside test (2026-11-09, phone). While the user dictates a message, the player's sound drops to something very faint and far away. Before the background fix, the sound stayed audible during dictation; the cost was that changes only arrived on returning to the page. The point of the whole setup includes dictating with Claude's sound in the background, so this matters.

**Likely cause: the phone, not the page.** When the microphone opens, Android and iOS give priority to the recording and lower ("duck") or pause other audio sources. A web page has little say in that. The keep-alive file (roadmap, "Phone: music follows Claude in the background") makes Chrome treat the page as media, which also means it takes part in the system's audio focus and can be ducked or paused when something else takes focus.

**What we can check from the page** (implemented on branch `listening-player-side`, none of it verified on a phone yet):
- Listen to the `AudioContext` `statechange` event as well as `visibilitychange`, and call `resume()` when the state is `suspended` or `interrupted` (iOS reports `interrupted`), without waiting for a tap. A context that was interrupted does not always restart by itself.
- Listen to the `pause` event of the keep-alive element. If we did not pause it (mute pauses it on purpose), call `play()` again. It may need user activation; the page had one at start, so try it.
- On iOS, test the `navigator.audioSession.type` value (`playback`, `ambient`, `play-and-record`) to see whether one lets the sound coexist with the dictation mic. This is a thing to test, not a known fix.
- Add the `AudioContext` state, the keep-alive element's `paused` state and every `statechange` / `pause` event with a timestamp to the `?debug=1` report, then dictate once. The report is what found the earlier background problem (it showed the page alive and requests stalled); it should say here whether the context was suspended, the element paused, or the sound merely ducked.

**If the system forces it**, it cannot be worked around from a web page. Fallback to document in the guide: open the player on another device (computer, speaker) and dictate on the phone. That is option 1 above.

### How to test it (dev server)
Open the player with `?debug=1`. A "Live" line shows the engine state, the keep-alive state, the audio session type and the last events with timestamps. The page now calls `resume()` / `play()` by itself on a `statechange` away from `running` and on a keep-alive `pause` (unless muted). Dictate once and read the events. To try another iOS audio session type, add `&audiosession=ambient` (or `play-and-record`, `auto`); the default is `playback`.
