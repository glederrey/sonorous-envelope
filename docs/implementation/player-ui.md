# Player and web app UI

Visual design (colours, type, components, logo): follow the [Sonorous Envelope design system](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY) (summary in [design-system.md](../design-system.md)).


> **No fade (2026-11-21, Gael: "It always plays until the user closes the tabs or ends the session").** The sound never fades by itself in any mode: `effectiveRestAfter` returns null, `set_sound` and `strudel_mode` no longer take `rest_after` (an old client sending it is ignored), `start_session` returns no `settings`, `resting` never appears, and the player has no "Fade to silence after" control. A stored `settings.rest_after` is ignored. The text below about the fade is history.

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page: the idea, how it works, how to add the connector in claude.ai, why the player page must stay open (see below) | public |
| `/how-it-works` | How it works (the nav label and the h1): what to say, good to know, the synth and Strudel, one line per tool. Update it when a tool ships. `/guide` redirects here (308) | public |
| `/modes` | The three modes (Self, Attuned, Jukebox): who decides what plays, who switches, where the idea comes from (Anzieu), reading. `/faces` redirects here (308) | public |
| `/login` | Email magic link (Google/GitHub optional), supports `?next=`. Only the person who connects Claude needs it | public |
| `/oauth/consent` | OAuth consent (auth.md) | login |
| `/sessions` | The user's sessions: title, created, last active, turns, open / end / delete | login |
| `/saved` | The user's saved moments, newest first (up to 200), with a name search and three filters: month ("All dates" or a month that has moments), sound ("All sounds", Synth, Strudel) and who saved ("By anyone", "By you", "By the AI"); filtered in the browser, "N of M" shown. Each row: Open, Copy link, Rename (an inline form) and a red Delete that opens a centred confirm card ("Delete “name” for good?", saying its link then answers with the not-found page, 404; Cancel, Delete for good; nothing to type); on a phone the four buttons sit two by two. Empty: "Nothing saved yet. Press the bookmark in a session's controls, or ask your AI to save the moment." The account menu lists it between Sessions and Settings | login |
| `/m/[id]` | A saved moment (see below). Opens for anyone with the link, no account. The signed-in owner can rename it | link only |
| `/s/[id]` | The player. Opens for anyone with the link, no account. Signed-in viewers also get the share link; everyone else gets a link to add the connector | link only |
| `/s/[id]/details` | History: states, intent vs reads_as, clamps, reactions, notes | link only (members) |
| `/settings` | Connected apps (OAuth grants grouped per app, one Revoke each) and Delete account (auth.md) | login |
| any unknown path (`app/not-found.tsx`) | The 404, "This page went quiet.": the 0 of 404 is a teal ring with ripples, a flat line with one blip passing, "Back to the start" and "Play a sad trombone" (four falling notes in Web Audio, peak gain 0.12, only on a press; the ring turns amber and droops while it plays). Also what a deleted `/m/<id>` shows. No motion under reduced motion | - |
| `/dev/mood` | Five sliders → live mapped sound; for tuning (dev builds only) | login |

## The landing page (`/`)

The first page anyone sees, before signing in. It explains the idea, how it works, and how to set it up. One long page, read top to bottom, works on a phone. Signed-in visitors see the same page with "Your sessions" in the header instead of "Sign in".

### 1. Hero
- Logo lockup (mark + wordmark) top left; "Sign in" or "Your sessions" top right.
- Headline in `display`: "Let the AI hum while it thinks." One line under it in `body`: "Sonorous Envelope gives Claude a second voice: a small synthesizer and a colour field you hear and see while it works."
- Two actions: "Add to Claude" (primary, scrolls to the setup section) and "How it works" (secondary).
- Behind the hero: a live, muted-by-default colour field drifting slowly (idle `field-a` → `field-b`, then a few preset moods gliding over ~8 s each). It respects `prefers-reduced-motion` and the old 3 Hz CSS rule (it does not use the canvas). An optional "Play a sample" button plays a short local demo state through the engine (tap required, volume capped low, stops on its own after 20 s).

### 2. The idea
Three short paragraphs, adapted from the README:
- Text is the only channel a language model normally has. This adds a second one that is ambient and non-verbal.
- During each turn the model describes a mood (warmth, closeness, joy, calm, spontaneity). Your browser turns it into a slow, living loop of sound and colour, and glides from one state to the next.
- The name: in synthesis the envelope is the shape a sound takes over time; in psychoanalysis Anzieu's "sonorous envelope" is the bath of sound that holds a person before words. A one-line caveat from safety.md: the sound is an expressive channel, not proof of what the model feels.

