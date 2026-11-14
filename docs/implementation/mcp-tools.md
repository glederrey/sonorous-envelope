# MCP tools

Server name: `sonorous-envelope`. Transport: Streamable HTTP at `/api/mcp`. Auth required on every request (see auth.md). The server's `instructions` are in server-instructions.md.

All tools return:
- `content`: one text block with compact JSON (no pretty printing), plus an image block when an image is requested and allowed.
- `structuredContent`: the same object, if the SDK version supports it.

Errors are returned as tool results with `isError: true` and a short JSON `{"error": "<code>", "message": "..."}`, never thrown as protocol errors, so the model can read and recover.

## Shared types (zod, in `packages/shared/src/schemas.ts`)

```ts
const unit = z.number().min(0).max(1);

export const Mood = z.object({
  warmth: unit,       // 0 cold … 1 warm
  closeness: unit,    // 0 distant … 1 close
  joy: unit,          // 0 despair … 1 joy
  calm: unit,         // 0 urgency … 1 calm
  spontaneity: unit,  // 0 measured … 1 spontaneous
  tension: unit.optional(),  // 0 consonant … 1 dissonant; leave out for none (adds clashing stack intervals, detune, grit; reads_as has a tension estimate)
});

export const NoteName = z.string().regex(/^[A-G](#|b)?[0-8]$/);

export const SynthOverride = z.object({
  arp: z.object({
    root: NoteName,
    scale: z.enum(["major","minor","dorian","phrygian","lydian","mixolydian","locrian",
                   "harmonic_minor","pentatonic","whole_tone","chromatic"]),
    chord: z.array(z.number().int().min(1).max(14)).min(1).max(8),   // scale degrees
    pattern: z.enum(["up","down","up_down","random","as_played"]),
    octaves: z.number().int().min(1).max(4),
    tempo: z.number().min(30).max(200),                               // BPM
    rate: z.enum(["1/4","1/8","1/8t","1/16"]),
    gate: z.number().min(0.05).max(1),
    swing: unit,
    density: unit,                                                    // step probability
    on: z.boolean(),
  }).partial(),
  osc: z.object({
    wave: z.enum(["sine","triangle","sawtooth","square"]),
    detune: z.number().min(0).max(50),                                // cents
    voices: z.number().int().min(1).max(3),
  }).partial(),
  filter: z.object({
    type: z.enum(["lowpass","highpass","bandpass"]),
    cutoff: z.number().min(60).max(16000),                            // Hz
    resonance: z.number().min(0.1).max(20),                           // Q
  }).partial(),
  lfo: z.array(z.object({
    target: z.enum(["cutoff","pitch","amp","pan"]),
    rate: z.number().min(0.01).max(12),                               // Hz, see limits for colour. Planned: max 80 when target is "amp", see engine.md
    depth: unit,
    shape: z.enum(["sine","triangle","square","random"]),
  })).max(2),
  env: z.object({
    attack: z.number().min(0.001).max(4),
    decay: z.number().min(0.01).max(4),
    sustain: unit,
    release: z.number().min(0.01).max(8),
  }).partial(),
  drone: z.object({
    on: z.boolean(),
    notes: z.array(NoteName).max(4),
    wave: z.enum(["sine","triangle","sawtooth","square"]),
    level: unit,
  }).partial(),
  fx: z.object({
    delay: z.object({ time: z.number().min(0.05).max(1.5), feedback: z.number().min(0).max(0.85), mix: unit }).partial(),
    reverb: z.object({ size: unit, mix: unit }).partial(),
  }).partial(),
  volume: unit,
}).partial();

export const Gesture = z.object({
  type: z.enum(["purr","meow_up","meow_down","chirp","laugh","growl","sigh","hum","pluck","breath"]),
  intensity: unit.default(0.5),
});

export const Colour = z.object({
  mode: z.enum(["follow","own"]).default("follow"),   // "follow" gives the colours, motion and shape back to the mood and ignores hue, saturation, lightness, secondary, motion, texture and shape; a scene, density, speed or sync sent in the same call is applied after the reset and kept (v0.17.2)
  hue: z.number().min(0).max(360).optional(),
  saturation: unit.optional(),
  lightness: unit.optional(),
  secondary: z.object({ hue: z.number().min(0).max(360), saturation: unit, lightness: unit }).optional(),
  motion: z.enum(["still","drift","pulse"]).optional(),
  texture: z.enum(["flat","grain","soft_noise"]).optional(),
  scene: z.enum(["none","motes","ripples","rain","snow","embers","aurora","waves","fireflies","stars","bubbles","leaves","seeds","tide","smoke","clouds","fire","warp","caustics","lightning","sunbeam","cracks","ink","circuit","digital","scope","vines","fireworks","reeds","network","flock"]).optional(),   // moving things over the colour; left out: the mood picks one (visuals.md), "none" turns it off
  density: unit.optional(), speed: unit.optional(),               // for a scene
  sync: z.enum(["beat","phrase","free"]).optional(),              // what the motion follows; left out: the mood decides
});

export const Transition = z.object({
  time: z.number().min(0).max(30).default(4),   // seconds
  curve: z.enum(["smooth","sudden"]).default("smooth"),
});
```

