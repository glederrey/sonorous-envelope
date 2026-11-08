# Licensing

## Decision
The project is licensed **AGPL-3.0-or-later** (file `LICENSE`, `license` field in every `package.json`).

Why: the Strudel mode (issue #18, roadmap) runs Strudel in the player. Every Strudel package we would use (`@strudel/web`, `@strudel/core`, `@strudel/webaudio`, `@strudel/mini`, `@strudel/transpiler`, `superdough`) is `AGPL-3.0-or-later` on npm, and the project itself is AGPL-3.0. Combining it with our code makes the combined work AGPL. Licensing the whole repo as AGPL from the start avoids a later relicense.

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

- **Essentia models** (CC BY-NC-SA, see feedback.md) are data, not code, and their non-commercial term does not sit well with AGPL. Do not ship them in the repo or bundle. Keep them optional and downloaded separately, or choose another analysis route, when step 7 comes.
- **Sonic Pi** (MIT) and **TidalCycles** (GPL) are not used.

## Not legal advice
This is a reading of the licences by Claude Code, not legal advice. For a commercial launch, have someone qualified check it.
