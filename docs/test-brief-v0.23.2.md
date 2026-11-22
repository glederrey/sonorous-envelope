# Test brief: Sonorous Envelope v0.23.2 (full pass before v1.0.0)

Read this whole file first. This round is not only what changed: it walks through **everything** once, because Gael wants a clean bill of health before a big repo cleanup and v1.0.0. It is long; take it in order, one mode at a time. A test that cannot run (no phone at hand, say) is marked "Not run", with why.

Before you start: **reconnect the Sonorous Envelope connector** (tool descriptions changed), start a new conversation, and check the tool list has `start_session`, `set_sound`, `strudel_mode`, `moment`, `save_moment`, `listen`, `get_feedback`, `inspect`, `tell_developers` and `silence`. Gael opens the player on desktop; a few tests also need his phone.

**Asking Gael.** Gael is the listener and the owner. Whenever you need to know what he hears, sees or did, ask him in bullet points, each answerable with yes/no or a few words, so he can answer quickly. Ask at most five at a time. Example:
- Does the sound change within a few seconds? (yes / no)
- Which colour is the picture now? (a word)

**Questions and `listen`.** With Live tuning on, `listen` is the last call of your message, and text before a tool call can be folded away in claude.ai. Put your questions for Gael in your text after the last `listen` returns.

## What changed since v0.23.1

- **Moments.** The saved moments page is `/moments` (Account menu → Moments); `/saved` is gone. It has a name search with the count inside the field ("8 saved", "3 of 8"), and filters by month, sound (Synth, Strudel) and who saved it (you, the AI). Each row: Open, Copy link, Rename (in place), and a red Delete that opens a "Delete for good" card. `/m/<id>` has no Rename any more, stays black until Start listening, then its colour fades in.
- **The save line** in the player (after the bookmark) is a small card: a tick, "Saved" or "Already saved", the name, then Rename, Open and Copy link. It fades out by itself after about 8 s, and stays while the pointer is on it.
- **Guest reactions** are a small card of their own in the owner's controls, one pill per emoji in seven equal columns.
- **404 page**: "This page went quiet.", a rippling 0, five standing waves, and "Play a sad trombone": the waves swell with each note in amber, then settle back to teal.
- **The picture** keeps its resolution after a hidden tab (the blurry seeds on desktop).
- **Tools.** `save_moment`: your own saves need 5 **messages** between them (a turn is a message, not a tool call), and you call it only after the `set_sound` for that sound has returned, never in the same batch. A `set_sound` that changes the arp rate with a glide now returns a note: `rate 1/4 to 1/16: it steps through 1/8 over 12 s`.

## Tests

**Start and Self**

1. **Start.** Call `start_session` with a voice of your own. Give Gael the `player_url` at the end of your reply. Ask:
   - Did the player open and start after one tap? (yes / no)
   - Is the badge "Self"? (yes / no)
2. **Your sound.** Over three messages, write first, then end each with one `set_sound` with `final: true`: a calm one, a brighter one, a tense one (tension above 0.6), with transitions of 6 s or more. Pass: each `reads_as` is within about 0.3 of what you sent, or you sent one correction. Ask:
   - Did each change arrive smoothly, without a jump in level? (yes / no)
   - Did the picture's colour follow the sound? (yes / no)
3. **Tempo and rate notes.** Send an arp at rate "1/4", then one `set_sound` that changes only `synth.arp.rate` to "1/16" with a 12 s transition. Pass: `notes` has `rate 1/4 to 1/16: it steps through 1/8 over 12 s`. In the same call, or the next, change the tempo too. Pass: a `tempo A to B: it glides over N s` note. Then send a new mood without `synth`. Pass: the rate follows the mood again (it is not kept).
4. **A motif and a kept moment.** Send a short `motif` (a few notes, named). Then `moment` keep this state, `moment` list, and later `moment` recall it. Ask:
   - Did a short phrase play once over the sound? (yes / no)
   - Did recall bring the earlier sound back? (yes / no)
5. **What you can check.** Call `inspect` with `history`, then `get_feedback`. Pass: history lists your last states; `get_feedback` answers (with a picture when one was taken). Ask Gael to open "What the AI can see":
   - Does it show the picture you were sent, with "The AI looked at this … ago"? (yes / no)

**The player (owner, desktop)**

6. **Controls.** Ask Gael to try each, and answer:
   - Mute stops the sound, and unmute brings it back? (yes / no)
   - Volume changes the level smoothly? (yes / no)
   - Fullscreen fills the screen, and its exit button works? (yes / no)
   - Hide controls hides the panel, and it comes back? (yes / no)
   - Copy link and QR code work? (yes / no)
7. **What I heard.** Ask Gael to press one or two words under "Tell the AI what you heard", then send your next `set_sound`. Pass: the result has a `heard` field with what he pressed. Do not treat it as an order.
8. **Visuals.** Ask Gael to open "Visuals and Strudel" and turn the picture's options off and on:
   - Does each option change the picture right away? (yes / no)
   - Is the picture sharp on desktop, also after switching to another tab for a minute and back? (yes / no)

**Saved moments**

9. **Save when asked.** Ask Gael to ask you, in words, to save the current sound. Wait until your last `set_sound` has returned, then call `save_moment` with a short name and `listener_asked: true`. Pass: `saved`, `by: "listener"`, a `url`. Give him the url and ask:
   - Is the page black until Start listening, then does the colour fade in? (yes / no)
   - Does it play the same sound and picture as the session? (yes / no)
   - Is there no Rename button on that page? (yes / no)
