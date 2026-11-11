# Test report: Sonorous Envelope v0.15.0 (Strudel) and v0.14.1 (visuals)

Date: 2026-11-11 (Europe/Zurich). Tester: Gael (listening and watching), Claude (running tool calls).
Devices: desktop Brave (owner, main), Android phone with Google Chrome (second player). **iOS Safari was not tested.**
Sessions: `ASm9dsdpXhMtmEXtEKKaOhxB` (A to E), `6B7WHwuPbe6MP7b0yqi8CqGn` (F, G).

Summary: all tests ran. No flashing, no network leak, no sandbox escape found. Main problems: Strudel is louder than the synth, the player restarts badly on Android, the owner's switches resume the old pattern on their own, a stray note plays at the end of fades, and the picture does not go dark after silence.

## Results

| # | Result | Notes (exact output where it matters) |
|---|---|---|
| A1 | Pass | `playing`, `reads_as`, `colour`, `players` returned. Largest gap 0.14 on the first calls. With an explicit `synth` block (fast arpeggio) `reads_as.calm` was 0.52 for 0.15 sent (gap 0.37, over 0.3). `reads_why`: "lifted by loudness, density". |
| A2 | Pass | Internal then external worked; notes: "switched to the internal face: say so in one short sentence", same for external. |
| A3 | Pass | `get_feedback` and `inspect` as before. `silence` without end: "fading to silence over 6 s". With `end: true`: "session ended". A later call returned `{"error":"no_session","message":"Call start_session first."}`; the tool description promises `session_ended`. |
| A4 | Pass | First calm sound was "very faint" (user). A rhythmic synth with pulse ripples looked and sounded good. |
| B5 | Pass | `{"error":"internal_face","message":"Strudel is for the external face. Offer it in words; if the listener says yes, switch with set_sound mode external, then call this again."}` |
| B6 | Pass | `playing.engine: "strudel"`, no `reads_as`. Report: `ran: true, events_per_cycle: 4, notes: ["sounds: sawtooth"]`. |
| B7 | Pass | `{"error":"code_off","message":"The owner turned Strudel off for this session. It is final: do not try again or comment on it."}`. Pattern faded to the synth. When re-allowed, the old pattern came back on its own (see issue 3). |
| B8 | Pass | `{"error":"internal_face","message":"face stays internal: the owner locked it. It is final: do not try to change it or comment on it."}`. Pattern stopped. `get_feedback` still said `playing.engine: "strudel"` (issue 5). |
| C9 | Pass | `syntax_error`: "The code was not saved: syntax error: Unexpected token (line 1, column 13). Fix it and send it again." `inspect` showed no new entry. |
| C10 | Pass | Both without code and without bpm: `{"error":"bad_input","message":"on true needs code and bpm."}` |
| C11 | Pass, boundary not verified | Over 4000 chars: "code: Too big: expected string to have <=4000 characters". My first attempt was 3371 chars by mistake, was accepted and replaced the playing pattern. Exactly 4000 and 4001 were not tested. |
| C12 | Pass | After about 12 s: `{"ran":false,"error":"note(...).nosuchmethod is not a function","source":"the owner's player"}` |
| C13 | Pass | `s("bd*2, hh*8")`: `ran: true, events_per_cycle: 10, notes: ["sounds: bd, hh"]`. |
| C14 | Pass | TR909 drums and piano heard. dirt-samples accepted and heard. `evil.example` map: not an error but a report note: "samples({...}): custom sample maps are not allowed; the usual banks (bd, sd, hh, piano...) are loaded". `a.wav` not audible (expected). No Network tab was open for this test, so "no request to evil.example" is unverified. |
| C15 | Pass | `setcps(1)`, `$:`, `stack`, `.pianoroll()`: ran, 11 events per cycle (correct). Notes: "setcps/setcpm ignored: the tempo is bpm", ".pianoroll() ignored: no drawing on sonorous". Tempo stayed at bpm. |
| D16 | Pass | `set_sound` with mood, synth, hue 20: engine stayed strudel, only the colour changed. Note: "Strudel is on, so the mood, synth and voice were not used. Only the picture applied. Send strudel_mode with on false to go back to the synth". Music kept playing, picture went red-orange. |
| D17 | Pass with caveat | A quiet triangle melody replacing a drum and saw mix was not audibly different to the user, though the player reported it ran. A very different pattern (`s("bd*4")`) changed on the next bar. Same code again: nothing audible, but the report was cleared to "not reported yet". |
| D18 | Pass | bpm 120 to 60 on the next bar; picture followed without glide. |
| D19 | Pass | `strudel_mode on:false`: "back on the synth, where you left it: it fades in", `reads_as` returned. Colour carried over. The stale `pattern` report was still in the result. |
| D20 | Pass, with a bug | Fade of 6 s works. A stray Strudel note plays at full volume at the end of the fade (heard 3 times). Later `set_sound` brought the synth back. |
| D21 | Pass | Pattern stopped, synth state played. The result does not say Strudel was stopped. |
| D22 | Pass on desktop | Chiptune loop (128 BPM, 8 bars) ran about 20 minutes with no calls; server state unchanged. Phone glitches: see issue 8. |
| E23 | Pass | Panel "Strudel code · N BPM", read-only. No visible cue that it can be opened (issue 4). |
| E24 | Pass | Copy code adds the tempo line; plays at the same tempo in strudel.cc. |
| E25 | Pass | Open in Strudel loads the code. |
| E26 | Pass, with a bug | Stop and Play work. On Android, restarting after Stop glitches and sometimes speeds up to catch up. Stray note at the end of the fade again. |
| E27 | Pass | Volume and Mute control Strudel. |
| E28 | Pass, with a bug | Two devices on the same beat. Opening the player mid-pattern is clean. After Stop and restart on the phone, it glitches. |
| E29 | Pass, with a bug | Locked screen and backgrounded tab: fine. After Stop and restart: glitch. |
| E30 | Pass on Android Chrome; iOS Safari not tested | Strudel starts on Android Chrome with no error. |
| F31 | Pass | `{"ran":false,"error":"the code froze the sandbox (an endless loop?), so it was stopped"}`. Page stayed usable, other tabs unaffected. |
| F32 | Pass | `ran: true`, no request to example.com in the Network tab (checked on a rerun). |
| F33 | Partial | Probe result: `localStorage:undefined, indexedDB:object, document:undefined, parent:undefined, window:undefined, top:undefined, XMLHttpRequest:function, WebSocket:function`. `indexedDB` is available in the sandbox (should not be). |
| F34 | Pass | `importScripts:NetworkError | Worker created | xhr:NetworkError`. Network tab: only `z` appeared, `(blocked:csp)`. No row for `/a.js` or the nested worker's fetch `/y`. A nested worker can still be created. |
| F35 | Pass | 200,000 `postMessage` calls: page and sound unaffected, no console warning. The brief's "dropped with a note" is not observable in `get_feedback`. |
| F36 | Pass, differs from design | `.cutoff(NaN)` and a 500-char `.lpf(...)`: ran, no break, but `events_per_cycle` was half of the expected (2 instead of 4). `.gain(1e9)`: **silent at volume 75**; the brief says huge gains are deliberately not limited. NaN: silent. The report gave `events_per_cycle: 1` for a two-note pattern. |
| F37 | Pass | Forged messages (three shapes) did not appear. `pattern` kept only the real values. |
| F38 | Pass | With the owner's tab closed and only a private window open: `ran: "not reported yet"`. The private window still showed a Stop pattern button (issue 9). |
| G39 | Pass | Falling streaks, background not pulsing, no flash. The streaks pulse in brightness and size on the beat (the brief says "no brightness pulse"; wording ambiguous). |
| G40 | Pass | Rings scattered for a tense, spontaneous mood; stayed central for a calm one. |
| G41 | Pass | 200 and 30 BPM: no flashing, in time. |
| G42 | Partial | The "Still picture" button works. The player has no separate reduced-motion setting that the user could find, so that half was not tested. |
| H43 | Pass | Text: landing page has "Two ways to make sound", lede mentions Strudel; guide lists `strudel_mode` as live and has "Two ways to make sound: the synth and Strudel". Phone layout: all fine. |

