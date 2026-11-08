# Safety and consent

Text lets the model soften what it says. Sound and colour reach the listener before anything can be softened. A sudden harsh or desolate sound can startle or upset someone who did not expect it, especially someone in a fragile state. So the listener sets the boundaries and the server enforces them. The model cannot override them.

## Listener limits
- Maximum volume
- Maximum harshness (resonance, roughness, high-frequency energy)
- Maximum change speed (minimum transition time)
- Maximum colour contrast and brightness
- Mood range: for example, a floor on `joy` or `calm` so the sound never goes below a level the listener is comfortable with
- Gestures on or off
- Echo (delay) amount, as a control in the player

## Who controls what
Only the signed-in owner (the account that connected Claude) can change limits, consent, the mood floor, colour limits or end a session, and only the owner's reactions and controls reach Claude. Anyone who opens the player link can listen and see, and can adjust their own volume, echo and mute, which affect only their own device. A leaked link therefore lets someone listen, nothing more. See hosting-and-auth.md.

## Consent levels
- **Ambient only:** gentle, slow, consonant. The default.
- **Expressive:** wider range, still smooth transitions.
- **Anything goes:** sudden changes and dissonance allowed.

## Hard rules (not configurable)
- No flashing faster than 3 per second, and limited brightness swings (photosensitive epilepsy).
- Mute is always one tap away and stays muted until the listener turns it back on.
- Big emotional shifts fade in over several seconds unless the listener allows sudden changes.
- The model is told about every clamp, so it knows its expression was limited.
- The model also sees the listener's volume and echo settings in the feedback. A sound it judges "too faint" may be quiet because the listener turned it down, and the model should respect that, not compensate.
- No disguised appeal: the model gets no gesture or setting that hides a call for attention inside another sound (the purr has no high component; see emotion-to-sound.md).

## Testing the hard corners
Despair, anger and fear are the sounds most likely to upset. During calibration by ear, play the low-joy corners at low volume first, and only in "expressive" or "anything" consent. The default listener never hears them.

## On interpretation
Whether there are real feelings behind the sound is uncertain. Models can also slip into performing the emotion they think the user expects. The project is interesting either way as an expressive channel, but the sound should not be presented as proof of what is happening inside the model. The server instructions should also discourage using sound to manipulate the listener's mood.