Keep every field description short in the tool schema: the model reads them.

> **Built (2026-11-09):** `osc.stack` (intervals in semitones, max 3), a `pad` object (`on`, `notes` max 5, `wave`, `level`, `attack`, `release`; sending notes turns it on), `lfo.rate` up to 80 for the `amp` target only (12 for the others, validated per target). The fast amp LFO has no consent row or harshness term any more (limits are removed) and never drives the colour pulse. (`voice` on `start_session` and `set_sound` and `resting` in the feedback are built.) Keep field descriptions short: the model reads every one.

> **Status (2026-11-10):** all five tools are live, with `reads_as`/`sound`, gestures, reactions, `tension`, modes and the tempo glide; the spectrogram image is not built. The code is in `apps/web/lib/mcp/` (`service.ts` holds the logic and is tested against a real Postgres by `scripts/test-api.sh`).

## `start_session`
> **Built (2026-11-10, #16; renamed and made switchable 2026-11-10):** the two faces of the envelope (Anzieu). `start_session` takes `mode: "auto" | "internal" | "external"` (default auto, which starts internal; `inner` and `outer` still work as old names). A session is always on **auto** until its owner locks a face from the player (`set_mode_policy`, column `sessions.mode_policy`). The column `sessions.mode` is the face playing now. The result carries `mode` (with "locked by the owner" when it is) and `guidance` for the face plus the switching rules (`apps/web/lib/mcp/modes.ts`). The model switches with `mode` on `set_sound`:
> - A lock is final: the call is ignored with a note.
> - On auto the model switches either way at once. There is no timer and no message count (removed 2026-11-10 at Gael's request; it had also counted the owner's own changes). The safeguard is consent, a rule in the guidance (offer in words, switch only after a yes or a clear request, never on its own reading of the mood), plus the owner's lock and the log.
> - Every change, by the model or the owner, is a row in `mode_changes` and shows in `inspect` as `face_changes`.
>
> The external face never fades (`effectiveRestAfter`); reaction buttons exist only on it. `set_sound`, `get_feedback` and `silence` return `mode`. A new turn starts after a final state, or after a non-final one more than 3 minutes old, so one message is one turn.


Input:
```ts
{ title?: string /* max 80 chars, optional short name; Claude can also set it later with set_sound */ }

The session name belongs to Claude: the owner cannot rename it. `set_sound` takes an optional `title` (max 80 chars, trimmed, empty ignored) that replaces the name. The sessions page shows "Session of <date and time>" when none was set.
```
Behaviour:
1. Create a session with a new ID, `owner_id` = caller, `settings` = caller's `profiles.default_settings` merged over the safe defaults (limits.md).
2. Insert the owner's `listeners` row (role `owner`, label `you`).
3. Insert an initial state: neutral mood `{warmth:0.5, closeness:0.5, joy:0.5, calm:0.8, spontaneity:0.2}` at volume 0.3, `final: true`, turn 0.
4. Return:
```json
{"session_id":"…","player_url":"https://<app>/s/…","settings":{"rest_after":900},
 "note":"Share player_url with the user so they can listen. Pass session_id in every call."}
```
A user can have several active sessions. `start_session` never reuses one.

## `set_sound`

Input:
```ts
{
  session_id: string,           // optional at schema level; see fallback below
  mood?: Mood,                  // left out: the mood of the last call stays (note "mood kept from your last call")
  synth?: SynthOverride,
  gesture?: Gesture  // REMOVED in v0.12 (see engine.md, "Gestures (removed)"); was built (2026-11-10): played once with the state; dropped with a note when the last one was less than 20 s ago
  colour?: Colour,
  transition?: Transition,
  final?: boolean,              // default false; true on the last call of each message
  keep_voice?: boolean,         // freeze the scale, root, note order and wave that play now as the session voice (needs a previous state); notes say "voice kept"
  rest_after?: number | null,   // seconds before the sound fades with no update, null = never. Shared with the owner (limits.md, "Who can change what")
  voice?: Voice,                // replaces the session's voice (mood-mapping.md); {} clears it; transition at least 8 s
  note?: string                 // optional, max 200 chars: what the model meant (stored, shown in session details and in the player's "What Claude set" panel; not echoed back in the feedback, the model already has it; listed in `inspect` history)
}
```
Behaviour, in order:
1. Resolve the session (see "Session resolution"). Reject if ended.
2. Load `settings` and the current effective state.
3. `mapped = moodToEngineState(mood)` (mood-mapping.md), then deep-merge `synth` over it. Planned: `stretch` runs on the mood first, then the mood floor, then mapping, then voice, then `synth` (mood-mapping.md, "Stretch" and "Voice").
4. `{effective, clamps} = applyLimits(mapped, gesture, colour, transition, settings, previousEffective)` (limits.md). This also drops the gesture if gestures are off.
5. Pick a `seed` (random 32-bit). Insert the state row with `intent`, `effective`, `clamps`, `seed`, `final`, `turn` (= session.turn + 1 if this is the first update of a new turn, else the same).
6. Update the session: `current_state_id`, `last_active_at`, `pending_final = !final`, and `turn += 1` when `final` is true.
7. Run analysis on `effective` with `seed` (analysis.md). Store it on the state row. Target < 300 ms.
8. Claim pending reactions (`claim_reactions` RPC).
9. Check presence (is any player connected? see realtime.md).
10. Return the compact feedback.

Steps 5 and 6 come before 7, so players start gliding while the analysis runs.

### Feedback object (returned by `set_sound` and `get_feedback`)
```json
{"turn":12,
 "intent":{"warmth":0.8,"closeness":0.7,"joy":0.6,"calm":0.75,"spontaneity":0.3},
 "reads_as":{"warmth":0.55,"closeness":0.6,"joy":0.58,"calm":0.8,"spontaneity":0.25},
 "playing":{"scale":"D dorian","tempo":64,"wave":"triangle","cutoff":900,"volume":0.5,"drone":true,"gesture":"purr"},
 "clamped":["volume 0.7→0.5 (listener limit)"],
 "sound":{"loudness_db":-24,"brightness":"low","roughness":0.2,"density":"sparse","movement":"slow"},
 "colour":{"h":30,"s":0.4,"l":0.35,"motion":"drift"},
 "listener":["you: pressed calmer","you: volume 0.8→0.5"],
 "controls":{"volume":0.5,"delay":0.5},
 "players":1,
 "notes":["no final update last turn"]}
```
Rules:
- Omit empty arrays and fields with nothing to say (`clamped`, `listener`, `notes`).
- `playing` lists only the most informative effective parameters (scale, tempo, wave, cutoff, volume, drone on/off, gesture if any).
- **Level step.** One call may raise the loudness (measured on the server, `sound.loudness_db`) by at most 4 dB over the previous state; a bigger jump is held to that step by scaling the master volume for that state only, and `clamped` says "level held" (so `inspect` shows it too). Going down is never held. The model can go on in the next call.
- `playing` echoes `cutoff`, `resonance` and `detune` besides the notes, so a caller can confirm a timbre change arrived.
- `sound.roughness` is the dissonance of the notes sounding together (from the note events, averaged over them). It does not hear timbre: cutoff, resonance, detune and drive do not move it, and a denser or faster pattern can lower it. "Harsher" shows in `sound.brightness` and in the settings echoed in `playing`, not in roughness.
- `sound` uses words for brightness (`very low|low|medium|high|very high`), density (`silent|sparse|medium|dense`) and movement (`still|slow|moving|busy`); numbers for loudness (dBFS, integer) and roughness (0–1, 2 decimals).
- Mood values rounded to 2 decimals.
- `controls` is the owner's own player volume, 0 to 1, as last reported by their player (realtime.md). The volume is the listener's: the model cannot set it (`synth.volume` does not exist). Other listeners can only listen, so their settings are never reported. Omit it if the owner's player has not reported yet. It is always included when present, because it changes how the model should read every other field.
- `reads_why` (only where an axis in `reads_as` is 0.25 or more away from what was sent): per axis, `held down by a, b` or `lifted by a, b`, the two terms of its formula that pull it (e.g. joy: mode, brightness, tempo, smoothness).
- `notes` also says `tempo A to B: it glides over N s` (or `it changes at once when this state starts` when the transition is sudden or shorter than 0.5 s) when the tempo changed, and `no full voice: the mood moved the voice from X to Y. Send keep_voice to hold it` when no complete voice is set and a call changed root, scale or wave.
- `resting`: only when the owner's `rest_after` setting is on. `true` when this call arrives more than `rest_after` seconds after the previous state, with the note `"the sound faded after N min without an update from you"`.
- `players: 0` adds the note `"no player open: nobody is hearing this"`.
- `listener` entries are human-readable, prefixed with the listener label, oldest first, at most 10 (then `"…and N more"`).
- If `pending_final` was still true when this turn started (the previous turn ended without a final call), add the note `"no final update last turn"`. Detect a "new turn" as: the previous state was non-final and more than 20 s old, or the previous state was final.
- With `image_feedback: "every_turn"` and `final: true`, append the spectrogram image block.

### What stays on the session
The voice (`sessions.voice`) and a second set, `sessions.sticky` (migration 0005): the colour, `osc.stack`, `pad` and `lfo`. A call that sends none of them changes nothing; one that sends some merges field by field into what is kept. Clearing: colour `mode: "follow"`, `osc.stack: []`, `lfo: []` (back to the mapped LFOs, not "no LFOs"; use `depth: 0` for that). The pad stays but `pad.on: false` silences it. The rest of `synth` is for one call. Order: mapped, voice, kept settings, the call's `synth`, limits (`shared/src/sticky.ts`, `mapSound` in `service.ts`).

The feedback's `playing` mirrors what Claude can set: scale, tempo, wave, cutoff, volume, drone, pattern, rate, octaves, chord, and when present `arp: "off"`, `stack`, `pad`, `lfo` (one string per LFO), plus `echo` and `reverb` mix.

## `strudel_mode`
Switches the engine between the built-in synth and Strudel (roadmap #18, [strudel.md](strudel.md)). Input: `{ session_id?, on, code?, bpm?, colour?, final, title?, note? }`. `on: true` needs `code` (at most 4000 characters, parsed on the server with acorn, never run) and `bpm` (30 to 200; one cycle is one bar of four beats). `on: false` goes back to the synth where it was left. External face only: on the internal face it returns `internal_face` (with the owner's "final" note when locked); with the owner's switch off it returns `code_off`. The result is the usual feedback object with `playing: { engine: "strudel", bpm, code: "N characters" }`, no `reads_as`, and `pattern`: what the owner's player reported about the code that played (`ran`, `error`, `events_per_cycle`, `notes`, `source`), or `ran: "not reported yet"`. `set_sound` never changes the engine: while Strudel is on it only applies the colour, title and `rest_after`, with a note. If the owner locks the face to internal or switches code off after the pattern started, the database strips the pattern from the playing state, so `get_feedback` shows the synth in `playing` and no `pattern` (migration 0011).

## `get_feedback`

Input: `{ session_id: string }`. Returns the feedback object for the current state without changing anything except claiming reactions. Uses the stored analysis.

## `inspect` (history built; spectrogram not)

Input: `{ session_id: string, what: "spectrogram" | "history" }`.
- `spectrogram`: only if `settings.image_feedback` is `on_request` or `every_turn`. Otherwise return `{"error":"image_feedback_off","message":"The listener has image feedback turned off."}`. Returns a PNG (see analysis.md) plus a one-line caption.
- `history`: the last 8 states as one line each: turn, final, intent mood, reads_as, clamps count, and the note if there was one. Text only.

## `silence`

Input: `{ session_id: string, fade?: number /* seconds, default 4, max 30 */, final?: boolean, end?: boolean  }`.
With `end: true` the session ends once the fade is over (`ended_at` set, state final). The model uses it when the user says the session is finished, after one `set_sound` that plays a short closing sound with a long transition. Further calls return `session_ended`.
Sets volume 0 and drone off with the given fade (with `end`, the layers stay on and only the volume fades, so the closing sound is not cut; give it a fade of 10 to 30 s). With `end` the state carries `transition.delay`: the time left of the previous state's transition (at most 30 s), so the closing sound plays out before the fade starts; the engine keeps the timing (`Engine.setState(state, seed, delaySec)`), a newer state replaces one that is still waiting. The returned `volume` is 0 at once because it reports the target, not the point in the fade, as a normal state (so it is logged and can be followed by `set_sound`). Returns the feedback object.

## Session resolution
Every tool except `start_session` takes `session_id`.
- If given: load it. If it doesn't exist or the caller isn't the owner, return `{"error":"unknown_session"}`.
- If missing: use the caller's most recently active, non-ended session, and add the note `"session_id missing: used <id>"`. If none exists, return `{"error":"no_session","message":"Call start_session first."}`.

## Rate limits
- At most 20 `set_sound` calls per session per minute, and 1 per 300 ms. Beyond that, return `{"error":"too_fast"}` without storing.
- At most 10 active sessions per user; `start_session` beyond that ends the oldest.

## Tool descriptions (as the model sees them)
- `start_session`: "Start a sound session for this conversation. Returns a session_id to pass to every other call and a player link to give the user."
- `set_sound`: "Update the sound and colour that play to the user. Call it whenever you want during your turn, and always once with final=true at the end of each message. Describe a mood; optionally override synth settings, add one short gesture, or set your own colour. Returns what is actually playing, how it reads, and the listener's reactions."
- `get_feedback`: "Read what is playing and the listener's latest reactions without changing the sound."
- `inspect`: "Get heavier feedback: a spectrogram image of the last seconds (only if the listener enabled images) or the recent history."
- `silence`: "Fade the sound to silence."
