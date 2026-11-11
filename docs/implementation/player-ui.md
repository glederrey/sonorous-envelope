# Player and web app UI

Visual design (colours, type, components, logo): follow the [Sonorous Envelope design system](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY) (summary in [design-system.md](../design-system.md)).

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page: the idea, how it works, how to add the connector in claude.ai, why the player page must stay open (see below) | public |
| `/guide` | How to use the connector: the tools, in plain words, with what to say. Marks each tool live or coming; update it when a tool ships | public |
| `/safety` | Safety and control: what the listener controls, the rules that never change | public |
| `/login` | Email magic link (Google/GitHub optional), supports `?next=`. Only the person who connects Claude needs it | public |
| `/oauth/consent` | OAuth consent (auth.md) | login |
| `/sessions` | The user's sessions: title, created, last active, turns, open / end / delete | login |
| `/s/[id]` | The player. Opens for anyone with the link, no account. Signed-in viewers also get the share link; everyone else gets a link to add the connector | link only |
| `/s/[id]/details` | History: states, intent vs reads_as, clamps, reactions, notes | link only (members) |
| `/settings` | Default listener settings, connected apps (OAuth grants, revoke) | login |
| `/dev/mood` | Five sliders → live mapped sound; for tuning (dev builds only) | login |

## The landing page (`/`)

The first page anyone sees, before signing in. It explains the idea, how it works, and how to set it up. One long page, read top to bottom, works on a phone. Signed-in visitors see the same page with "Your sessions" in the header instead of "Sign in".

### 1. Hero
- Logo lockup (mark + wordmark) top left; "Sign in" or "Your sessions" top right.
- Headline in `display`: "Let the model hum while it thinks." One line under it in `body`: "Sonorous Envelope gives Claude a second voice: a small synthesizer and a colour field you hear and see while it works."
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

### 6. Safety and control
Short list from safety.md: what the listener controls, mute always one tap away, no flashing faster than 3 per second. Listener limits are removed for now. Link to the `/safety` page (not to files on GitHub).

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
Built (2026-11-10), owner only, and only in the external face (the internal face is how the model feels, so nobody steers it): calmer, stormier, softer, harsher, darker, brighter, slower, faster, more of this, less of this (`packages/shared/src/reactions.ts`, `owner-controls.tsx`). Every press counts (no lock); the pending ones show as "Waiting for Claude: calmer ×2. It reads them on its next message" until the model has read them (the server cannot push to the model: it reads them on its next `set_sound`). `set_sound` claims the pending ones with `claim_reactions` and returns them as `reactions` ("calmer x2, 30 s ago"), once; `get_feedback` shows them without claiming.

In the internal face the owner gets a collapsed "Settings" block with "Fade to silence after" (5 min to 1 hour, never); the external face never fades, so the select is hidden there. The status line says "Fading" for the 30 s of the fade, then "Faded · no update for 6 min".

### Owner panel (slide-up sheet)
- Limits are removed for now; this panel will hold the owner's settings when limits come back (roadmap step 5). `rest_after` is the one shared setting.
- Colour on/off, max brightness.
- Image feedback: off / on request / every turn, with "uses more of the model's context (about N tokens per image)".
- Share: shows the player link with a Copy button. Anyone with it can listen. (Built: the signed-in owner sees "Copy link to share" under the controls, and `/sessions` lists every session with Open and Copy buttons.)
- End session.

Listeners (anyone without the account) see only the colour and sound, the status line, hide controls, mute and volume (which change nothing for anyone else), the share row and "Add it to your AI app". They do **not** get the owner panel, limits, or reaction buttons. Instead of the share link they see "Want Claude to make sound for you too? Add it to your Claude", linking to the landing page's install steps (`/#add`).

### Presence between turns
The model does not exist between two turns, but a sound that keeps playing reads as a heartbeat. In the first outside test people said goodbye several times instead of closing the window, as if leaving meant abandoning someone. The sound must not say there is someone there when there is not. Two measures:

