# Test brief: Sonorous Envelope v0.17.3 (only what is still open)

Read this whole file before you start. Everything that passed in the v0.17.2 report (end of session and mood changes D17, aurora on a dark base, fire, smoke on a dark base, motes, leaves, the 14 mood scenes, `follow` plus a scene) is **not** tested again. Test only the items below. You are testing the picture; the sound is not the subject.

## What the product is

A remote MCP server that gives an AI model a sound channel: a synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. On the internal face (default) the sound and picture are how the model feels, and the model says nothing about them unless asked.

## Setup

Reconnect the connector, call start_session, give the user the player link. The user opens it on a laptop and a phone (devtools is fine) and taps "Start listening". Ask the user to watch, not to listen. Do not announce what you set.

## Tests (record pass, fail or partial, and what the user saw)

1. **Aurora, no thin lines.** Scene `aurora`, dark base and the awe mood. Pass: only soft diffused streaks, no thin hard-edged lines inside the curtains.
2. **Smoke and clouds on a bright base.** Bright yellow (hue 55, saturation 0.9, lightness 0.75): scene `smoke`, then `clouds`. Pass: the screen does not get brighter, the smoke and the clouds are clearly visible against a darkened base.
3. **Pale colours on the bright base.** Same yellow: `fireflies` and `fireworks`, with pale colours (high lightness, low saturation) as well as blue ones. Pass: the pale ones show too.
4. **Caustics at full laptop size.** Pass: no line shows stair-stepping, no stutter.
5. **Digital rain on the phone.** Pass: columns cover the whole width, left to right, at density 0.5 and at density 1.
6. **Fireworks speed.** Speed 0.1 against 1. Pass: the rockets going up are clearly slower at 0.1 (the sparks already were).
7. **Warp with `sync: "phrase"`.** Use `strudel_mode` at 110 BPM or a `set_sound` at 110 BPM with `sync: "phrase"` on the colour. Pass: the middle blob swells slowly over about 4 bars (about 8.7 s) instead of on every beat, and a ring takes about 4 bars. Also say whether `sync: "beat"` still pulses on the beat.
8. **Footer.** Look at the footer on laptop and phone. Pass: the version has the same colour as the other links and links to the release; there is a dot between the "Made by" icons and Privacy on the laptop (on the phone they sit on two rows, no dot).

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button (both need a second device or a guest session; test them only if the user has one), and `reads_as` joy.

## Report

Same format as before: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
