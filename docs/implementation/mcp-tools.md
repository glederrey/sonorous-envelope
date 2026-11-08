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
    rate: z.number().min(0.01).max(12),                               // Hz, see limits for colour
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
  mode: z.enum(["follow","own"]).default("follow"),
  hue: z.number().min(0).max(360).optional(),
  saturation: unit.optional(),
  lightness: unit.optional(),
  secondary: z.object({ hue: z.number().min(0).max(360), saturation: unit, lightness: unit }).optional(),
  motion: z.enum(["still","drift","pulse"]).optional(),
  texture: z.enum(["flat","grain","soft_noise"]).optional(),
});

export const Transition = z.object({
  time: z.number().min(0).max(30).default(4),   // seconds
  curve: z.enum(["smooth","sudden"]).default("smooth"),
});
```

Keep every field description short in the tool schema: the model reads them.

## `start_session`

Input:
```ts
{ title?: string /* max 80 chars, optional label */ }
```
Behaviour:
1. Create a session with a new ID, `owner_id` = caller, `settings` = caller's `profiles.default_settings` merged over the safe defaults (limits.md).
2. Insert the owner's `listeners` row (role `owner`, label `you`).
3. Insert an initial state: neutral mood `{warmth:0.5, closeness:0.5, joy:0.5, calm:0.8, spontaneity:0.2}` at volume 0.3, `final: true`, turn 0.
4. Return:
```json
{"session_id":"…","player_url":"https://<app>/s/…","settings":{"consent":"ambient","max_volume":0.6,"gestures":true,"image_feedback":"off"},
 "note":"Share player_url with the user so they can listen. Pass session_id in every call."}
```
A user can have several active sessions. `start_session` never reuses one.

## `set_sound`

Input:
```ts
{
  session_id: string,           // optional at schema level; see fallback below
  mood: Mood,                   // required
  synth?: SynthOverride,
  gesture?: Gesture,
  colour?: Colour,
  transition?: Transition,
  final?: boolean,              // default false; true on the last call of each message
  note?: string                 // optional, max 200 chars: what the model meant (stored, shown in session details, never sent back)
}
```
Behaviour, in order:
1. Resolve the session (see "Session resolution"). Reject if ended.
2. Load `settings` and the current effective state.
3. `mapped = moodToEngineState(mood)` (mood-mapping.md), then deep-merge `synth` over it.
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
- `sound` uses words for brightness (`very low|low|medium|high|very high`), density (`silent|sparse|medium|dense`) and movement (`still|slow|moving|busy`); numbers for loudness (dBFS, integer) and roughness (0–1, 2 decimals).
- Mood values rounded to 2 decimals.
- `controls` is the listener's current player volume and echo (`delay`) setting, 0 to 1, as last reported by a player (realtime.md). Omit it if no player has reported yet. It is always included when present, because it changes how the model should read every other field.
- `players: 0` adds the note `"no player open: nobody is hearing this"`.
- `listener` entries are human-readable, prefixed with the listener label, oldest first, at most 10 (then `"…and N more"`).
- If `pending_final` was still true when this turn started (the previous turn ended without a final call), add the note `"no final update last turn"`. Detect a "new turn" as: the previous state was non-final and more than 20 s old, or the previous state was final.
- With `image_feedback: "every_turn"` and `final: true`, append the spectrogram image block.

## `get_feedback`

Input: `{ session_id: string }`. Returns the feedback object for the current state without changing anything except claiming reactions. Uses the stored analysis.

## `inspect`

Input: `{ session_id: string, what: "spectrogram" | "history" }`.
- `spectrogram`: only if `settings.image_feedback` is `on_request` or `every_turn`. Otherwise return `{"error":"image_feedback_off","message":"The listener has image feedback turned off."}`. Returns a PNG (see analysis.md) plus a one-line caption.
- `history`: the last 8 states as one line each: turn, final, intent mood, reads_as, clamps count. Text only.

## `silence`

Input: `{ session_id: string, fade?: number /* seconds, default 4, max 30 */, final?: boolean }`.
Sets volume 0 and drone off with the given fade, as a normal state (so it is logged and can be followed by `set_sound`). Returns the feedback object.

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
