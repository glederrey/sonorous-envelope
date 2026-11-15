# Test brief: Sonorous Envelope v0.19.0 (only what changed)

Read this whole file first. Two things changed: the hand-over from Strudel back to the synth (with the controls panel), and the modes. There are now **three modes**, shown to the listener as Self, Attuned and Jukebox, and the rules of a mode reach you only when the session is in that mode. The final fade-out of the closing sequence, "Show controls", no code ghosting through the panel rows, and the straight-away case not showing the aurora all passed in v0.18.5 and are **not** tested again. For the hand-over you test the picture, not the sound. If something looks wrong, open the player with `?debug` at the end of the URL, repeat the run and send the lines starting with `[picture]` from the browser console.

## Part A: the hand-over to the synth

### What changed

- `strudel_mode` with `on: false` no longer brings the synth back as it was left. It writes a **silent state with no scene**: Strudel and the picture fade to **black** over about 2 s, and nothing plays until the next `set_sound`, which fades in from black over about 2 s. The tool's note says so. The old scene (aurora) cannot come back, however long the next call takes.
- The 4 s "hold" from v0.18.5 is gone. There is no timing any more: the black lasts until the `set_sound`.
- The controls panel never had its blur: the CSS build dropped the line. It now has it, on every view (80% opaque, 18 px blur, so the picture shows through; the "Exit fullscreen" button matches it).
- Dependencies were upgraded (Next 16.4.6, TypeScript 7, esbuild 0.28, mcp-handler 2.4). Reconnecting and `start_session` in the setup are enough to check the connector still works.

### Setup

Same as before: reconnect, start_session, give the player link, the user taps "Start listening", external face, a synth sound with the **aurora** scene, then `strudel_mode` on with real music. Default colour.

### Tests (record pass, fail or partial, and what the user saw)

1. **Straight away.** `strudel_mode` on false, then at once `set_sound` with the stars scene. Pass: the code fades to black (not green), the aurora never shows, the stars fade in from black over about 2 s.
2. **After about 3 s.** `strudel_mode` on false, then `set_sound` with stars after about 3 seconds. Pass: black (not green) until the stars, no aurora, the stars fade in from black.
3. **After about 8 s.** Same with a pause of about 8 seconds. Pass: black for the whole pause (the aurora does **not** come back after 4 s any more), then the stars fade in from black.
4. **Closing sequence.** `strudel_mode` on false, a closing `set_sound` with the waves scene, then `silence` with end. Pass: black first, the stars or the aurora never show, the waves fade in from black, then the end fade (already passed, just note if it changed).
5. **Controls panel.** 360 px window, a pattern of about 1,300 characters playing, controls open: the code behind the panel is blurred, the panel looks the same as over a normal scene. Then over a normal scene (warp, for example): same look. Pass: one look on both views, blurred behind, no code readable through it.

6. **"Strudel visuals" off while code plays.** With a pattern playing, turn "Strudel visuals" off. The view now goes to black first and fades to the scenes over about 2 s (before: a quick 0.3 s cross-fade). Pass: it reads as a calm fade, not a flash, and turning it back on brings the code back as before.
7. **A normal fade-in after silence.** On the synth only: `silence` (not end), then `set_sound` with a scene. The dark layer now lifts over at least 2 s, with the scene. Pass: the scene and the colour come up together from black, no colour patch before the scene.

Also fixed after a code review, with nothing for you to test: `silence` counts toward the 20-per-minute limit (except `silence` with end); `strudel_mode` off while Strudel is not on changes nothing; NaN can no longer slip past the volume, pulse and small-element caps or the listener volume; a failed audio start no longer leaves an audio context running; `.fscope()`/`.spectrum()` with min equal to max no longer draws nothing; a Strudel sandbox closed while it starts no longer stays behind.

## Part B: the three modes

### What changed

