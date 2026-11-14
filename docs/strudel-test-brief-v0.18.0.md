# Test brief: Sonorous Envelope v0.18.0 (the Strudel picture)

Read this whole file first. You test the **picture** of a Strudel session, and the two buttons that control it. You do not test Strudel's sound again.

## What the product is

A remote MCP server that gives an AI model a sound channel: a synthesizer plus a colour field, played in a web page called the player. Tools: start_session, set_sound, get_feedback, inspect, silence, strudel_mode. Strudel is live-coded music the model writes (`strudel_mode`, external face only, after the listener said yes).

## What is new

While Strudel plays, the picture is no longer the scenes. It is the model's **code**, filling the background, with the parts that sound **lit up** as they sound. If the code asks for a drawing (`.pianoroll()`, `.punchcard()`, `.wordfall()`, `.scope()`, `.fscope()`, and the `_` forms), it is drawn behind the code. Two buttons sit side by side, in the style of Gradient and Scenes: **Allow Strudel** (the owner's; it replaces the old checkbox "Let the model play Strudel code") and **Strudel visuals** (each listener's own, on by default, kept on that device).

## Setup

Reconnect the connector, call start_session, give the user the player link. The user opens it on a laptop and a phone (devtools is fine), taps "Start listening", then asks for the external face. Switch to Strudel with `strudel_mode`. Ask the user to watch and listen together. Do not announce what you set. Write real music: drums, a bass line, a melody, at 90 to 120 BPM.

## Tests (record pass, fail or partial, and what the user saw)

1. **The two buttons.** Under Gradient and Scenes there are "Allow Strudel" and "Strudel visuals", side by side, both on. The old checkbox is gone. Pass: both look like Gradient and Scenes; "Allow Strudel" off stops Strudel as before; "Strudel visuals" off brings the scenes back at once, on again brings the code back; after a reload the choice is remembered. Open the same session in a private window (not the owner): only "Strudel visuals" shows, and only while a pattern plays.
2. **Code and lighting.** Send a stack of drums, bass and melody written over several lines with mini-notation (`s("bd*2 [~ sd]")`, `note("<c2 g2>")`). Pass: the code fills the background in a monospace face, coloured by kind (comments, strings, numbers, methods); the atoms (`bd`, `sd`, notes) light up **on the beat** and fade just after. Look for any lag: with the Picture delay slider at 0, the light should land with the sound.
3. **Colours.** Use `.color("cyan")` on one voice and `.color("magenta")` on another. Pass: their atoms light in those colours; a voice without a colour lights in the hue of your colour field (change the colour with `strudel_mode`'s `colour` and see the hue follow).
4. **Drawings.** Ask for each in turn, with real notes: `.pianoroll({ labels: 1 })`, `.punchcard()`, `.wordfall()`, `.scope()`, `.fscope()`. Pass: each draws behind the code and moves with the music, the code stays readable, and a drawing with a `.color()` uses that colour.
5. **Lanes.** `._pianoroll()` and `._scope()` together. Pass: they sit in bands along the bottom, one each, and do not cover the code.
6. **Fades.** (a) `silence`: the code and drawings fade out with the sound, over the same time as the scenes would. (b) The owner turns "Allow Strudel" off: the picture fades over about 3 seconds and the scenes do not flash in. (c) Start Strudel again from silence: the picture comes in on the same bar as the music, not before. (d) Switch back to the synth with `strudel_mode` on false: the code view fades out and the scenes return.
7. **Long and wide code.** Send the longest code you can (about 4000 characters) and a very wide line. Pass: it is set smaller and clipped at the bottom, nothing spills over the controls or scrolls the page, on the phone too.
8. **Not available.** Send `.pitchwheel()`, `.spiral()`, `.spectrum()` and `.markcss('...')`. Pass: the music plays; `get_feedback` notes them as not available.
9. **Reduced motion.** Turn on the system's "reduce motion". Pass: the picture is as before (no Strudel view).

## Still open, not for this round

`players` with a real second device, the guest "Add to your AI" button, `reads_as` joy, Safari (the sandboxed worker and the new `AnalyserNode` tap are not checked on a Mac or iPhone).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code. There is also a lab with no session at `/dev/strudel` (presets for each drawing, tempo and hue) if you want to look at a drawing without a session.
