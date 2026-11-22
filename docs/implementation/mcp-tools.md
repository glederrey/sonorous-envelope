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

> **Status (2026-11-10):** all six tools are live, with `reads_as`/`sound`, gestures, reactions, `tension`, modes and the tempo glide; the snapshot (`inspect`, `what: "snapshot"`) is built (2026-11-21). The code is in `apps/web/lib/mcp/` (`service.ts` holds the logic and is tested against a real Postgres by `scripts/test-api.sh`).

## `start_session`
> **Built (2026-11-15, three modes and lazy guidance):** the sound channel has three modes, stored as `internal | external | sandbox` and shown to people as **Self**, **Attuned** and **Jukebox** (`MODE_LABEL`, `apps/web/lib/mcp/modes.ts`; `inner`, `outer` and the labels are accepted as input). `start_session` takes `mode: "auto" | "internal" | "external" | "sandbox"` (default auto, which starts internal; external when the listener stated a need for sound; sandbox when they want to choose what plays). A session is on **auto** until its owner locks a mode from the player (`set_mode_policy`, column `sessions.mode_policy`, now also `sandbox`). The column `sessions.mode` is the mode playing now. The model switches with `mode` on `set_sound`:
> - A lock is final: the call is ignored with a note.
> - On auto the model switches between any two modes at once. There is no timer and no message count. The safeguard is consent, a rule in the guidance (offer in words, switch only after a yes or a clear request), plus the owner's lock and the log. A successful switch adds the note `switched to external (Attuned): say so in one short sentence`.
> - Every change, by the model or the owner, is a row in `mode_changes` and shows in `inspect` as `face_changes`.
>
> External and sandbox are the listener modes (`forListener`): Strudel is allowed, the sound never fades (`effectiveRestAfter`), and reaction buttons exist. `set_sound`, `get_feedback`, `silence` and `strudel_mode` return `mode`, as `external (Attuned)`, with `, locked by the owner` when it is. A new turn starts after a final state, or after a non-final one more than 3 minutes old, so one message is one turn.
>
> **Lazy guidance.** The server instructions only name the modes. The rules of a mode reach the model as a top-level `guidance` string: `start_session` returns the starting mode's rules plus the picture controls; after that, `set_sound` (also while Strudel plays), `strudel_mode`, `get_feedback` and `silence` (not when ending) add `guidance` once, in the first result where the final mode differs from `sessions.guided_mode` (the mode whose rules the model last received, migration 0016). The server then stores that mode in `guided_mode`, with the caller's token. When the owner changed the mode in the player (no switch in this call), the result also carries the note `the owner switched the mode to external (Attuned)`. A null `guided_mode` (a session from before the migration) is set to the current mode and sends nothing. A change of lock/auto alone sends no guidance. The decision is the pure function `guidanceUpdate({ guided, face, switched })` in `service.ts`, which returns `{ send, ownerChanged, store }`.
>
> **v0.19.1 (2026-11-15): the model uses the listener's names.** The tool schemas take only `self | attuned | jukebox` (`start_session` also `auto`); the stored values stay `internal | external | sandbox` and `normalizeFace` maps both. Results name the mode as `Self`, `Attuned` or `Jukebox` (`faceName`), e.g. `switched to Attuned: say so in one short sentence`, `Attuned, locked by the owner`, `the owner switched the mode to Self`. The guidance and instructions use only these names. The examples above with `external (Attuned)` are the v0.19.0 wording.

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
{"session_id":"…","player_url":"https://<app>/s/…","version":"v0.19.3","settings":{"rest_after":900},
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
  // rest_after: removed 2026-11-21, the sound never fades by itself (see "No fade" below)
  voice?: Voice,                // replaces the session's voice (mood-mapping.md); {} clears it; transition at least 8 s
  motif?: Motif,                // roadmap #128: a short phrase of its own over the sound, played once, a few seconds later on a bar; see "Motif" below
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

### Motif (roadmap #128, migration 0025)
`motif: { notes?: string[] /* 1 to 8: "E4", "G#3", "Bb5" (C2 to B6), "-" a rest */, beats?: number[] /* 0.25 to 4 each, one per note, default 1 */, name?: string /* 1 to 40: keep it to quote later */, recall?: string /* a named motif instead of notes */, first?: number /* 1 to 8, with recall: only its first notes */, repeat: 1 to 4 (default 1), level: 0 to 1 (default 0.6) }`. Exactly one of `notes` and `recall`; `beats` needs one value per note (zod refines in `schemas.ts`). Any mode where the synth plays, Self included.
- When the phrase has notes outside the scale the voice plays in (`arp.root`, `arp.scale`; not for chromatic), the result says which: `motif notes outside the voice's F# lydian: E4 G4 A4 B4 (fine if you meant it)` (v0.22.1).
- It plays once, on the first bar at least 2.5 s after the state, in the state's wave (engine.md, "Motif voice"), over the sound as set by the same call: the sound under it is unchanged. It is **not sticky**: only the call that sends it carries it (the next state has none; `silence` and a moment recall strip it).
- Server (`setSound`, synth path): `recall` looks the name up in `sessions.motifs` (`unknown_motif`: `No motif named "x". Named: a, b.` or `none`), `first` slices notes and beats. Notes become MIDI (`-` is -1) and the effective state gets `motif: { id (random 31-bit), notes, beats, repeat, level }`, after `applyLimits` and the level hold. `name` with notes stores `{ notes, beats, kept_at, turn }` in `sessions.motifs`: at most 12 names, a new one when 12 exist is `motifs_full`, a used name is replaced. The analysis (`reads_as`) is made without the motif.
- While Strudel plays the motif is ignored, with the note `Strudel is on: the motif was not played; write the phrase in your code`.
- Result: `playing.motif` as `"E4 G4 A4 · beats 1 1 2 · ×1"` (rests as `-`) when the call carried one; the note `motif kept as "x"` when named. `moment` `list` returns `motifs: [{ name, notes: "E4 G4 A4", turn }]` when any are named. `inspect` history appends ` · motif "name"` (or ` · motif`) to the line of the state that carried one.

### Feedback object (returned by `set_sound` and `get_feedback`)
```json
{"turn":12,
 "intent":{"warmth":0.8,"closeness":0.7,"joy":0.6,"calm":0.75,"spontaneity":0.3},
 "playing":{"scale":"D dorian","tempo":64,"wave":"triangle","cutoff":900,"resonance":0.2,"detune":4,"volume":0.5,"drone":true,"pattern":"up","rate":1,"octaves":1,"chord":false,"echo":0.3,"reverb":0.4},
 "clamped":["level held: this sound would have been 6 dB louder than your last, so it was kept to +4 dB; send again to go further"],
 "colour":{"h":30,"s":0.4,"l":0.35,"motion":"drift"},
 "controls":{"volume":0.5},
 "sound":{"brightness":"low","density":"sparse","movement":"slow","loudness_db":-24,"roughness":0.2},
 "reads_as":{"warmth":0.55,"closeness":0.6,"joy":0.58,"calm":0.8,"spontaneity":0.25},
 "reads_why":{"warmth":"held down by brightness, roughness"},
 "reactions":["calmer, 40 s ago","softer x2, 2 min ago"],
 "mode":"Attuned",
 "players":1,
 "notes":["no final update last turn"]}
```
Rules:
- Key order as built: `turn`, `intent`, `playing`, `clamped`, `colour`, `controls`, `sound`, `reads_as`, `reads_why`, `pattern`, `reactions`, `heard`, `guests`, `mode`, `players`, `resting`, `notes`, then `guidance` once after a mode change.
- Omit empty arrays and fields with nothing to say (`clamped`, `reads_why`, `pattern`, `reactions`, `heard`, `guests`, `resting`, `notes`).
- `playing` mirrors what the model can set (scale, tempo, wave, cutoff, resonance, detune, volume, drone, the arpeggio, stack, pad, LFOs, echo and reverb, and the picture when the model chose a scene). While Strudel plays it is `engine`, `bpm`, the code's length and the scene; there is no `sound` or `reads_as` then, and `pattern` carries the player's report.
- `reactions` are returned only in Attuned and Jukebox. In Self nobody steers the sound: pending reactions are claimed and dropped, so they do not surface after a later switch.
- `heard` ("What I heard", #129) is how the sound read to the listener, one line per reading like `reactions` ("tense x2, 30 s ago"). Returned in every mode, Self included, claimed once with the reactions. Only the owner's rows count: a reading from another member is claimed and dropped. It is not a request: the Self guidance says never to change the sound to match it, and to say in a sentence what was meant only when the listener heard something else.
- `guests` (#152) is one string with the emoji presses of other people listening by the link, counts only, since the last call: `"❤️ 3 · 👍 1, over the last 4 min"` (most pressed first). Only when there is something. Information like `heard`, in every mode, Self included; claimed once by `set_sound` and `strudel_mode` (`claim_emojis`), only peeked by `get_feedback`. Guests are not the owner and not accounts, so there is no per-person detail. The instructions say it is not an order and the owner's wishes come first. `listen` returns `guests` when the owner's press ends its wait (it peeks and never claims), but a guest press alone does not end the wait: link listeners never trigger a turn.
- **Level step.** One call may raise the loudness (measured on the server, `sound.loudness_db`) by at most 4 dB over the previous state; a bigger jump is held to that step by scaling the master volume for that state only, and `clamped` says "level held" (so `inspect` shows it too). Going down is never held. The call that switches the session into Attuned (`mode: attuned` on auto, not an owner switch) is held to +0 dB: the first sound made for the listener starts no louder than what played, and `clamped` says so (v0.19.2; readings are whole dB, so the held sound is tightened again until it reads at most the step). Other switches keep the 4 dB step. The model can go on in the next call.
- `playing` echoes `cutoff`, `resonance` and `detune` besides the notes, so a caller can confirm a timbre change arrived.
- `sound.roughness` is the dissonance of the notes sounding together (from the note events, averaged over them). It does not hear timbre: cutoff, resonance, detune and drive do not move it, and a denser or faster pattern can lower it. "Harsher" shows in `sound.brightness` and in the settings echoed in `playing`, not in roughness.
- `sound` uses words for brightness (`very low|low|medium|high|very high`), density (`silent|sparse|medium|dense`) and movement (`still|slow|moving|busy`); numbers for loudness (dBFS, integer) and roughness (0–1, 2 decimals).
- Mood values rounded to 2 decimals.
- `controls` is the owner's own player volume, 0 to 1, as last reported by their player (realtime.md). The volume is the listener's: the model cannot set it (`synth.volume` does not exist). Other listeners can only listen, so their settings are never reported. Omit it if the owner's player has not reported yet. It is always included when present, because it changes how the model should read every other field.
- `reads_why` (only where an axis in `reads_as` is 0.25 or more away from what was sent): per axis, `held down by a, b` or `lifted by a, b`, the two terms of its formula that pull it (e.g. joy: mode, brightness, tempo, smoothness; for warmth the dark sound is `darkness`, a term that lifts the reading when the sound is dark).
- `notes` also says `tempo A to B: it glides over N s` (or `it changes at once when this state starts` when the transition is sudden or shorter than 0.5 s) when the tempo changed (no note and no glide when the state before was silent and its fade is over: after `silence` or an owner lock to Self, the old tempo was not heard, so the new state starts at its own: `nextGrid` writes `grid.glide` 0, which the player already follows), and `no full voice: the mood moved the voice from X to Y. Send keep_voice to hold it` when no complete voice is set and a call changed root, scale or wave. With an auto-adopted voice (no voice sent), the notes also say `your joy moved the mode of your voice` and `your warmth moved the wave of your voice` when a band changed.
- **No fade (2026-11-21, Gael: "It always plays until the user closes the tabs or ends the session").** The sound never fades by itself in any mode: `effectiveRestAfter` returns null, `set_sound` and `strudel_mode` no longer take `rest_after` (an old client sending it is ignored), `start_session` returns no `settings`, `resting` never appears, and the player has no "Fade to silence after" control. A stored `settings.rest_after` is ignored. The text below about the fade is history.
- `resting`: only when the owner's `rest_after` setting is on. `true` when this call arrives more than `rest_after` seconds after the previous state, with the note `"the sound faded after N min without an update from you"`.
- `players: 0` adds the note `"no player open: nobody is hearing this"`.
- `reactions` entries are one line per kind, newest first, at most 8: the kind, `xN` when pressed more than once, and how long ago.
- If `pending_final` was still true when this turn started (the previous turn ended without a final call), add the note `"no final update last turn"`. Detect a "new turn" as: the previous state was non-final and more than 20 s old, or the previous state was final.
- No image comes back with `set_sound` (`every_turn` is not built); the model asks for one with `inspect` `snapshot`.

### What stays on the session
The voice (`sessions.voice`) and a second set, `sessions.sticky` (migration 0005): the colour, `osc.stack`, `pad` and `lfo`. A call that sends none of them changes nothing; one that sends some merges field by field into what is kept. Clearing: colour `mode: "follow"`, `osc.stack: []`, `lfo: []` (back to the mapped LFOs, not "no LFOs"; use `depth: 0` for that). The pad stays but `pad.on: false` silences it. The rest of `synth` is for one call. Order: mapped, voice, kept settings, the call's `synth`, limits (`shared/src/sticky.ts`, `mapSound` in `service.ts`).

The feedback's `playing` mirrors what Claude can set: scale, tempo, wave, cutoff, volume, drone, pattern, rate, octaves, chord, and when present `arp: "off"`, `stack`, `pad`, `lfo` (one string per LFO), plus `echo` and `reverb` mix. Note: `synth.arp.tempo` is for one call, like the rest of the call's synth: the next call goes back to the mood's tempo unless it sends the tempo again (a handy way to set a BPM; not in the tool description, which is at its size limit).

## `strudel_mode`
Switches the engine between the built-in synth and Strudel (roadmap #18, [strudel.md](strudel.md)). Only in a listener mode (Attuned or Jukebox): in Self the call is refused. On auto the error code is `self_mode` and the message is `Strudel is for the Attuned and Jukebox modes. Offer one in words; if the listener says yes, switch with set_sound mode (attuned or jukebox), then call this again.`; when the owner locked Self the code is `self_locked` and the message is `mode stays Self: the owner locked it. It is final: do not try to change it or comment on it.` The drawing list and the other Strudel rules are in `apps/web/lib/mcp/guidance/strudel.ts`, sent with the mode. Input: `{ session_id?, on, code?, bpm?, colour?, final, title?, note? }`. `on: true` needs `code` (at most 5000 characters, parsed on the server with acorn, never run) and `bpm` (30 to 200; one cycle is one bar of four beats). `on: false` goes back to the synth, silent (volume 0) and with no scene: Strudel and the picture fade to black over 2 s and nothing plays until the next `set_sound`, which fades in from black (v0.18.6; before, it restored the synth as it was left, and its old scene showed until that `set_sound`). The paused synth's other fields stay, so `keep_voice` still works. The result has no `reads_as`, like `silence`. Listener modes only (Attuned and Jukebox): in Self it returns `self_mode` (or `self_locked` with the owner's "final" note); with the owner's switch off it returns `code_off`. The result is the usual feedback object with `playing: { engine: "strudel", bpm, code: "N characters" }`, no `reads_as`, and `pattern`: what the owner's player reported about the code that played (`ran`, `error`, `events_per_cycle`, `notes`, `source`), or `ran: "not reported yet"`. The picture: the listener sees the code with the sounding parts lit, and the drawings the code asks for (`.pianoroll()`, `.punchcard()`, `.wordfall()`, `.spiral()`, `.pitchwheel()`, `.scope()`, `.fscope()`, `.spectrum()`; the `_` forms take a lane at the bottom); `markcss` and `hydra` are noted as unavailable ([strudel.md](strudel.md), "The picture"). `set_sound` never changes the engine: while Strudel is on it only applies the colour, title and `rest_after`, with a note. If the owner locks the mode to Self or switches code off after the pattern started, the database strips the pattern from the playing state, so `get_feedback` shows the synth in `playing` and no `pattern` (migration 0011).

## `listen` (live tuning, migration 0019)
Input: `{ session_id?: string, seconds?: integer /* 5 to 45, default 20 */ }`. Only ever the last call of a message, after all the text: `set_sound` itself never waits, so a sound change mid-answer never holds the text back. The default is short because a message the user types in Claude Code is queued until the call returns (in claude.ai the user presses stop, which ends the wait at once). Attuned and Jukebox only: in Self the call is refused with `not_in_this_mode` ("listen works in Attuned and Jukebox only. In Self nobody steers the sound: end your message."). It waits inside the model's turn for the listener to press a button and returns as soon as they do, so the model can answer in the same message. It never changes the sound.

Behaviour: it checks presence (nobody playing: `nobody_listening` at once), then looks at the pending reactions (any: `reactions` at once). Besides the unread presses it also returns presses made from 1 s before it started that another call already marked read (v0.22.1, tester report v0.22.0: a final `set_sound` sent in the same parallel batch claimed a press made during the wait, and `listen` then waited idle). The description, the guidance and the live note say to call it once the final call has returned, never in the same batch. v0.22.2 (tester report v0.22.1): the description says `reactions` are Guide the sound and `heard` what the listener heard (both come back), and, with the live note, that text written before a tool call can be folded away in claude.ai, so a question for the user goes after the last `listen`. The snapshot's `of` says, when the picture is also more than 45 s old, that the owner's player takes pictures only while it is visible (not in a background tab); the player takes one 6 s after it becomes visible again. v0.22.5 (tester report v0.22.4): the text says "on their screen (not minimized and not in a background tab)", since a window covered by another app still counts as visible to the browser, and the player now waits 10.5 s after it comes back, so the spectrogram covers a full 10 s. `reads_why.joy`, when the scale is what holds joy down ("mode"), adds that a higher joy number cannot lift it and a brighter scale in `voice` can. Otherwise it writes `sessions.listening_until` (the end of the wait; the player shows "Claude is listening") and every 1.5 s looks at the pending reactions and the session row. `listening_until` is cleared when the wait ends (only if it still holds the value this call wrote, so a newer `listen` is not cleared). **It never claims**: if the user stops the turn while it runs, a claimed press would be lost. `set_sound` and `strudel_mode` stay the only claimers, so the model answers a `reactions` result with one final call (`set_sound`, or `strudel_mode` while Strudel plays), which marks the presses as read, then calls `listen` again. A database error during the wait ends it as `idle`, never `server_error`. The request's abort signal ends it as `idle` too. The route has `maxDuration = 60`.

Result (compact, empty fields left out): `{ event, waited_s, reactions?, heard?, guests?, players, mode?, notes? }`. A press of "More of this" or "Less of this" reads `more of this (go further in the direction of your last change)` / `less of this (take back part of your last change)` everywhere reactions appear, so a press always asks for an audible change (v0.22.1: "more of this" was read as "keep it"). "What I heard" → Reproach is labelled **Blaming** and reads `blaming`; the stored kind stays `heard_reproach`. `event` is one of `reactions` (what they pressed, as in `set_sound`; `heard` is the owner's "What I heard"), `idle` (deadline reached or aborted), `stopped` (the owner turned Live tuning off during the wait), `mode_changed` (with `mode`, the new mode line), `session_ended`, `nobody_listening`. `notes` carries the "session_id missing" note.

The owner's switch is `settings.live` (default false, "Live tuning" in the player's "Guide the sound"). While it is on, a final `set_sound` or `strudel_mode` in Attuned or Jukebox carries the note "live tuning is on: ... After this final call, call listen ...", because the mode guidance is sent only at the start or on a mode change.

## `get_feedback`

Input: `{ session_id: string }`. Returns the feedback object for the current state without changing anything except claiming reactions. Uses the stored analysis.

## `inspect`

Input: `{ session_id: string, what: "history" | "snapshot" }` (default `history`).
- `history`: the last 8 states as one line each: turn, final, intent mood, reads_as, clamps count, and the note if there was one. Text only.
- `snapshot`: what the owner's player shows and plays. If `settings.image_feedback` is `off`, the error `image_feedback_off` ("The listener turned off picture feedback in the player."). If the player has stored none yet: `{ snapshot: null, why }`. Otherwise an image content block (JPEG: the picture on top, a spectrogram of the last ~10 s of the player's output below, low notes at the bottom) and a text block with `of` ("the current sound", or "an earlier sound: the current one is newer, ask again in about 10 s"), `age_s`, `measured` (`seconds`, `loudness_db`, `peak_db`, `centroid_hz`, `brightness`, `onsets_per_s`, `quiet_share`), `listener_volume` (the owner's slider 0..1, 0 when muted) and a note that the levels are measured after the listener's volume. The base64 appears only in the image block, never in the text or `structuredContent`. The row comes from `put_snapshot` (database.md), read with the caller's token. Returning an image also marks the row seen (`mark_snapshot_seen`, migration 0024: copies `image` to `seen_image` and sets `seen_at`) so the owner's player can show what the model saw; an error there is logged and ignored.

## `moment` (migration 0022)
Input: `{ session_id?, action: "keep" | "recall" | "list" | "save", name?: string /* 1 to 40, trimmed */, transition?: { time, curve } /* recall only, default smooth 6 s */, listener_asked?: boolean /* save only, default false */, final: boolean /* default false */ }`. The model's musical memory: it keeps the sound and picture playing now under a name and brings it back later, in any mode. Stored in `sessions.moments` (database.md); each moment is self-contained: `{ kept_at, turn, effective, intent_mood, analysis, sticky, voice, note }`.

- `keep`: needs a name and a current state (`no_state` otherwise). At most 12 names; a new name when 12 exist is `moments_full` ("Twelve moments are kept. Keep this one under a name you already used to replace it."); an existing name is replaced. Changes nothing that plays. Result `{ kept, turn, moments: [names] }`.
- `recall`: `unknown_moment` lists the kept names. A Strudel moment needs a listener mode (Attuned or Jukebox) and the owner's code switch on, else `strudel_not_here`. A synth moment recalled while Strudel plays replaces it. Same rate limits as `silence` (`too_fast`). It writes a new state: the kept `effective` with this call's transition (no delay) and a fresh grid, through `applyLimits` and the +4 dB level step against the state before (`level held` in `clamped`), intent note `recalled "name"` (it reads in `inspect` history), the kept mood and analysis. The session's `sticky` and `voice` come back too, so the next `set_sound` continues in that voice. It counts as a sound update (`final`, turn, `pending_final`). Result: the normal feedback, claiming the owner's reactions, with the note `recalled "name" (kept at turn N)` and, for a Strudel moment, `pattern` ("not reported yet" until the player runs it).
- `save` (migration 0027, #151): keeps the sound and picture playing now as a keepsake outside the session, with a public link the listener can share. It is frozen: nobody can change the sound afterwards, the model included. Needs a name and a current state (`no_state`). It calls the `save_moment` function with the caller's token (database.md): the state is copied on the server, `p_by` is `human` when `listener_asked` is true and `ai` otherwise, `p_voice_seed` is `voiceSeedOf(session id)` and the app version is the one `tell_developers` sends. It changes nothing that plays and is not a sound update (no turn, no final). The model's own saves are spaced by at least 5 turns. Saving the same moment again writes nothing: the result is the first save, with `already: true` (`by` is that save's author). Result, compact: `{ saved: "name", by: "listener" | "you", url: "https://…/m/<id>" }` plus `already: true` for a repeat (the same base URL as `player_url`). Errors: `nothing_playing` (the sound is silent), `ai_too_soon` ("You saved one on your own less than 5 turns ago. The listener can still save from the player, or ask you to."), `saves_full` (200 for the owner), `too_fast` (10 a minute), `bad_input`. Guidance in every mode: pass `listener_asked: true` when the listener asks; save on your own only when something feels worth keeping; say so in words when you do.
- `list`: `{ moments: [{ name, turn, kept_s_ago, note?, engine }], motifs?: [{ name, notes: "E4 G4 A4", turn }] }` in the order they were kept; `motifs` only when the model has named any (set_sound motif, above).

## `tell_developers` (migration 0021)
Input: `{ session_id?, kind: "bug" | "idea" | "confusion" | "worked", text: string /* 80 to 1000 */, from: "model" | "user" /* default model */ }`. An anonymous note to the people who build this tool, read at the start of a dev session (CLAUDE.md, "Notes from users and models"). It calls RPC `send_dev_feedback` with the caller's token (database.md).

Guardrails:
- Anonymous as far as the note goes: the row has no user, no session and only the day; the per-user daily count is in a separate table that holds no text. The note says "from" the model or the user (`source`), nothing more. Honest limit: with few users, the developers (service role) could match a note to an account by date through the quota table (user, day); every send deletes the counts from before today, so that match is possible only on the day of the note. The per-user limit needs the count and is what keeps one account from flooding the table, so it stays (Gael, 2026-11-21).
- Mode (`self`, `attuned`, `jukebox`) and engine (`synth`, `strudel`) come from the server (the caller's session and its current state), never from the model. No session is needed: without one, both are null. App version is the running release.
- Zod checks the length first; the database checks everything again (kind, source, 80 to 1000 characters after cleaning), strips control characters (newlines and tabs stay) and folds runs of blank lines.
- At most 3 notes per user per day and 50 per day overall; the same text within 7 days is refused (`duplicate`). The text is only ever bound as a parameter, stored as text, and read back by developers as untrusted data.
- Neither table is readable or writable by `anon` or `authenticated`; only the RPC (security definer, `authenticated` only) inserts.

Errors: `too_short` ("Say what happened, what you expected and what would help: at least 80 characters. A note that only says it is good is not sent."), `too_long` ("At most 1000 characters."), `daily_limit` ("Five notes a day at most: keep the rest for tomorrow, or fold it into one note."), `busy` (global limit: "Too many notes today from everyone. Try tomorrow."), `server_error` for anything else.

Result: `{ sent: true, note }`, where `note` tells the model to say in one short sentence that it sent an anonymous note.

## `silence`

Input: `{ session_id: string, fade?: number /* seconds, default 4, max 30 */, final?: boolean, end?: boolean  }`.
With `end: true` the session ends once the fade is over (`ended_at` set, state final). The model uses it when the user says the session is finished, after one `set_sound` that plays a short closing sound with a long transition. Further calls return `session_ended`.
Sets volume 0 and drone off with the given fade (with `end`, the layers stay on and only the volume fades, so the closing sound is not cut; give it a fade of 10 to 30 s). With `end` the state carries `transition.delay`: the time left of the previous state's transition (at most 30 s), so the closing sound plays out before the fade starts; the engine keeps the timing (`Engine.setState(state, seed, delaySec)`), a newer state replaces one that is still waiting. The returned `volume` is 0 at once because it reports the target, not the point in the fade, as a normal state (so it is logged and can be followed by `set_sound`). Returns the feedback object.

## Session resolution
Every tool except `start_session` takes `session_id`.
- If given: load it. If it doesn't exist or the caller isn't the owner, return `{"error":"unknown_session"}`.
- If missing: use the caller's most recently active, non-ended session, and add the note `"session_id missing: used <id>"`. If none exists, return `{"error":"no_session","message":"Call start_session first."}`.

## Rate limits
- At most 20 `set_sound`, `strudel_mode` and `silence` calls together per session per minute (`silence` with `end` is never refused by this count, so a session can always stop), and 1 per 300 ms. Beyond that, return `{"error":"too_fast"}` without storing.
- At most 10 active sessions per user; `start_session` beyond that ends the oldest.

## Tool descriptions (as the model sees them)
- `start_session`: "Start a sound session for this conversation. Returns a session_id to pass to every other call and a player link to give the user."
- `set_sound`: "Update the sound and colour that play to the user. Call it whenever you want during your turn, and always once with final=true at the end of each message. Describe a mood; optionally override synth settings, add one short gesture, or set your own colour. Returns what is actually playing, how it reads, and the listener's reactions."
- `listen`: "Attuned and Jukebox only. Wait up to `seconds` for the listener to press a button in the player and return as soon as they do ... It never changes the sound." (full text in `tools.ts`)
- `get_feedback`: "Read what is playing and the listener's latest reactions without changing the sound."
- `inspect`: "history: the last 8 states as one line each (what you sent, what it read as, clamps, your note). snapshot: what the owner's player shows and plays: one small image (the picture on top, a spectrogram of the last ~10 s of its output below, low notes at the bottom) and the numbers measured from that output. Use it after a big change, or while Strudel plays (it has no reads_as)."
- `moment`: "Your musical memory for this session. keep: give the sound and picture playing now a name ..." (full text in `tools.ts`)
- `tell_developers`: "Send an anonymous note to the people who build this sound channel ..." (full text in `tools.ts`)
- `silence`: "Fade the sound to silence."
