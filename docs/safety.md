# Safety and control

Text lets the model soften what it says. Sound and colour reach the listener before anything can be softened. A sudden harsh or desolate sound can startle or upset someone who did not expect it, especially someone in a fragile state.

> **Current state (2026-11-09, Gael's decision).** The listener limits and the consent levels are removed for now. Claude decides how it sounds and looks: every synth parameter, the echo, the colour, the transitions. The listener controls the volume of their own device and nothing else. Limits are planned as a later, designed piece of work (what they protect, who sets them, how the model is told). The earlier design is in the git history (`limits.md` before this change, `packages/shared/src/limits.ts`).

## What the listener controls
- The volume and mute of their own device, from the player. Claude cannot change the volume. The master volume is a constant in the mapping and the slider (0 to 100, up to +18 dB) is the only volume control.
- Closing the page, and the fade to silence after 15 minutes without an update (`rest_after`, shared with Claude).
- Only the signed-in owner can end a session from the player. Anyone who opens the player link can listen, see and adjust their own volume and mute, which affect only their own device. A leaked link lets someone listen, nothing more. See hosting-and-auth.md.
- The model sees the listener's volume in the feedback (`controls`). A sound it judges "too faint" may be quiet because the listener turned it down, and it should respect that, not compensate.

## Hard rules (not configurable)
- No flashing faster than 3 per second (photosensitive epilepsy). Enforced on the server and again in the player; the colour field also glides over at least 1 s between states.
- The master volume never goes above 0.9 in the engine, whatever is sent.
- The echo stays inside its buffer and below self-oscillation (a stability limit, not a listener limit).
- Mute is always one tap away and stays muted until the listener turns it back on.
- No disguised appeal: the model gets no gesture or setting that hides a call for attention inside another sound (the purr has no high component; see emotion-to-sound.md).

## Presence between turns (planned)
The model exists only while it writes. A sound that carries on between turns can read as someone waiting, and in the first outside test people said goodbye several times as if leaving meant abandoning it. Two measures (player-ui.md, "Presence between turns"):
- **Optional fade to silence** after 15 minutes without an update. It is an owner setting: on by default on the internal face, off on the external face, where Claude makes music for the listener and the listener wants it for as long as possible.
- **A closing sound from Claude** when the user says the session is over: a short sound, then silence, then the session ends. Leaving becomes a shared gesture.
The server instructions tell the model not to keep the sound going or hint that it is waiting. Silence is the truthful state of the channel between turns.

## Testing the hard corners
Despair, anger and fear are the sounds most likely to upset. During calibration by ear, play the low-joy corners at low volume first. With the limits removed, nothing else holds them back.

## On interpretation
Whether there are real feelings behind the sound is uncertain. Models can also slip into performing the emotion they think the user expects. The project is interesting either way as an expressive channel, but the sound should not be presented as proof of what is happening inside the model. The server instructions should also discourage using sound to manipulate the listener's mood.