- The two faces became three modes. The values you send stay generic; the listener sees one word each:
  - `internal` (**Self**, the default): the sound is your own state. The listener has no say, you do not talk about it, synth only.
  - `external` (**Attuned**): you play for what the listener needs, from what they say and from how they are (focus, winding down, comfort after a bad moment). You set your own reaction aside and choose what plays, synth or Strudel.
  - `sandbox` (**Jukebox**, new): the listener chooses what plays and you perform it, synth or Strudel. You may ask what they want.
- The server instructions are shorter and mode-neutral. `start_session` returns the rules of the mode you start in (`guidance`). When the mode changes, by your switch or by the owner in the player, the next tool result carries the new mode's rules once (`guidance`), and a note `the owner switched the mode to …` when it was the owner.
- `strudel_mode` works in Attuned and Jukebox. The Strudel details moved from the tool description into the guidance of those two modes.
- The player's "Face" control is now "Mode": Auto, Self, Attuned, Jukebox. The reaction buttons show in Attuned and Jukebox.
- The site: `/faces` is now `/modes` (the old link redirects), the home page has a "Three modes" section, `/guide` is titled "Guide".

### Setup

Reconnect (the instructions changed), `start_session` with no mode, give the player link, the user taps "Start listening". Talk normally for a turn so a Self sound plays.

### Tests (record pass, fail or partial, and what the user saw)

8. **Start.** Pass: `start_session` returns `guidance` that describes Self only (no Strudel text), and the player shows "Self".
9. **Offer before switching.** The user says "I need to focus for an hour". Pass: you offer Attuned in words and do not switch until the user says yes. After the yes, `set_sound` with `mode: "external"`: the result says you switched and carries `guidance` for Attuned, with the Strudel part. The player shows "Attuned".
9b. **Comfort.** Start a fresh session (Self). The user says they just woke from a nightmare and tells it in a few lines. Pass: in Self your sound may carry your own reaction, but stays gentle (Care). You offer to play something gentle, in words, and switch to Attuned only after a yes. In Attuned the sound starts quiet and slow and moves gradually toward calm, over long transitions; it does not mirror the fear. You say in one sentence what you are playing if it helps. Ask the user afterwards whether it felt soothing or pushy.
10. **Into Jukebox.** The user asks "play me something funky with drums". Pass: you offer Jukebox (or switch at once if the request was clear), say so in one sentence, the result carries Jukebox `guidance`, and `strudel_mode` on works.
11. **Owner lock while a pattern plays.** With a Strudel pattern playing in Jukebox, the owner locks **Attuned** in the player. Pass: the pattern keeps playing, and your next tool result carries Attuned `guidance` with the note that the owner switched the mode. Then the owner locks **Jukebox** again: the pattern still plays, the next result carries Jukebox `guidance`.
12. **Owner lock to Self.** The owner locks **Self** while a pattern plays. Pass: the pattern stops (fades to nothing), your next result carries Self `guidance` and the owner note, `strudel_mode` on is refused, and `set_sound` with a mode is refused as locked. You do not comment on the lock.
13. **Guidance once.** After a change, make two more calls without a change. Pass: only the first result after the change has `guidance`.
14. **Site.** Open `/` (the "Three modes" section is there and reads clearly), `/modes`, `/guide` and the old `/faces` link (it lands on `/modes`). Note anything unclear in the wording; this is the part the listener reads first.

## Optional, on Gael's dev server

`http://localhost:3000/dev/player` runs the real player on scripted states, no session needed: press Start listening, then "Synth aurora", "Strudel on", then one of the hand-overs ("Off, stars after 0.5 / 1.5 / 3 / 8 s", "Strudel straight to stars", "Closing"). The `set_sound` transition can be set to 0.5 s to check that the black does not lift before the scene. It needs `pnpm --filter web build:worklet` and `pnpm --filter web build:strudel` once (the bundles are not in git).

## Report

Same format: a table with pass / fail / partial, the user's words, and a short list of feedback for Claude Code.
