# Stack and repository layout

## Stack

| Part | Choice |
|---|---|
| Language | TypeScript (strict) everywhere in v1 |
| Monorepo | pnpm workspaces |
| Web app + MCP endpoint | Next.js (App Router) on Vercel |
| MCP | `mcp-handler` 2.x (Vercel) + `@modelcontextprotocol/server` v2, Streamable HTTP transport (no SSE, no Redis) |
| Validation | zod 4 |
| Database, live updates, auth | Supabase (Postgres, Realtime, Auth with the OAuth 2.1 server) |
| JWT verification | `jose` |
| Audio in the browser | AudioWorklet running the shared engine |
| Audio on the server | The same engine, rendered offline in Node |
| FFT | a small radix-2 FFT inside `packages/shared/src/analysis.ts` |
| Tests | Vitest |

### Why TypeScript for the analysis, not Python
- The engine must render identically in the browser and on the server. One TypeScript engine does both.
- No second runtime, no Python cold start on each `set_sound`.
- The features (loudness, centroid, flux, roughness, onset density) are simple to compute.

Everything stays in TypeScript (Gael's decision): no Python service and no external emotion model.

## Architecture

An LLM cannot play sound. It can only call tools, and only during its turn. So the sound lives in a separate player that keeps running between turns, and the model talks to it through an MCP server. Everything lives in the MCP: the tools, the state, the feedback, and the guidance on how to use them (the server's `instructions`). There is no separate skill.

```
 ┌──────────┐ Streamable HTTP ┌──────────────────────┐   write    ┌───────────────────┐
 │  Claude  │ ──────────────▶ │ Vercel               │ ─────────▶ │ Supabase          │
 │ (any app)│ ◀────────────── │  /api/mcp (tools)    │ ◀───────── │  Postgres (state, │
 └──────────┘  feedback       │  analysis (in /mcp)  │   read     │   reactions, logs)│
                              │  web app (player)    │            │  Realtime         │
                              └──────────────────────┘            │  Auth (OAuth 2.1) │
                                                                  └─────────┬─────────┘
                                                        live push / reactions│
                                                                  ┌─────────▼─────────┐
                                                                  │ Player (browser)  │──▶ speakers + screen
                                                                  │ Web Audio + canvas│◀── listener controls
                                                                  └───────────────────┘
```

**Remote first.** On claude.ai an MCP server is a custom connector, and Claude reaches it from Anthropic's cloud, not from the user's device. Local (stdio) servers only work in Claude Desktop. So the server is remote, with a public URL and the Streamable HTTP transport. One deployment works in claude.ai on the web and mobile, Claude Desktop and Claude Code.

### Components
- **MCP endpoint** (Vercel, `/api/mcp`). Exposes the tools ([mcp-tools.md](mcp-tools.md)) authenticated with OAuth ([auth.md](auth.md)). Writes each new state to Supabase, reads pending reactions and the latest analysis, and returns compact feedback. Carries the usage guidance in its `instructions` ([server-instructions.md](server-instructions.md)).
- **Analysis** (inside the MCP endpoint). Renders a few seconds of the effective state offline with the same engine the player uses, and computes the features and the mood estimate ([engine.md](engine.md), [analysis.md](analysis.md)). One engine for browser and server means the feedback describes what the listener hears.
- **Player** (web app, `/s/<session_id>`). Open to anyone with the link. Web Audio (the shared engine in an AudioWorklet) and a canvas for the colour field. Subscribes to the session's Realtime channel and glides to each new state over its transition time. The owner also gets reactions, the mode lock and settings; listeners can only listen and set their own volume and mute (auth.md, "Owner and listeners"; [player-ui.md](player-ui.md)).
- **Supabase.** Postgres for users, sessions, states, reactions and settings, protected with Row Level Security ([database.md](database.md)). Realtime for the live link from the MCP endpoint to the players, since Vercel functions are short-lived and cannot hold a connection open ([realtime.md](realtime.md)). Auth as the OAuth 2.1 server for the connector and the login for the web app.

### Session flow
1. **Activation.** The user turns the connector on at the start of a conversation. The model calls `start_session`, which creates a session and returns its id and player link. The user opens the link and taps once to start audio.
2. **During a turn.** The model may call `set_sound` whenever it wants, including in the middle of its reasoning. The user reads the answer while it is being written, so they hear the sound change as the answer forms.
3. **End of a turn.** The model makes one last call with `final: true`. That state plays while the user reads and replies.
4. **Between turns.** The player keeps playing the final state. Reactions are stored and returned on the next call.

One update: Claude calls `set_sound` with its access token. The endpoint checks the token and that the session belongs to that user, maps the mood, applies the limits and writes the state. Supabase Realtime nudges every player open on the session, and each reads the state. The endpoint runs the analysis, reads new reactions and returns the feedback.

Every call carries the `session_id`. Claude does not tell the server which conversation a call comes from, so the id returned by `start_session` travels with each call. If it is missing, the server falls back to the user's most recent open session and says so in the feedback.

Each `set_sound` sends a complete state rather than a patch, so each update is self-contained and nothing drifts.

**The final update.** The rule is in the server `instructions`, which load with the connector; models follow it well but not perfectly. In Claude Code a Stop hook checks it ([stop-hook.md](stop-hook.md)). If a turn ends without a final call, the server keeps the last state and notes it in the next feedback ("no final update last turn").

## Layout

```
sonorous-envelope/
├── CLAUDE.md, README.md, LICENSE
├── docs/                        # this documentation (docs/brand: logo and tokens)
├── package.json                 # pnpm workspace root: scripts
├── pnpm-workspace.yaml
├── packages/
│   ├── engine/                  # pure DSP, no DOM, no Node APIs
│   │   ├── src/
│   │   │   ├── types.ts         # EngineState, NoteEvent, ResolvedColour
│   │   │   ├── defaults.ts      # the default state
│   │   │   ├── prng.ts          # seeded PRNG (mulberry32)
│   │   │   ├── music.ts         # note names, scales, chords
│   │   │   ├── oscillator.ts    # band-limited sine/tri/saw/square
│   │   │   ├── filter.ts        # RBJ biquad
│   │   │   ├── lfo.ts
│   │   │   ├── fx.ts            # delay, reverb
│   │   │   ├── layer.ts         # an arpeggiator layer (foreground and bass)
│   │   │   ├── motif.ts         # the one-shot phrase voice
│   │   │   ├── ramp.ts          # tempo and rate glide, closed-form step counts
│   │   │   ├── engine.ts        # Engine class: setState(), process(out, frames)
│   │   │   ├── render.ts        # renderOffline(state, opts)
│   │   │   ├── worklet.ts       # AudioWorklet wrapper
│   │   │   └── index.ts
│   │   └── test/
│   └── shared/                  # used by the web app and the MCP endpoint
│       ├── src/
│       │   ├── schemas.ts       # zod schemas for tool inputs and states
│       │   ├── mood-mapping.ts  # axes → engine state, colour, scene
│       │   ├── voice-band.ts    # wave and scale bands of an auto-drawn voice
│       │   ├── limits.ts        # applyLimits, hardCaps
│       │   ├── analysis.ts      # features and mood estimate (reads_as)
│       │   ├── feedback.ts      # builds the compact feedback object
│       │   ├── grid.ts          # shared timeline counters
│       │   ├── sticky.ts        # what a session keeps between calls
│       │   ├── reactions.ts, emojis.ts, rest.ts
│       │   ├── visual.ts, scenes.ts, scene-kit.ts, colour-math.ts, gradients.ts   # the picture
│       │   └── util.ts, index.ts
│       └── test/
├── apps/
│   └── web/                     # Next.js app deployed to Vercel
│       ├── app/
│       │   ├── api/mcp/route.ts                         # MCP endpoint
│       │   ├── .well-known/oauth-protected-resource/    # metadata, plus the path-suffixed variant
│       │   ├── oauth/consent/                           # OAuth consent page
│       │   ├── login/, auth/callback/                   # web login
│       │   ├── sessions/, settings/, moments/           # the owner's pages
│       │   ├── s/[id]/                                  # player page
│       │   ├── m/[id]/                                  # a saved moment
│       │   ├── dev/                                     # calibration pages (visuals, controls, player, strudel...)
│       │   └── page.tsx, add/, modes/, how-it-works/, privacy/   # public pages
│       ├── components/          # player/ (the player UI), moment/, site header and footer
│       ├── lib/
│       │   ├── supabase/        # server (cookies), browser, bearer (MCP token, RLS), proxy
│       │   ├── auth/verify-token.ts   # JWT verification with jose + JWKS
│       │   ├── mcp/             # tools.ts, service.ts, modes.ts, instructions.ts, turn.ts, guidance/
│       │   ├── strudel/, snapshot/    # Strudel output and the picture snapshot
│       │   └── env.ts, volume.ts, beat-clock.ts, ...
│       ├── strudel/             # the sandboxed frame and worker sources
│       ├── public/              # worklet/ and strudel/*.js are built, not tracked
│       └── proxy.ts
├── emails/                      # auth email templates (build.mjs, dist/)
├── scripts/                     # calibrate-analysis, fit-warmth, render-moods, test-db.sh, test-api.sh, claude-code/ stop hook
└── supabase/
    ├── migrations/              # the schema; the truth
    ├── revert/                  # a down script per migration
    └── tests/rls.sql
```

The AudioWorklet must be a standalone script. `pnpm build:worklet` builds it from `packages/engine` with esbuild into `apps/web/public/worklet/engine-worklet.js`; `pnpm build` runs it first.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | public anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | only for the few tasks listed in database.md |
| `SUPABASE_AUTH_ISSUER` | server | `https://<project-ref>.supabase.co/auth/v1` |
| `SUPABASE_JWKS_URL` | server | JWKS endpoint of the project (verify the exact path) |
| `PUBLIC_BASE_URL` | server | e.g. `https://sonorous-envelope.vercel.app`, used in links and metadata |
| `MCP_RESOURCE_URL` | server | `${PUBLIC_BASE_URL}/api/mcp` |
| `APP_VERSION` | build | Release tag shown in the footer. Set by the deploy workflow; unset means "dev". Exposed as `NEXT_PUBLIC_APP_VERSION`. |

Keep a `.env.example` with all of them.

Read them lazily, inside functions (`apps/web/lib/env.ts`), never at module scope: CI builds with two placeholder variables and Vercel previews have none, so a module-scope read breaks `next build`.

Next reads env files from `apps/web`, not the repo root. Locally, `apps/web/.env.local` is a symlink to the root `.env` (gitignored; `.worktreeinclude` copies it into worktrees). Next 16 calls the request interceptor `proxy.ts`, not `middleware.ts`.

## Commands
- `pnpm dev`: Next.js dev server
- `pnpm build`: builds the worklet and the Strudel bundles, then the web app
- `pnpm typecheck`, `pnpm test`: TypeScript across packages, Vitest
- `pnpm emails`: rebuild `emails/dist/` (auth.md, "Auth emails")
- `pnpm calibrate`, `pnpm fit-warmth`, `pnpm render:moods`, `pnpm samples:loudness`: calibration scripts for the analysis and the mapping
- `scripts/test-db.sh`: migrations and RLS tests in a throwaway Postgres (needs Docker); `scripts/test-api.sh`: the MCP tool code against a real Postgres (needs Docker)
- Migrations are applied by the deploy workflow (`supabase db push`); there is no local push script.
- `npx @modelcontextprotocol/inspector` runs the MCP Inspector against the endpoint.

## Vercel settings
- Project root: `apps/web`, with pnpm workspace install.
- Node.js runtime for `/api/mcp` (not Edge: jose, analysis and the engine run in Node).
- `maxDuration` for `/api/mcp` is 60 s (analysis + DB calls; usually < 2 s). Render plus analysis should stay under 300 ms.
- Costs to watch: Realtime message quotas on Supabase's free tier (one message per update, plus reactions), and cold starts adding latency to `set_sound`.
