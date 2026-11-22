# Licensing

## Decision
The project is licensed **AGPL-3.0-or-later** (file `LICENSE`, `license` field in every `package.json`).

Why: the Strudel mode (issue #18) runs Strudel in the player. Every Strudel package we would use (`@strudel/web`, `@strudel/core`, `@strudel/webaudio`, `@strudel/mini`, `@strudel/transpiler`, `superdough`) is `AGPL-3.0-or-later` on npm, and the project itself is AGPL-3.0. Combining it with our code makes the combined work AGPL. Licensing the whole repo as AGPL from the start avoids a later relicense.

Checked 2026-11-08 on npm and in the Strudel repository (codeberg.org/uzu/strudel). Check again before adding the dependency.

## Copyright
The code is written by Gael Lederrey with Claude Code. Gael holds the copyright; no outside contributors yet. If outside contributions are accepted later, decide whether to ask for a contributor agreement, because relicensing then needs everyone's consent.

## What AGPL requires of us
- **Source offer (section 13).** Users who interact with the service over a network, including the player's browser code, must be able to get the Corresponding Source of the version they use. The repo is public, so we meet this with a visible link to the repository (and the release tag) in the site footer and on the player. Done: `SiteFooter` (`apps/web/components/site-footer.tsx`) is in the root layout, always at the bottom of the page, with links to the licence, the source and the running version. The links point at the release tag, so they match the code that is live. The deploy workflow sets `APP_VERSION` from the release tag, `next.config.ts` exposes it as `NEXT_PUBLIC_APP_VERSION`, and local or CI builds show `dev` and link to the repository. Keep this footer on every page; if a page needs the full screen (the player), subtract `--se-footer-h` from its height.
- **Modified Strudel.** If we patch Strudel, those patches are published under AGPL with the rest. Prefer using it unmodified from npm.
- **Notices.** Keep the licence text and copyright notices of Strudel and the other dependencies. The build must not strip the licence comments from the Strudel bundle.
- **Whole bundle.** The player page that loads Strudel is a combined work. Keep Strudel in its own lazily loaded chunk so the rest of the site is clearly separate, but treat the repository as AGPL anyway.

## What it does not require
- **Code written by the LLM or the user** and run in Strudel is user content, not part of our program. It is not covered by our licence. Say so in the terms if the Strudel code is shown or stored publicly.
- **Using the hosted service** does not oblige users to do anything.
- **Private use of the hosted service by us** needs nothing beyond the source offer above.

## Other dependencies
Runtime dependencies so far (Next.js, React, Supabase client, `mcp-handler`, zod, `jose`) are MIT or Apache-2.0, which are compatible with AGPL. Before adding a dependency, check its licence. Avoid anything with a "non-commercial" or "no derivatives" clause.

- **Sonic Pi** (MIT) and **TidalCycles** (GPL) are not used.

## Not legal advice
This is a reading of the licences by Claude Code, not legal advice. For a commercial launch, have someone qualified check it.

## Strudel samples (checked 2026-11-11)
The Strudel packages in use are exact-pinned (`@strudel/core`, `mini`, `tonal`, `transpiler` 1.2.6, `superdough` 1.3.0), all AGPL-3.0-or-later on npm. The worker bundle (`public/strudel/worker.js`, built by `pnpm build:strudel`) carries a notice and the source link, and nothing in Strudel is patched.
We do **not** host or redistribute any sample. The listener's browser fetches the default banks from their publishers, pinned to a commit (`apps/web/lib/strudel/banks.ts`), as strudel.cc does. Licences as far as the upstream repositories say: VCSL CC0; piano (Salamander Grand) CC-BY 3.0; mridangam CC-BY-SA 4.0; tidal-drum-machines and Dirt-Samples state no licence (the drum machine repository has no LICENSE file; Dirt-Samples has per-file provenance). Before hosting any of them ourselves, audit them again and keep their notices. Model-written Strudel code is user content, shown to listeners in the player; the guide says it is the model's and not covered by this licence.

## Strudel's pictures (2026-11-14)
The Strudel picture uses `@strudel/draw` 1.2.6 (AGPL-3.0-or-later on npm, exact-pinned, unmodified): its `__pianoroll` draws the piano roll, punchcard and wordfall, and its `pitchwheel` the pitch wheel. `apps/web/lib/strudel/draw.ts` also contains code written after Strudel's `spiral.mjs`, `scope.mjs` and `spectrum.mjs` (same geometry and options); it is a derivative work, so it carries Strudel's copyright and licence notice in its header, and is published under AGPL-3.0-or-later with the rest of the repository (the footer's source link). Strudel's visual defaults (the pianoroll's colours) are replaced by the session's colours. The view loads in its own lazy chunk with the rest of Strudel. Checked on a production build (2026-11-14): the minifier **drops comment headers** (including `/*! @license */`) from the page chunks, so the notice is a string that survives: `STRUDEL_NOTICE` in `lib/strudel/output.ts`, written to the console when Strudel starts, and `public/strudel/NOTICE.txt` (served at `/strudel/NOTICE.txt`) names the packages, the licence and the source. The worker bundle keeps its banner (esbuild). The footer's source link is unchanged. We do not use Strudel's name, logo or hosted site as ours: the guide and the player only name and link strudel.cc as the project the code runs as, and say sonorous is not Strudel. Nothing is fetched from strudel.cc at run time except the sample banks listed above, which the browser fetches from their publishers.