- **Automatic fade to silence, off or on by setting.** An owner setting `rest_after` (seconds, or `null` for off) in the session settings (limits.md). Default by face (roadmap #16): the **internal** face 900 s (15 min; it was 300 s until 2026-11-09, which faded the sound before the next message in a slow test), since the sound is Claude's own state and Claude is not there between turns; the **external** face off, since there Claude makes music for the listener, who wants to hear it for as long as possible. Until modes exist, new sessions use the inner default. The owner can change it in the owner panel and so can Claude (`rest_after` on `set_sound`); the last write wins and each side is told (limits.md, "Who can change what"). When it is on, the fade starts at `rest_after` after the `created_at` of the last state, using a coarse server-clock offset (the player compares the server time in the `get_player_state` response with its own clock; a second of error is fine, so it does not depend on #34). The engine volume fades to 0 over 30 s and the colour to dark; no state row is written. The next `set_sound` brings the sound back with its own transition (at least 3 s). The near-silent keep-alive file keeps playing so the tab stays alive. Separately, `INACTIVE_AFTER_S` (1800, decided) only drives the sessions page label: "last sound 2 h ago" instead of "Active" (#30), whatever `rest_after` is.
- **The model is told.** When `rest_after` is on and a call arrives after it, the feedback gets `resting` and the note `"the sound faded after N min without an update from you"`. With it off, nothing is said.
- **A way to leave together: Claude's own closing sound.** When the user says in the chat that the session is over, that message is a turn, so Claude is there to answer. It plays a short closing sound of its own (one `set_sound` with a long transition, then fade) and the session ends. This is Claude's, not an automatic figure, which keeps the sound honest: the player never makes sound for Claude. Mechanism: `silence` takes `end: true` (mcp-tools.md); after the fade the server sets `ended_at`, the page shows "This session has ended", and the sessions page shows it as ended. The owner's "End session" button stays as it is (no figure: Claude is not there to play one). A listener who just closes the tab triggers nothing.

### Colour field
- The base is CSS: a gradient from `colour` to `secondary` (shape wash, glow or sweep), an optional grain or soft-noise texture, glided over the transition time (at least 1 s).
- The motion is a canvas over it (`components/player/visual-canvas.tsx`), painted from the pure frame model (`packages/shared/src/visual.ts`). Each frame: the beat from `beatsAt` on the shared timeline (the server's clock, minus the output latency and the listener's "Sync" delay), followed by `BeatClock` so it never snaps; then `drawFrame` (the motion plus the flash budget); then paint. The canvas is drawn at half resolution (smaller still on a slow phone), pauses with the tab and starts from the clock when it returns.
- `pulse`: a faint white wash on the beat. `drift`: a highlight that wanders. `breathe`: a glow that swells over the phrase (4 bars, 16 beats). `scene`: motes, ripples (a ring per beat) or rain. The mood shapes all of it (`feel`, see visuals.md).
- `prefers-reduced-motion`: no canvas; the colour still changes. The "Still picture" button does the same for one listener. `?field=css` brings the old CSS motion back.
- Listener controls: "Still picture" and "Sync" (0 to 400 ms, delays the picture, for Bluetooth), both remembered on the device (`se:picture`).

### Session details page
- Timeline of states: turn, final, time, intent mood as five small bars, reads_as overlaid, gesture icon, clamps.
- The model's optional `note` per state.
- Reactions interleaved in time.
- "Replay" a past state locally (no write).

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

### The face
Every listener sees a small "Internal" or "External" label in the status bar (with "· locked" when the owner locked it). The owner also sees a three-way control, Auto, Internal, External, which calls `set_mode_policy`: Auto lets the model switch (under the rules in `mcp-tools.md`), the others lock the face. The player reads the face from `get_player_state` and refreshes on the session broadcast.

### Settings block (owner)
A collapsed "Settings" in the owner panel, on the internal face only, holds "Fade to silence after". (It also held "Little sounds from the model" until gestures were removed in v0.12.)
