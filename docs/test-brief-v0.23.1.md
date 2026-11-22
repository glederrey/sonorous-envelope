# Test brief: Sonorous Envelope v0.23.1 (covers v0.23.0 and v0.23.1)

Read this whole file first. v0.23.0 adds saved moments, guest emoji reactions, an Account menu with Delete account, a stepped arp rate during a glide, and a recalibrated roughness (tension). v0.23.1 moves saving into its own tool, `save_moment`, and tidies Settings and the save line from Gael's look at v0.23.0. Gael already checked the Account menu and Settings: they are not tested here. Only what changed is tested.

Before you start: **reconnect the Sonorous Envelope connector** (there is a new tool, `save_moment`, and `moment` no longer has a `save` action). Start a new conversation and a new session. Gael opens the player on desktop; test 6 also needs his phone.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Example:
- Does the saved page play the same sound as the session did? (yes / no)
- How many emojis are in the row on your phone? (a number)

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns.

## What changed

- **Saved moments.** A saved moment is the sound and picture playing now, frozen, with its own public link `/m/<id>` (the same page for everyone). The owner saves with the bookmark button in the player's controls (left of Fullscreen); you save with `save_moment` (`name`, and `listener_asked: true` when Gael asks). Your own saves (without `listener_asked`) need at least 5 turns between them (`ai_too_soon`). Saving what is already saved writes nothing and returns the first save with `already: true`. Limits: 10 saves a minute, 200 per account.
- **After a press of the bookmark**, a line shows "Saved as “name”" then "Rename · Open · Copy link" (Rename edits the name in place); a second press on the same sound says "Already saved as …". The automatic name is "session title · HH:MM".
- **`/m/<id>`**: Start, Mute, Volume, Copy link, and a QR code on desktop only; the owner can rename there. **`/saved`** (Account menu → Saved): the owner's moments, newest first, with a name search, a month filter, Open, Copy link, Rename and Delete.
- **Guest emojis.** Anyone on the session link who is not the owner gets a row of 7 emojis (👍 👎 ❤️ 😊 🙁 😢 😭). Each press floats over the owner's picture (also in fullscreen), with a count line. Limits: 1 press per 2 s and 10 a minute per device, 60 a minute per session; past that the guest sees a slow-down line. You see them as one `guests` line with counts in your next feedback; a guest press alone never ends `listen`.
- **Arp rate glide.** When the arp rate changes with a transition, it steps through the rates in between (1/4 → 1/8 → 1/16), on bar lines when a bar fits, else on beats.
- **Roughness.** `reads_as` tension is recalibrated: a calm drone reads calm (about 0.2 to 0.35), a tense sound reads clearly higher.

## Tests

**Self**

1. **Save when asked.** Play a sound you like. Ask Gael to ask you, in words, to save it. Call `save_moment` with a short name and `listener_asked: true`. Pass: the result has `saved`, `by: "listener"` and a `url`. Give Gael the url and ask:
   - Does the page play the same sound and picture as the session did? (yes / no)
   - Does it show Start, Mute, Volume, Copy link and a QR code? (yes / no)
   - Does Rename on that page change the name? (yes / no)
2. **The same moment twice.** Without changing the sound, call `save_moment` again with another name. Pass: `already: true`, the same `url`, the first name.
3. **The bookmark.** Change the sound (a new `set_sound`). Ask Gael to press the bookmark in the player, then Rename in the line under the controls, then the bookmark again. Ask:
   - Did the line say "Saved as …" with Rename, Open and Copy link? (yes / no)
   - Did Rename change the name in that line? (yes / no)
   - Did the second press say "Already saved as …"? (yes / no)
4. **Your own save.** Over the next turns, save once on your own when something feels worth keeping (`listener_asked` false), and say so in one sentence. Then, within 4 turns, try a second save of your own on a new sound. Pass: the first returns `by: "you"`; the second is refused with `ai_too_soon`.
5. **Saved.** Ask Gael to open Account → Saved:
   - Are the moments from tests 1, 3 and 4 there, with "Saved by you" / "Saved by the AI" right? (yes / no)
   - Does typing part of a name in the search keep only the matching ones? (yes / no)
   - Does Delete on one remove it, and does its link then say not found? (yes / no)

**Attuned** (offer the switch, switch after his yes)

6. **Guest emojis.** Ask Gael to open the session link on his phone signed out (or in a private window), as a guest, and keep the desktop player open. Ask:
   - Are the 7 emojis in one row on the phone? (yes / no)
   - Does a press float over the picture on the desktop, and does the count line update? (yes / no)
   - In fullscreen on the desktop, do presses still float? (yes / no)
   - After many fast presses, does the phone show a slow-down line? (yes / no)

   Then send a `set_sound`. Pass: the feedback has a `guests` line with counts that match what Gael pressed.
7. **Arp rate glide.** Play an arp at rate "1/4", then one `set_sound` that changes only `arp.rate` to "1/16" with a 12 s transition. Ask Gael:
   - Did the arp speed up in steps (slow, then medium, then fast) rather than at once? (yes / no)
   - Did any step stumble or drop notes? (yes / no)
8. **Tension reads.** Play a calm drone (low tension, high calm), then a tense sound (high tension). Pass: `reads_as` tension about 0.35 or less for the drone, and clearly higher for the tense sound. No need to ask Gael.

**Jukebox** (switch after his yes)

9. **A Strudel moment.** Start a Strudel pattern with a drawing. Call `save_moment` with `listener_asked: true` after Gael asks. Ask Gael to open the url:
   - Does the same pattern play, with its drawing? (yes / no)

**Account (Gael alone, any time)**

10. **Delete account.** Ask Gael to sign up a throwaway account (another email, for example name+test@gmail.com), confirm it, then Settings → Delete account. Ask:
    - Did the card stay disabled until "delete" was typed? (yes / no)
    - After deleting, did he land on the login page with a "deleted" line? (yes / no)
    - Does signing in with that account fail now? (yes / no)

## Report

Write the report as a Markdown file, `docs/test-report-v0.23.1.md`: a short header (date, session id, device and browser), one table (test, pass/fail/partial, what Gael saw or said), then any feedback for Claude Code, numbered.
