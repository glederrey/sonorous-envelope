# Limits and consent

`applyLimits(mapped, gesture, colour, transition, settings, previous) → { effective: EngineState, clamps: string[] }` in `packages/shared/src/limits.ts`. Runs on the server for every update. The player re-applies the same function before playing, as a second line of defence (never the only one).

## ListenerSettings (stored in `sessions.settings`)

```ts
const ListenerSettings = z.object({
  consent: z.enum(["ambient","expressive","anything"]).default("ambient"),
  max_volume: unit.default(0.6),
  max_harshness: unit.default(0.5),
  min_transition: z.number().min(0).max(30).default(3),   // seconds
  mood_floor: z.object({ joy: unit.default(0), calm: unit.default(0) }).default({}),
  gestures: z.boolean().default(true),
  rest_after: z.number().min(60).max(3600).nullable().default(300),   // planned: seconds before the sound fades with no update; null = never. Default by mode: inner 300, outer null (player-ui.md)
  max_delay_mix: unit.default(0.4),   // ceiling for the echo (delay mix), applied after the listener's own echo control
  colour: z.object({ enabled: z.boolean().default(true), max_lightness: unit.default(0.5), max_saturation: unit.default(0.7) }).default({}),
  image_feedback: z.enum(["off","on_request","every_turn"]).default("off"),
});
```

## Consent levels
Each level sets ceilings. The listener's own limits apply on top (the stricter wins).

| Rule | ambient | expressive | anything |
|---|---|---|---|
| Transition curve | always smooth | always smooth | sudden allowed |
| Min transition | 4 s | 2 s | 0.3 s |
| Max tempo | 110 BPM | 150 | 200 |
| Max resonance | 4 | 10 | 20 |
| Wave allowed | sine, triangle | + sawtooth | + square |
| Scales allowed | all except locrian, chromatic, phrygian | all except chromatic | all |
| Max LFO amp/tremolo depth | 0.2 | 0.4 | 0.6 |
| Max roughness (`osc.drive`) | 0 | 0.5 | 0.8 |
| Fast amp LFO (rate ≥ 20 Hz) | not allowed (rate capped at 12 Hz) | purr grain only: rate ≤ 28 Hz, depth ≤ 0.3 | up to 80 Hz, depth ≤ 0.6 (growl grain, 30 to 70 Hz, only here) |
| Max density × rate | ≤ 4 notes/s | ≤ 8 notes/s | ≤ 16 notes/s |
| Gestures | purr, hum, breath, chirp, meow_up | all except growl | all (growl included) |
| Mood floor (joy, calm) | 0.2, 0.3 | 0 | 0 |

## Harshness
`harshness ∈ [0,1]` is computed from the mapped state:
`0.3·waveHarsh + 0.2·norm(resonance, 0.7, 12) + 0.2·norm(log cutoff, log 400, log 9000) + 0.1·norm(tempo·rateFactor, 1, 12 notes/s) + 0.2·drive` with `waveHarsh = {sine:0, triangle:0.2, sawtooth:0.7, square:1}`. (The weights sum to 1; roughness took 0.2 from the other terms.)
Planned: an `amp` LFO with rate ≥ 20 Hz is roughness too. It is the same sound as the `growl` gesture (amplitude modulation between 30 and 70 Hz), so it must not be a way to get a growl at a consent level that bars the gesture. It counts as `drive` does: use `rough = max(drive, depth)` in the formula above, and reduce it first (depth to 0, then rate down to 12 Hz) when over `max_harshness`, with a clamp entry.

If above `max_harshness`, reduce in this order until it fits: drive (to 0), cutoff (down, max 1.5 octaves), resonance (down to 0.7), wave (one step softer), note rate (halve). Each step adds a clamp entry. The `growl` gesture counts as harshness 0.7 while it plays and is dropped if that exceeds `max_harshness`.

## Order of operations
0. **Stretch (planned):** each axis goes through `stretch` (mood-mapping.md, "Stretch"). It runs first so the floor below is never lowered by it.
1. **Mood floor:** before mapping, raise `joy` and `calm` to the floor (settings floor and consent floor, whichever is higher). Clamp entry: `"joy 0.1→0.3 (mood floor)"`. (So call `applyMoodFloor` before `moodToEngineState`; `set_sound` step 3 does this.)
2. **Consent ceilings:** tempo, resonance, wave, scale (a disallowed scale is replaced by a fixed fallback: locrian and phrygian → minor, chromatic → pentatonic), LFO depth, note rate, gesture type.
3. **Harshness.**
4. **Volume:** `min(volume, max_volume)`.
5. **Transition:** `time = max(time, min_transition, consent min)`; `curve = "smooth"` unless consent is `anything`.
6. **Big-change rule:** if the mood distance from the previous state (Euclidean over the 5 axes) is > 0.6 and consent isn't `anything`, `time = max(time, 8 s)`. Clamp entry: `"transition 2s→8s (large change)"`.
7. **Echo:** `delay.mix = min(delay.mix · 2·listener_delay, max_delay_mix)`, `delay.time ≤ 0.75 s`, `delay.feedback ≤ 0.6`. `listener_delay` (0 to 1, default 0.5) is the player's echo control, so at the default the mapped mix is unchanged and at 0 there is no echo. The engine applies this itself (`setListenerDelay(amount, max_delay_mix)`); the server only caps the mapped value. Clamp entry only when the cap changes the value.
8. **Gesture:** drop if `gestures` is false or the type isn't allowed. Clamp entry: `"gesture sigh dropped (gestures off)"`. At most 1 gesture per 10 s per session; extra ones are dropped with a clamp entry.
9. **Colour:**
   - `enabled: false` → colour field off (neutral dark background).
   - Clamp lightness and saturation to the listener's max.
   - **Hard rule, not configurable:** pulse frequency ≤ 3 Hz, and lightness swing (peak-to-peak) ≤ 0.2 for any motion faster than 1 Hz. Hue changes glide over at least 1 s.
10. **Absolute safety caps** (never configurable): volume ≤ 0.9, output soft limiter always on, no sub-20 Hz content above −30 dB (high-pass the master at 25 Hz).

## Clamp entries
Short, human-readable, one per adjustment: `"<field> <from>→<to> (<reason>)"`. The model sees them in `clamped`. Max 5 listed; then `"…and N more"`.

## Defaults for a new user
`consent: "ambient", max_volume: 0.6, max_harshness: 0.5, min_transition: 3, gestures: true, image_feedback: "off"`, colour enabled with max lightness 0.5.

**Temporary exception:** while testing, new sessions start at `consent: "anything"` (`NEW_SESSION_CONSENT` in `apps/web/lib/mcp/service.ts`). The schema default stays `"ambient"`: it is what a missing or invalid settings value falls back to. The owner's profile defaults still win. Existing sessions keep the level they were created with. Revert the one constant to go back to ambient; the safety docs describe ambient as the intended default.
