# Player and web app UI

Visual design (colours, type, components, logo): see the [design system](../design-system.md).

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | What the project is, how to add the connector (with the URL to copy), link to sessions | public |
| `/login` | Email magic link (Google/GitHub optional), supports `?next=` | public |
| `/oauth/consent` | OAuth consent (auth.md) | login |
| `/sessions` | The user's sessions: title, created, last active, turns, open / end / delete | login |
| `/s/[id]` | The player | login + session member |
| `/s/[id]/details` | History: states, intent vs reads_as, clamps, reactions, notes | login + member |
| `/invite/[token]` | Redeem an invite, then redirect to the player | login |
| `/settings` | Default listener settings, connected apps (OAuth grants, revoke) | login |
| `/dev/mood` | Five sliders → live mapped sound; for tuning (dev builds only) | login |

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
- Invite a listener: creates an invite and shows the link with a Copy button.
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
