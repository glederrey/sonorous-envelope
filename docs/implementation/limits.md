# Limits

Sound and colour reach the listener before anything can be softened. A sudden harsh or desolate sound can startle someone who did not expect it, especially someone in a fragile state. Even so, **Claude decides how it sounds and looks**: every synth parameter, the echo, the colour, the transitions. The listener sets the volume of their own device and nothing else. Listener limits and consent levels were removed on 2026-11-09 (Gael's decision). They need a fresh design first (what each limit protects, who sets it, how the model is told); the old one is in the git history and is the starting point.

`applyLimits({ mapped, transition? }) → { effective, clamps }` and `hardCaps(state)` in `packages/shared/src/limits.ts`. They run on the server for every update, and `hardCaps` runs again in the player on every state it receives. Both are pure, and `hardCaps` is idempotent.

## What the listener controls
- The volume and mute of their own device, from the player. The slider (0 to 100, up to +18 dB, `lib/volume.ts`) is the volume control, and mute stays muted until the listener turns it back on.
- Closing the page.
- Only the signed-in owner can end a session or change its settings. Anyone with the player link can listen, see, and set their own volume and mute, which affect only their own device. A leaked link lets someone listen, nothing more (auth.md, "Owner and listeners").
- The model sees the owner's volume in the feedback (`controls`). A sound it judges "too faint" may be quiet because the listener turned it down, and it should respect that, not compensate.

## What still applies
| Rule | Kind | Value |
|---|---|---|
| Master volume | safety | (synth only) at most 0.9, and Claude cannot set it. The mapping uses a constant (`MASTER_VOLUME`, 0.5); `synth.volume` no longer exists. The listener's level (#170, mood-mapping.md) only lowers it, at most 12 dB; `hardCaps` keeps `listenerDb` between -12 and 0. The player multiplies the synth's listener gain by a fixed makeup (`SYNTH_MAKEUP`, 2.5) so the synth and Strudel sit at a similar level; it is not the state's volume, which stays at most 0.9. |
| Strudel | none | Outside the sound limits (Gael, 2026-11-11): no loudness limit, no parameter clamps, so the pattern sounds as it does on strudel.cc. Only the listener's slider and mute apply. What stays is isolation: the model's code runs in a sandboxed frame with no access to the page, the login session, storage or the network. The owner can switch Strudel off, and a lock to Self stops it ([strudel.md](strudel.md)). |
| Flash rule | none | Lifted for the large elements (Gael, 2026-11-13: "remove the flash rule, it won't happen"). Nothing scales the wash, the glow or the layers down to a luminance swing, and saturated red is not special-cased. `MAX_LARGE_SWING` (0.09) and `largeSwing` remain as the old target and a measure; the beat pulse is still designed small. A design that would flash a large area fast is the owner's call, not an enforced limit. |
| Small elements | safety | `capFrame` (`packages/shared/src/visual.ts`) holds motes, rings and streaks together to at most 10% of the view and 400 items. A change of scene is a crossfade of at least 1.5 s, except after a silence: the old scene is only what was fading out with the sound, so it finishes in 0.6 s and never shows under the new one. |
| Pulse | safety | The old 3 Hz cap stays only on `pulseHz`, the legacy CSS pulse (the fallback field and the landing page). |
| Reduced motion | accessibility | `prefers-reduced-motion` turns the moving picture off. The player has "Gradient" and "Scenes" buttons (both off: the base colour only). |
| Update rate | stability | At most 20 updates a minute and 300 ms between two (`turn.ts`). |
| Echo | stability | time at most 1.5 s (the buffer), feedback at most 0.85 (below 1, so it cannot run away). Mix is free. |
| Stereo width | stability | clamped to 0..1 |
| Transition | none | as requested (default 4 s). Sudden curves and very short times are allowed. A new voice without a transition of its own gets 8 s. |

Clamps from these rules are reported in the feedback (`clamped`), usually empty.

The model gets no gesture or setting that hides a call for attention inside another sound. The server instructions say so ([server-instructions.md](server-instructions.md)).

## Session settings (`sessions.settings`)
```ts
const ListenerSettings = z.object({
  rest_after: z.number().min(60).max(3600).nullable().default(900), // ignored: the sound never fades by itself
  image_feedback: z.enum(["off","on_request","every_turn"]).default("on_request"), // the owner's "Let the AI see the picture"; every_turn is not built
  live: z.boolean().default(false), // the owner's "Live tuning" switch (Attuned and Jukebox)
});
```
Old rows still carry `consent`, `max_volume`, `max_harshness`, `min_transition`, `mood_floor`, `gestures`, `max_delay_mix`, `colour` and `rest_after`; zod strips or ignores them. The sound never fades by itself in any mode (Gael, 2026-11-21: "It always plays until the user closes the tabs or ends the session"): `effectiveRestAfter` returns null, `set_sound` and `strudel_mode` take no `rest_after`, and the player has no fade control.

## Testing the hard corners
Despair, anger and fear are the sounds most likely to upset. During calibration by ear, play the low-joy corners at low volume first. Nothing else holds them back.

## On interpretation
Whether there are real feelings behind the sound is uncertain. Models can also slip into performing the emotion they think the user expects. The project is interesting either way as an expressive channel, but the sound should not be presented as proof of what is happening inside the model.
