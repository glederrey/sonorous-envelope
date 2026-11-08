# Player and web app UI

Visual design (colours, type, components, logo): follow the [Sonorous Envelope design system](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY) (summary in [design-system.md](../design-system.md)).

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page: the idea, how it works, how to add the connector in claude.ai, why the player page must stay open (see below) | public |
| `/guide` | How to use the connector: the tools, in plain words, with what to say. Marks each tool live or coming; update it when a tool ships | public |
| `/safety` | Safety and control: limits, consent levels, the rules that never change | public |
| `/login` | Email magic link (Google/GitHub optional), supports `?next=`. Only the person who connects Claude needs it | public |
| `/oauth/consent` | OAuth consent (auth.md) | login |
| `/sessions` | The user's sessions: title, created, last active, turns, open / end / delete | login |
| `/s/[id]` | The player. Opens for anyone with the link: the browser signs in anonymously and joins (`join_session`) | link only |
| `/s/[id]/details` | History: states, intent vs reads_as, clamps, reactions, notes | link only (members) |
| `/settings` | Default listener settings, connected apps (OAuth grants, revoke) | login |
| `/dev/mood` | Five sliders → live mapped sound; for tuning (dev builds only) | login |

## The landing page (`/`)

The first page anyone sees, before signing in. It explains the idea, how it works, and how to set it up. One long page, read top to bottom, works on a phone. Signed-in visitors see the same page with "Your sessions" in the header instead of "Sign in".

### 1. Hero
- Logo lockup (mark + wordmark) top left; "Sign in" or "Your sessions" top right.
- Headline in `display`: "Let the model hum while it thinks." One line under it in `body`: "Sonorous Envelope gives Claude a second voice: a small synthesizer and a colour field you hear and see while it works."
- Two actions: "Add to Claude" (primary, scrolls to the setup section) and "How it works" (secondary).
- Behind the hero: a live, muted-by-default colour field drifting slowly (idle `field-a` → `field-b`, then a few preset moods gliding over ~8 s each). It respects `prefers-reduced-motion` and the 3 Hz rule like the player. An optional "Play a sample" button plays a short local demo state through the engine (tap required, volume capped low, stops on its own after 20 s).

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
4. **You stay in control.** Volume, one-tap mute, limits, a consent level, and buttons like "calmer" or "softer". The model can never go past your limits.

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
- On a phone: keep the player page in the foreground with the screen on. Phones pause web audio when you switch apps or lock the screen. (Same wording as the mobile hint in the player, until the stream mode in mobile.md exists.)
- If the page was closed, reopen the link from the conversation or from "Your sessions": it picks up the current state.

### 6. Safety and control
Short list from safety.md: listener limits, consent levels (ambient by default), mute always one tap away, no flashing faster than 3 per second, every clamp reported to the model. Link to the `/safety` page (not to files on GitHub).

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
- **Volume slider** (local gain).
- **Status:** "Listening · turn 12 · last change 4 s ago", and a small dot when the model is mid-turn (last state non-final and < 20 s old).

### Reaction buttons
calmer, softer, darker, brighter, slower, faster, more of this, less of this. Icon + short label. Brief confirmation ("sent") after a press. Disabled for 1 s after a press to avoid floods.

### Owner panel (slide-up sheet)
- Consent level: ambient / expressive / anything, each with a one-line explanation.
- Max volume, max harshness, minimum transition time.
- Mood floor for joy and calm.
- Gestures on/off.
- Colour on/off, max brightness.
- Image feedback: off / on request / every turn, with "uses more of the model's context (about N tokens per image)".
- Share: shows the player link with a Copy button. Anyone with it can listen.
- End session.

Non-owners see only volume, mute, reactions and "leave".

### Colour field
- Full-screen canvas. Gradient from `colour` to `secondary`, slow drift (Perlin-like noise in the gradient angle), optional grain or soft-noise texture overlay.
- `pulse` motion syncs brightness to the cutoff LFO phase sent in the state (computed locally from rate), within the limits (≤ 3 Hz, swing ≤ 0.2).
- Glides over the transition time.
- `prefers-reduced-motion`: disable pulse and drift; still colour changes, glided over ≥ 3 s.

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
- Show a hint on iOS/Android: "Keep this page open in the foreground. Audio may stop if you switch apps or lock the screen." (Until the stream mode in mobile.md exists.)
- Use the Wake Lock API while playing, where available, wrapped in try/catch.
- Handle `visibilitychange`: when the page becomes visible again, resume the `AudioContext` and re-apply the current state.
