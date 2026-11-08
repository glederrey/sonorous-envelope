# Design system

The web app's design system lives in a Claude artifact: **[Sonorous Envelope design system](https://claude.ai/artifact/XhWhkPDkbX1S1MyNKeLDYY)**. It is the reference for anything visual in `apps/web`. The artifact is public.

It holds:
- **Brand book**: principles, voice, colour, type, spacing, motion, logo, iconography and accessibility rules.
- **Tokens** (dark first, plus light): colours, type scale, spacing, radii, shadows, sizes and durations. A copy is in [`brand/tokens.json`](brand/tokens.json); the artifact is the source of truth.
- **Component specs** with live previews and CSS (`se-` classes): Logo, Button, ColourField, StartScreen, MuteButton, StatusLine, Slider, ReactionButton, ControlBar, ConsentLevel, Switch, SegmentedControl, CopyField, Tag, ClampNote, MoodBars, SessionRow, Sheet.

## In short

- **Fonts:** Roboto for text, JetBrains Mono for data (numbers, settings, URLs, the status line). Load both with `next/font/google`.
- **Colour:** dark is home. Two brand hues from the logo: `glow` (warm amber, the one primary action) and `tide` (cool teal, selection, links, focus). Controls on the colour field sit on a translucent `scrim`, which keeps text at 4.5:1 or more even over a white field.
- **Icons:** Lucide.
- **Safety in the UI:** mute always visible, no colour-only signals, and no brightness cycle faster than 3 Hz (see [safety.md](safety.md)).

## Where each part is used

| Surface | Spec | Notes |
|---|---|---|
| Landing page `/` | [player-ui.md](implementation/player-ui.md), "The landing page" | `display` type for the hero headline only, once per page. `space-8` for the section rhythm. Dark first, light via `prefers-color-scheme`. The hero sits on a live colour field; text over it uses `scrim` or `on-scrim` tokens. |
| Player `/s/[id]` | player-ui.md, "The player page" | Mostly colour field. Controls on `scrim`. |
| Other pages | player-ui.md | `bg`, `surface`, `ink`; `glow` for the one primary action, `tide` for selection and links. |

## In the code

State of `apps/web`: the home page is a placeholder that uses only `bg` and `ink` (CSS variables in `app/globals.css`, with `prefers-color-scheme` for light). Fonts (`next/font/google`), the remaining tokens and the `se-` components are added as pages need them. Keep the tokens in one place (CSS variables generated from or checked against `brand/tokens.json`) instead of copying values into components.

## Logo

An ADSR envelope drawn as one stroke, warm (attack) to cool (release). Files in [`brand/`](brand/):

| File | Use |
|---|---|
| ![](brand/mark-on-dark.svg) `mark-on-dark.svg` | Gradient mark on dark grounds |
| `mark-on-light.svg` | Gradient mark on light grounds (deeper stops) |
| `mark-mono-light-ink.svg` / `mark-mono-dark-ink.svg` | Single ink, where colour doesn't fit |
| `app-icon.svg` | Favicon, PWA and home-screen icon (the app serves a copy at `apps/web/public/icon.svg`) |

The wordmark is live text, "sonorous envelope" in lowercase JetBrains Mono 500, not part of the SVG.