### 3. How it works
Four steps, each with a small icon and two lines of text (a horizontal row on desktop, stacked on mobile):
1. **Claude sets a mood.** While it works, and at the end of every message, it calls the connector with a mood and, optionally, exact sounds, short gestures and colour.
2. **Your browser plays it.** The player page renders the sound and the colour field live and glides between states.
3. **Claude hears back.** It gets what was really played: the settings after your limits, how the sound reads on the same mood axes, and your reactions.
4. **You stay in control of the volume.** Volume and one-tap mute (limits and reaction buttons come later). Claude decides the rest and cannot change the volume.

### 4. Add it to Claude
Numbered steps with the connector URL in a `CopyField` (`${PUBLIC_BASE_URL}/api/mcp`):
1. Open **Settings → Customize → Connectors**, then choose **Add** and **Add custom connector** (checked against claude.ai, Nov 2026).
2. Name it "Sonorous Envelope", paste the URL above into **MCP server URL**, and choose **Continue**.
3. Choose **Connect**: you are sent here to sign in and approve access (OAuth). Once approved you are back in Claude.
4. In a new conversation, turn the connector on from the **+** menu in the message box. Claude starts a session and gives you a link to your player page.
5. Open the link and tap **Start listening**.

Notes under the steps, in `body-sm`:
- The connector added on claude.ai also works in the Claude desktop and mobile apps on the same account.
- Each conversation gets its own session. Turn the connector on at the start of the conversation.
- Custom connectors may depend on your Claude plan, and the menu names above can change: check them against claude.ai before launch and keep this section current (CLAUDE.md "Things to verify").

### 5. Keep the player page open
A highlighted block (scrim-style panel on the colour field, not a warning colour):
- **The sound plays in the player page, not in Claude.** Keep that page open for the whole conversation. Closing it stops the sound, and Claude stops getting your reactions.
- Best setup: player on one device or window (laptop, tablet, or a speaker-connected computer), chat on another.
- On a phone: the sound keeps playing when you switch to the chat (keep-alive audio file and a worker ticker, mobile.md). If the phone stops it, open the player and tap resume. (Corrected 2026-11-09: this used to say to keep the player in the foreground with the screen on.)
- If the page was closed, reopen the link from the conversation or from "Your sessions": it picks up the current state.

### 6. Safety page removed
The public `/safety` page was removed on 2026-11-13 (Gael: it read as more alarming than useful). The design notes stay in `docs/safety.md`; nothing on the site links to them.

### 7. Footer
GitHub link, "Your sessions", "Settings".

### Acceptance
- Readable and complete without JavaScript, except the live field and the sample.
- No audio before a tap. The sample never exceeds the default `max_volume`.
- Connector URL copies with one tap and is built from `PUBLIC_BASE_URL`.
- Lighthouse accessibility ≥ 95; text contrast follows the design system.

## The player page (`/s/[id]`)

The page is mostly the colour field, full screen. Controls sit in a slim bar that fades when idle and returns on any tap or mouse move. The page must be usable one-handed on a phone.

### First load
- Dark background, a single large button: "Start listening". Browsers need a tap before audio. On tap: create the `AudioContext`, load the worklet, apply the current state, start heartbeats with `audio: "playing"`.
- If the session has ended: show "This session has ended" and a link to `/sessions`.

### Always visible
- **Mute** (one tap, large target). Stays muted until unmuted, including across reloads (remember in `localStorage` per session, wrapped in try/catch).
- **Volume slider** (local gain, shown 0 to 100, decibels underneath: `apps/web/lib/volume.ts`). Equal steps are equal dB, 80 is the sound as mapped (unity), 100 is +18 dB (steeper above 80: 90 dB per unit, 60 below), 0 is silence. The engine's soft limiter keeps the boost from clipping. The value reported to the model as `controls.volume` is the slider position.
- **No echo slider** (removed 2026-11-09): the echo is Claude's. The volume slider is the only listener control.
- **Status:** "Listening · turn 12 · last change 4 s ago", and a small dot when the model is mid-turn (last state non-final and < 20 s old).