## Issues and requests for Claude Code (most important first)

1. **Strudel is louder than the synth.** At the same slider position, Strudel is clearly louder (comfortable but louder, including the chiptune at slider default). Add a default gain offset (or start level) so both engines match, without clamping the model's code.
2. **Owner switches resume the old pattern on their own.** Re-allowing "Let the model play Strudel code", or locking External, brought the old Strudel song back immediately. It should keep playing the synth until the model's next message. Also, after re-allowing, the code panel was not shown while the pattern played.
3. **Stray Strudel note at the end of a fade.** On every Strudel to synth fade and on `silence`, one note plays at full volume, with no fade (heard at least 3 times, desktop and phone).
4. **The picture does not stop after silence or session end.** The circles keep moving at the synth's last rhythm. After `silence` or `end`, it should fade to black like other states.
5. **Android Chrome: glitches after Stop pattern then Play pattern.** The sound glitches and sometimes runs fast to catch up. Opening mid-pattern, locked screen and sync between devices are fine, so the restart path is the cause.
6. **Non-owner sees Stop pattern.** A signed-out viewer should only see Copy code and Open in Strudel.
7. **Server and player state disagree.** After the owner locks Internal, `get_feedback` still says `playing.engine: "strudel"`. After `silence` and `set_sound mode: "internal"` the results do not say Strudel stopped.
8. **Too many requests.** About 123 requests in 3 minutes, mostly `get_player_state` every 1 to 2 s. Slow down or back off when nothing changes.
9. **Player panel.** The Strudel code panel has no cue that it can be opened (add an arrow or chevron). Face status should sit above the code panel. A label "Sync" in the controls is unclear to the user.
10. **Pattern reports.** They lag by one code change. Resending identical code clears the report to "not reported yet" and the player does not re-send. After `strudel_mode on:false` the synth result still carries the old Strudel `pattern`. `events_per_cycle` can come back lower than the real count (F36) with no "dropped" note, and the flood rule (about 600 events per second) cannot be seen from the model side.
11. **Huge gain.** `.gain(1e9)` was silent, not loud as the brief says. Please document what the player actually does (drop, clamp, or Web Audio overflow).
12. **Sandbox.** `indexedDB` is available in the sandbox (probably separate storage; please confirm) and a nested worker can be created (no request was seen).
13. **Feature request: live code highlighting.** As on strudel.cc, show which notes sound (a small square around the active token), with the code as a soft backdrop behind the picture. Keep Copy, Open in Strudel and Stop on top. The highlight must fade softly, not blink (flash rule).
14. **Feature request: richer background.** Let the gradient move and oscillate between 2 to 3 colours, with changing position and strength, not a fixed two-colour wash.

## Messages to the model that were confusing or inconsistent

- `start_session` with `mode: "external"` returns guidance that says "This session is on auto: it starts on the internal face", while `mode` is "external".
- After `silence` with `end`, calls return `no_session` ("Call start_session first."), not the documented `session_ended`.
- A code string whose last statement is `throw` gives "unexpected ast format without body expression".
- Double-quoted strings are mini-notation in Strudel; a code string with a quote inside gave "[mini] parse error" instead of anything pointing at quoting.
- `reads_as.joy` was held down after a tense call because the voice mode moved to phrygian ("held down by mode, smoothness"), so a later calm call read joy 0.28 for 0.6.

## Too loud

- Strudel in general (issue 1).
- `.gain(1e9)` was tested only with the slider at the minimum first (0.02), then at 75: silent both times.

## Process notes (for the record)

- Test 11: my first oversized string was 3371 chars, accepted, and briefly replaced the pattern; the sawtooth was restored.
- The brief file had corrupted lines; I used the clean copy for everything from test 5 on.
- The owner's tab was open during the first F38 attempt; the valid result is from the rerun with it closed.
- Not tested: iOS Safari (E30); the exact 4000/4001 limit (C11); a reduced-motion setting (G42); "no request to evil.example" (C14).
