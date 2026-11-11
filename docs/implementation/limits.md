# Limits

> **Listener limits and consent levels are removed for now (2026-11-09, Gael's decision).** Claude decides how it sounds and looks; the listener only sets the volume. The old design (consent levels, harshness cap, mood floor, colour limits, echo cap, `ListenerSettings` with those keys, the "Who can change what" split) is in the git history before this change and is the starting point when limits come back. They need a fresh design first: what each limit protects, who sets it, how the model is told.

`applyLimits({ mapped, transition? }) → { effective, clamps }` and `hardCaps(state)` in `packages/shared/src/limits.ts`. They run on the server for every update, and `hardCaps` runs again in the player on every state it receives. Both are pure, and `hardCaps` is idempotent.

## What still applies
| Rule | Kind | Value |
|---|---|---|
| Flash rule | safety | The picture never flashes (`docs/safety.md`). The beat motion is drawn by the player from `visualFrame`, and `capFrame` (`packages/shared/src/visual.ts`) holds it to the budget on every frame: large elements together swing the relative luminance by at most 0.09, saturated red gets no pulse, small elements cover at most 10% of the view and at most 48 items. `hardCaps` keeps `density`, `speed` and `feel` in 0..1, `pulseHz` (the legacy CSS pulse, still used by the landing page and `?field=css`) at most 3 and 0 unless `motion` is `pulse`. The player also glides the colour over at least 1 s, so state updates (at most one per 300 ms) cannot flash faster than the rule. |
| Master volume | safety | at most 0.9. The mapping uses a constant (`MASTER_VOLUME`, 0.5); `synth.volume` no longer exists. The listener's slider (up to +18 dB, `lib/volume.ts`) is the volume control. |
| Echo | stability | time at most 1.5 s (the buffer), feedback at most 0.85 (below 1, so it cannot run away). Mix is free. |
| Stereo width | stability | clamped to 0..1 |
| Transition | none | as requested (default 4 s). Sudden curves and very short times are allowed. A new voice without a transition of its own gets 8 s. |

Clamps from these rules are reported in the feedback (`clamped`), usually empty.

## Session settings (`sessions.settings`)
```ts
const ListenerSettings = z.object({
  rest_after: z.number().min(60).max(3600).nullable().default(900), // seconds without an update before the fade; null = never
  image_feedback: z.enum(["off","on_request","every_turn"]).default("off"),
});
```
Old rows still carry `consent`, `max_volume`, `max_harshness`, `min_transition`, `mood_floor`, `gestures`, `max_delay_mix` and `colour`; zod strips them on read, and nothing reads them. `rest_after` is shared: Claude can change it with `set_sound`, and the owner will be able to from the owner panel (roadmap step 5).