### Reaction buttons
Built (2026-11-10), owner only, and only in the listener modes, Attuned and Jukebox (Self is how the model feels, so nobody steers it): calmer, stormier, softer, harsher, darker, brighter, slower, faster, more of this, less of this (`packages/shared/src/reactions.ts`, `owner-controls.tsx`). Every press counts (no lock); the pending ones show as "Waiting for the AI: calmer ×2. It reads them on its next message" (the block is titled "Guide the sound"; it says "the AI" because other models use the connector too) until the model has read them (the server cannot push to the model: it reads them on its next `set_sound`). `set_sound` claims the pending ones with `claim_reactions` and returns them as `reactions` ("calmer x2, 30 s ago"), once; `get_feedback` shows them without claiming.

**Guest emojis (#152, migration 0028).** Everyone who is not the owner (link listeners with no account, and signed-in strangers) gets a "React" row in the controls, in every mode: seven 44 px emoji buttons (thumbs up, thumbs down, heart, happy, unhappy, sad, crying; `GUEST_EMOJIS` in shared, with the label as `aria-label`). A press calls `send_emoji` and floats the emoji once on the guest's own picture; the row is disabled for 2 s (the server's per-device cap), and "Slow down a little." shows for 3 s when the server says `slow_down`. The row is hidden in fullscreen with the rest of the panel. The owner has no such row (they keep their reaction buttons). The owner's player listens for the `emoji` broadcast (realtime.md) and floats each glyph over the picture: a layer in the stage (`.pl-emojis`, fixed to the picture's box, `pointer-events: none`, above the panel and below the fullscreen exit button), each emoji rising about 40% of the height over 3 s from a random x, at most 12 at once (more are dropped); with `prefers-reduced-motion` it fades in place. It shows in fullscreen too. A card of its own, "Guest reactions" with "N in the last 30 min", sits between Volume and Mode in the owner's controls: one tile per emoji pressed (the glyph at 24 px, its count under it, most pressed first, up to 7 in a row), and a tile pops when its count goes up. It is read through RLS on load, on each broadcast (debounced) and every 30 s, and hidden when zero. The labs: `/dev/controls` (the row, floating emojis, made-up counts) and `/dev/player` (the owner's real player, with buttons that play the guests).

**What I heard (#129, 2026-11-21).** A second block for the owner, in every mode, Self included: "Tell the AI what you heard", ten fixed readings (calm, tender, warm, joyful, playful, hesitant, sad, tense, anxious, blaming (stored as `heard_reproach`; labelled "Reproach" before v0.22.1)). It tells the model how the sound read to the listener; it never steers, which is why it exists in Self, where nobody steers. Stored as reactions with a `heard_` kind (migration 0018, revert in `supabase/revert/`), delivered once like them, but returned in their own `heard` field ("tense x2, 30 s ago"). Pending ones show as "Waiting for the AI: tense". Defaults chosen without Gael, to review: owner only (listeners without an account have no buttons, step 8), a fixed list and no free text (compact, and no text from a listener reaches the model), and these ten words (the tester's example was reproach heard where hesitation was meant).

In Self the owner gets "Fade to silence after" under the mode (in a collapsed "Settings" block before v0.22.2) (5 min to 1 hour, never); Attuned and Jukebox never fade, so the select is hidden there. The status line says "Fading" for the 30 s of the fade, then "Faded · no update for 6 min".

**Live tuning (migration 0019).** Its own section (`pl-live`, Attuned and Jukebox only) above "Guide the sound" and "Tell the AI what you heard", since a press in either reaches the AI while it listens (v0.22.1 feedback; before, it sat inside "Guide the sound"): a "Live tuning" toggle (`pl-toggle`, `aria-pressed`) saves `sessions.settings.live` like the fade setting. When on, the model waits for presses with the tool `listen` after each answer. The status line sits under the toggle and lists what was sent from both blocks; with Live tuning on, the two blocks drop their own "reads on its next message" lines. Off, the line says "Off: your presses reach the AI with your next message."; on, "On: after each answer, the AI waits for your presses." The status line under the buttons reads "The AI is listening: your presses reach it now (N s)." with a countdown (hidden from screen readers, so the live region does not speak every second) and what was sent while `sessions.listening_until` (from `player_poll`, compared with the server's clock offset) is in the future, and "Live tuning is on: the AI listens after its next answer." otherwise. While listening, the pending list refreshes every 2 s instead of 15 s. After a wait (v0.22.1, tester report v0.22.0): if the listener pressed during it, "The AI is answering your press…" until the next wait (at most 60 s); if not, "Not listening now: your presses reach the AI with your next message." (plus what was sent). Live tuning stays on: it is the listener's standing wish, never switched off by an idle wait.

### Owner panel (slide-up sheet)
- Limits are removed for now; this panel will hold the owner's settings when limits come back (roadmap step 5). `rest_after` is the one shared setting.
- Colour on/off, max brightness.
- Image feedback: off / on request / every turn, with "uses more of the model's context (about N tokens per image)".
- Share: shows the player link with a Copy button. Anyone with it can listen. (Built: the signed-in owner sees "Copy link to share" under the controls, and `/sessions` lists every session with Open and Copy buttons.)
- End session.

Listeners (anyone without the account) see only the colour and sound, the status line, hide controls, mute and volume (which change nothing for anyone else), the share row and "Add to your AI". They do **not** get the owner panel, limits, or reaction buttons. Next to the share link they see the button "Add to your AI", linking to the landing page's install steps (`/#add`).

### Presence between turns
The model does not exist between two turns, but a sound that keeps playing reads as a heartbeat. In the first outside test people said goodbye several times instead of closing the window, as if leaving meant abandoning someone. The sound must not say there is someone there when there is not. Two measures:

- **Automatic fade to silence, off or on by setting.** An owner setting `rest_after` (seconds, or `null` for off) in the session settings (limits.md). Default by mode (roadmap #16): **Self** 900 s (15 min; it was 300 s until 2026-11-09, which faded the sound before the next message in a slow test), since the sound is Claude's own state and Claude is not there between turns; **Attuned** and **Jukebox** off, since there the music is for the listener, who wants to hear it for as long as possible. New sessions start in Self, so they get the 900 s default. The owner can change it in the owner panel and so can Claude (`rest_after` on `set_sound`); the last write wins and each side is told (limits.md, "Who can change what"). When it is on, the fade starts at `rest_after` after the `created_at` of the last state, using a coarse server-clock offset (the player compares the server time in the `get_player_state` response with its own clock; a second of error is fine, so it does not depend on #34). The engine volume fades to 0 over 30 s and the colour to dark; no state row is written. The next `set_sound` brings the sound back with its own transition (at least 3 s). The near-silent keep-alive file keeps playing so the tab stays alive. Separately, `INACTIVE_AFTER_S` (1800, decided) only drives the sessions page label: "last sound 2 h ago" instead of "Active" (#30), whatever `rest_after` is.
- **The model is told.** When `rest_after` is on and a call arrives after it, the feedback gets `resting` and the note `"the sound faded after N min without an update from you"`. With it off, nothing is said.
- **A way to leave together: Claude's own closing sound.** When the user says in the chat that the session is over, that message is a turn, so Claude is there to answer. It plays a short closing sound of its own (one `set_sound` with a long transition, then fade) and the session ends. This is Claude's, not an automatic figure, which keeps the sound honest: the player never makes sound for Claude. Mechanism: `silence` takes `end: true` (mcp-tools.md); after the fade the server sets `ended_at`, the page shows "This session has ended", and the sessions page shows it as ended. The owner's "End session" button stays as it is (no figure: Claude is not there to play one). A listener who just closes the tab triggers nothing.

### Colour field
- The base is CSS: a gradient from `colour` to `secondary` (shape wash, glow or sweep), an optional grain or soft-noise texture, glided over the transition time (at least 1 s).
- The motion is a canvas over it (`components/player/visual-canvas.tsx`), painted from the pure frame model (`packages/shared/src/visual.ts`). Each frame: the beat from `beatsAt` on the shared timeline (the server's clock, minus the output latency and the listener's "Sync" delay), followed by `BeatClock` so it never snaps; then `drawFrame` (the motion plus the flash budget); then paint. The canvas is drawn at the device's resolution (at most 2x the CSS size). A slow device steps it down by 20% at a time (to 30% at least) when frames average over 24 ms, and back up by 25% after 8 s of smooth frames, never above a scale that proved too slow within 10 s of a step up. A gap over 250 ms between frames (a hidden tab, a stall) is not counted: before v0.23.2 every return from another tab stepped the picture down for good, and a desktop ended blurred. It pauses with the tab and starts from the clock when it returns.
- `pulse`: a faint white wash on the beat. `drift`: a highlight that wanders. `breathe`: a glow that swells over the phrase (4 bars, 16 beats). `scene`: motes, ripples (a ring per beat), rain (fine drops with depth, splashes and a mist), snow, embers (rising sparks), aurora, waves, fireflies, stars, bubbles or leaves; the mood picks one when the model sets none, and a change of scene is a crossfade of at least 1.5 s. The mood shapes all of it (`feel`, see visuals.md).
- `prefers-reduced-motion`: no canvas; the colour still changes. The "Gradient" and "Scenes" buttons do it for one listener: the picture is three parts, the base colour (always on), the gradient (colour play, slow, off the beat) and the visuals (the scene); each of the last two can be turned off. `?field=css` brings the old CSS motion back.
- Header and landing: the burger menu and the phone layout start at 900px and below (the hero waves are hidden there). The footer is one centred line: the two credit logos, then Privacy, AGPL-3.0, Source code and the version; two rows under 640px.
- Listener controls: "Gradient" and "Scenes" (the "Picture delay" slider was removed in v0.18.1: the picture lands with the sound at 0), remembered on the device (`se:picture`).

### Session details page
- Timeline of states: turn, final, time, intent mood as five small bars, reads_as overlaid, gesture icon, clamps.
- The model's optional `note` per state.
- Reactions interleaved in time.
- "Replay" a past state locally (no write).

## Saved moments (`/m/[id]`, `/saved`, #151)
A saved moment is one frozen state: the synth state with its seeds, or the Strudel code and bpm, plus the picture. **Save button**: a bookmark icon in the controls bar before Fullscreen, for the session owner only (`isOwner` from `useSnapshots`). It calls the `save_moment` function (database.md) with the default name `<session title or "Moment"> · HH:MM` (the browser's local time) and `p_by: human`; the state is copied on the server. After a save the icon turns into a check for 3 s and a small card shows for about 8 s (it fades in, and fades out over its last 300 ms; it stays while the pointer rests on it or the name is being typed): a tick, `Saved` and the name, then three small buttons Rename, Open and Copy link (`Already saved as "name"` when this exact moment was saved before: the first save comes back, nothing new is written). Rename edits the name in place (the browser client, RLS allows the owner's name column only), and the notice stays while the name is being typed. Errors are one line: nothing playing, too many saves (a minute), 200 saved.
**`/m/[id]`** (`MomentPlayer`, `components/moment/moment-player.tsx`): the page reads `get_saved_moment` (no owner, no session id; `notFound()` when null) and is the same for everyone. The picture fills the view; a compact panel shows the name, "Saved by you | the AI | a listener", the date, Synth or Strudel, then a Start listening gate (an AudioContext needs a tap), Mute, Volume, Copy link and the QR code (desktop only). Nothing else: no poll, heartbeat, presence, rest or lock-screen player. It takes the state through the same player-side caps as the session player (`hardCaps`, master at most 0.9, `capFrame` in the picture) and runs Strudel in the same sandbox frame (`/strudel/frame.html`), with no owner, mode or code switch (the frame is the protection) and no report. Seeds: in the live player the picture seed and the grid seed come from `voiceSeedOf(sessionId)`; here they come from the stored `voice_seed` (`audio.setGridSeed(voice_seed)`, picture seed `voice_seed & 0xffff`), the state's own seed from `seed` (Strudel: `seed & 0xffff`). The clock starts at the tap (`at = Date.now()`, offset 0). Volume and mute are remembered per device (`lib/player-prefs.ts`, shared with the session player). The signed-in owner gets a Rename form (the name only; the sound is frozen). The page is out of search (`noindex`, `robots.txt`).
**`/saved`**: see the table above; rename and delete are server actions with the user's own session, so row-level security decides.
**`/dev/moment`** renders `MomentPlayer` on a made-up synth state and a made-up Strudel state with no database, to look at the page before the migration is released. Limit: "exactly the same" holds while the engine does not change; each moment stores `app_version`.

## Accessibility
- Every control reachable by keyboard, visible focus, labels for screen readers.
- Text contrast ≥ 4.5:1 on the darkest and lightest colour field values (put controls on a translucent dark panel).
- No information conveyed by colour alone.

## Mobile notes
- No foreground warning any more: background playback works on phones. Show a Resume button when the phone stops the audio (built).
- Use the Wake Lock API while playing, where available, wrapped in try/catch.
- Handle `visibilitychange`: when the page becomes visible again, resume the `AudioContext` and re-apply the current state.
- Handle the `AudioContext` `statechange` event too: when the state becomes `suspended` or `interrupted` (iOS) while the listener has not muted, call `resume()` without waiting for a tap, and re-apply the current state. Do the same if the keep-alive element fires `pause` and we did not pause it (mute does). This is for system interruptions such as the microphone opening for dictation (mobile.md, "Dictation"). Log each event in the `?debug=1` report.

Implementation notes (shipped): the player takes the clock offset from the `now` key of `get_player_state` (migration 0003) and checks the rest on its 1 s clock and on the worker's 3 s tick (so it also works in the background). The fade is a derived state: same seed, volume 0, colour dark and still, 30 s transition; the layers keep playing silently. A newer state, or a settings change that turns the fade off, brings the sound back (at least 3 s). `silence` with `end: true` keeps the layers on and fades only the volume, sets `ended_at` at once, and the player plays that closing state, then shows "This session has ended" after the fade and closes its audio. The owner panel and the `listener` notice for an owner change come with roadmap step 5; until then only Claude writes `rest_after`.

### The mode
Every listener sees a small "Self", "Attuned" or "Jukebox" label in the status bar (with "· locked" when the owner locked it). The owner also sees a four-way control, titled "Mode", with Auto, Self, Attuned, Jukebox, which calls `set_mode_policy`: Auto lets the model switch (under the rules in `mcp-tools.md`), the others lock the mode. Auto keeps its filled highlight (the owner's choice); under Auto the button of the mode in effect gets a teal mark (a teal ring and teal text, the cool accent, so it is not read as the orange choice; `data-active`, with a visually hidden "(playing now)") that moves when the model switches; a locked mode is both the choice and the mode in effect, so it keeps the filled style only. A lock to Self stops a Strudel pattern; a lock to Attuned or Jukebox keeps it. The player reads the mode from `get_player_state` and refreshes on the session broadcast.

### Panel layout (v0.22.2)
Gael (v0.22.1 test): too much at once for a new listener. Visible: the top bar, Mute, Volume, and **Mode** (owner; with "Fade to silence after" in Self). Then closed sections (`details.pl-group`, closed by default): **Visuals and Strudel** (Gradient, Scenes, Allow Strudel, Strudel visuals, Strudel code; a listener's section is **Visuals**, with Gradient, Scenes and, while a pattern plays, the two Strudel view toggles) and **Feedback to the AI** (Live tuning and its status line in Attuned and Jukebox, "Let the AI see the picture" with a one-line hint, then "Guide the sound" in the listener modes and "Tell the AI what you heard", each its own closed block inside). `ControlsPanel` hands the Gradient/Scenes toggles to its `middle` (a function of them) so they sit in the Visuals section. Then **What the AI is doing** (`pl-info`, in `controls-panel.tsx`): one quiet inset card (muted text, hairlines, no button look) holding "The code playing" (renamed from "Strudel code", which was also a toggle's name; for everyone, guests included), "What the AI set" and "What the AI can see" (signed in / owner); it hides itself when none of its blocks renders (`:has(details)`). The "Settings" block is gone. Listener-facing text says "the AI", never "the model" (tester report v0.22.1); the tagline became "Let the AI hum while it thinks" too (title, hero, share image redrawn from `docs/brand/og-card.html`).

Scrollbar (v0.22.5, tester report v0.22.4): the native scrollbar of the panel is hidden (Chromium on Windows kept its arrows even when thin) and a 4 px bar is drawn (`pl-scroll-bar` in `controls-panel.tsx`): shown while the panel scrolls, faded out a second later, like a phone's.

Colour: a pressed toggle is a soft teal box (teal border at 60%, 10% fill) with an **orange** tick (`--glow`), less teal than before (Gael). The volume slider and the playing mode stay teal; the chosen policy stays orange.

#### Settings block (owner, before v0.22.2)
A collapsed "Settings" in the owner panel, in every mode, holds "Fade to silence after" (Self only) and **Let the AI see the picture** (a `pl-toggle`, saved as `settings.image_feedback`: `on_request` when on, the default; `off` when off). Its title: "The AI can ask for a small picture of what you see and of the last 8 s of sound, taken by this player. Nothing from your camera or microphone." (It also held "Little sounds from the model" until gestures were removed in v0.12.)


## Strudel visuals
Under the Gradient and Scenes row, in the same style: **Allow Strudel** (owner only, the full width, saved on the session; it replaced the checkbox "Let the model play Strudel code"), then side by side **Strudel visuals** and **Strudel code** (every listener, saved on the device in `se:picture` as `strudel` and `code`, both on by default). While Strudel plays with the visuals on, the picture is the code and its drawings instead of the scenes ([strudel.md](strudel.md), "The picture"). "Strudel code" off fades the code over the picture out in 0.6 s and leaves only the drawings (`.pianoroll()`, `.punchcard()`, scopes); the code stays readable under "Strudel code" in the panel. It is disabled while the visuals are off (#61). A listener who is not the owner sees only the two picture buttons, and only while a pattern plays.

The page itself never scrolls: a panel taller than the window scrolls inside itself, so the picture stays still (#127).

The top row of the controls has the status (a mode chip) on the left, the turn text in the middle (dropped when the controls are narrower than 430 px, `WHEN_MIN_WIDTH`, Gael 2026-11-14) and, flush right, **Save this moment** (a bookmark, owner only), **Fullscreen** (only the picture; Esc or the exit button, which shows for a moment and again on a touch, bring the layout back) and Hide controls. `/dev/controls` renders the controls with made-up state for the owner, a signed-in listener and a guest.

## Snapshots (what the player captures)
`lib/snapshot/use-snapshots.ts`, used by the player. Only when all hold: this browser is the session owner (signed in and `sessions.owner_id` matches), the audio has started, the page is visible, and `image_feedback` is not `off`. A tap (`AnalyserNode`, after the listener's volume, fed by the synth and the Strudel bus) is sampled every 100 ms into a rolling 8 s record. A few seconds after each new state (its transition plus 3 s, clamped to 8 to 14 s; a newer state cancels the pending one) the player draws the picture (base colour, the scenes canvas, Strudel's drawings canvas only while they show) and the spectrogram into one JPEG (quality 0.72, 0.5 if over 340000 characters), and sends it with `put_snapshot` together with the measured numbers and the owner's volume. It repeats every 30 s while the state stays. One capture at a time, never on a hidden page, errors ignored (logged with `?debug`). See [../feedback.md](../feedback.md).

**Snapshots (step 10).** The owner's player keeps a tap (`AudioOutput.tap`, an AnalyserNode fed by the synth and the Strudel bus, so after the listener's volume) and samples it every 100 ms into an 8 s ring (`lib/snapshot/sound-recorder.ts`). 8 to 14 s after a new state (its transition plus 3 s), then every 30 s, it composes one JPEG (`lib/snapshot/compose.ts`, 512×416: the base colour, the scenes canvas and, when shown, the Strudel drawings on top; a spectrogram of the ring below, 40 Hz to 12 kHz, low notes at the bottom, a white line where the current sound began) and saves it with `put_snapshot` together with the numbers measured after that line. Only while the page is visible, the audio runs, this browser is the owner's and the setting is on. The `/dev/player` lab shows each snapshot it would send (the lab viewer acts as the owner).

**What the AI can see (owner only).** `components/player/what-ai-saw.tsx`, a `<details className="pl-set se-sm">` right after "What the AI set" (nothing renders unless `sessions.owner_id` is the signed-in user). Loaded when opened, then every 10 s while open (`snapshots.image,seen_image,seen_at,taken_at` and `sessions.settings`). With `seen_image`: that picture (full width, rounded), "The AI looked at this {n s|n min|n h} ago." and a muted line, "Below: the last seconds of sound, low notes at the bottom.". Without it but with `image`: the live picture and "Taken … ago. The AI has not looked yet." With neither: "Nothing yet: the player takes a picture a few seconds after each new sound, while this page is open and playing.", or "Turned off under Settings." when `image_feedback` is `off`. `seen_image` is the copy the server stored when the model asked (migration 0024), so the owner sees exactly what the model saw even after the live image was replaced. The `/dev/player` lab answers the snapshot query with its last snapshot as both `image` and `seen_image`. While Strudel draws, the picture is the Strudel view as displayed (`drawStrudel` in `lib/snapshot/compose.ts`): its dark backdrop at the view's dimming (`--sv-k`), the drawings at their opacity, and the code text with its lines and colours, at the code's opacity (so with "Strudel code" off, no code). The code is anchored at the top left under the turn label at 9 px or more, not cropped and scaled with the picture: on a wide screen the cover crop cut it off and shrank it to about 6 px. The first picture after a new sound waits for the scenes canvas to hold a frame (it is blank while it rescales).