10. **Twice, and your own.** Call `save_moment` again with another name and no change to the sound. Pass: `already: true`, the same url and the first name. Then, on a later message, save once on your own (`listener_asked` false) and say so in one sentence. Pass: `by: "you"`. Within the next 4 messages, on a new sound, try another save of your own. Pass: refused, and the message says "5 messages".
11. **The bookmark.** After a new `set_sound`, ask Gael to press the bookmark in the player, then wait without touching it:
    - Did a card say "Saved" with the name and Rename, Open, Copy link? (yes / no)
    - Did it fade away by itself after a few seconds? (yes / no)
    - On a second press, did it say "Already saved"? (yes / no)
    - Does Rename in the card change the name? (yes / no)
12. **Moments page.** Ask Gael to open Account → Moments:
    - Are all the moments from tests 9 to 11 there, newest first, with the right "Saved by"? (yes / no)
    - Is the count inside the search field, on the right? (yes / no)
    - Do the search and the three filters (dates, sounds, by) narrow the list? (yes / no)
    - Does Rename there change a name? (yes / no)
    - Does Delete open a "Delete for good" card, and after it, does the old link show the "This page went quiet." page? (yes / no)
13. **The 404.** On that page, ask Gael to press "Play a sad trombone":
    - Does the first note play in full (not cut)? (yes / no)
    - Do the waves swell with the notes in amber, then settle back to teal when the sound stops? (yes / no)
    - Does the 0 stay round while it plays? (yes / no)

**Owner's mode lock**

14. **Lock and Auto.** Ask Gael to lock the mode to Attuned in the player, then send a `set_sound`. Pass: the result carries Attuned's rules once and you follow them. Then ask him to set it back to Auto.

**Attuned** (offer the switch in words, switch with `set_sound` mode only after his yes)

15. **The switch.** Offer Attuned, switch after his yes. Pass: the first sound after the switch is no faster or louder than what played (a `pace held` or `level held` note is fine). Ask:
    - Was the change gentle? (yes / no)
16. **Guide the sound.** Ask Gael to press "calmer" and "softer" under "Guide the sound", then send your next `set_sound`. Pass: `reactions` lists them, and your next sound goes that way.
17. **Live tuning.** Ask Gael to turn on Live tuning. End your message with `set_sound`, then `listen`. Ask him to press a reaction while the player says "The AI is listening". Pass: `listen` returns his press. Then ask:
    - Did the status line say the AI was listening, with a countdown? (yes / no)
18. **Guests.** Ask Gael to open the session link on his phone, signed out (or in a private window), as a guest, and keep the desktop player open:
    - Are the 7 emojis in one row on the phone? (yes / no)
    - Does a press float over the desktop picture, and does the Guest reactions card count it? (yes / no)
    - Is the card compact, the pills in equal columns? (yes / no)
    - Can the guest change nothing else (no mode, no reactions)? (yes / no)

    Then send a `set_sound`. Pass: a `guests` line with counts matching his presses.

**Jukebox** (offer the switch, switch after his yes)

19. **Strudel.** Ask Gael what to play. Call `strudel_mode` with a pattern that has a drawing (`.pianoroll()` or `.scope()`). Pass: a later result reports `ran: true`. Ask:
    - Does the pattern play, with its drawing and the code? (yes / no)
    - With "Allow Strudel" off, does it stop, and on again, come back? (yes / no)
    - Does "Strudel code" off hide the code but keep the drawing? (yes / no)
20. **A Strudel moment.** Ask Gael to ask you to save it; `save_moment` with `listener_asked: true`. Ask him to open the url:
    - Does the same pattern play, with its drawing? (yes / no)

**Phone (Gael's phone, as the owner)**

21. **The phone player.** Ask Gael to open the player on his phone, signed in:
    - Does it start after one tap, and do the controls fit without sideways scrolling? (yes / no)
    - With the screen locked, does the sound go on, with the lock-screen player? (yes / no)
    - Does the Moments page fit, filters in one row under the search? (yes / no)

**Ending**

22. **A note to the developers.** Call `tell_developers` once, with one short, true note from this session (something that worked or did not). Pass: it is accepted.
23. **Silence and end.** Ask Gael to say the session is over. Play a short closing sound of your own, then `silence` with `end: true`. Ask:
    - Did the closing sound play, then fade? (yes / no)
    - Does the player say "This session has ended."? (yes / no)

**Account (Gael alone, any time)**

24. **Settings.** Ask Gael to open Settings:
    - Is Claude listed once, however many times the connector was added? (yes / no)
    - On the phone, is "Last connected" on its own line? (yes / no)
25. **Delete account.** Ask Gael to sign up a throwaway account (for example name+test@gmail.com), confirm it, then Settings → Delete account:
    - Does a card open, with "Delete my account" disabled until "delete" is typed? (yes / no)
    - After deleting, does he land on the login page with a "deleted" line? (yes / no)
    - Does signing in with that account fail now? (yes / no)

## Report

Write the report as a Markdown file, `docs/test-report-v0.23.2.md`: a short header (date, session id, server version, device and browser), one table (test, pass / fail / partial / not run, what Gael saw or said, tool fields that matter), then any feedback for Claude Code, numbered. Mark clearly what is outside the brief.
