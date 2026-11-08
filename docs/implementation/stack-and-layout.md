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
| FFT | `fft.js` (or a small hand-written radix-2 FFT in the engine package) |
| PNG encoding (spectrogram, later) | `pngjs` |
| Tests | Vitest; Playwright for one end-to-end smoke test |

### Why TypeScript for the analysis, not Python
The earlier docs mention a Python analysis function. v1 uses TypeScript instead, because:
- The engine must render identically in the browser and on the server. One TypeScript engine does both.
- No second runtime, no Python cold start on each `set_sound`.
- The v1 features (loudness, centroid, flux, roughness, onset density) are simple to compute.

Python comes back later only if a heavy model (Essentia, Music2Emo) is added, as a separate service.

## Layout

```
sonorous-envelope/
├── CLAUDE.md
├── README.md
├── docs/
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── packages/
│   ├── engine/                  # pure DSP, no DOM, no Node APIs
│   │   ├── src/
│   │   │   ├── types.ts         # SoundState, EffectiveState, etc. (zod schemas live in /shared)
│   │   │   ├── prng.ts          # seeded PRNG (mulberry32)
│   │   │   ├── music.ts         # note names, scales, chords
│   │   │   ├── oscillator.ts    # band-limited (polyBLEP) sine/tri/saw/square
│   │   │   ├── filter.ts        # RBJ biquad (LP/HP/BP)
│   │   │   ├── envelope.ts      # ADSR
│   │   │   ├── lfo.ts
│   │   │   ├── arp.ts           # step scheduler
│   │   │   ├── drone.ts
│   │   │   ├── gestures.ts      # purr, chirp, sigh, hum, pluck, breath
│   │   │   ├── fx.ts            # delay, simple reverb (Freeverb-style)
│   │   │   ├── glide.ts         # parameter smoothing between states
│   │   │   ├── voice.ts
│   │   │   ├── engine.ts        # Engine class: setState(), process(out, frames)
│   │   │   └── render.ts        # renderOffline(state, seconds, sampleRate)
│   │   └── test/
│   ├── shared/                  # used by web + mcp
│   │   └── src/
│   │       ├── schemas.ts       # zod schemas for tool inputs and states
│   │       ├── mood-mapping.ts  # axes → synth params
│   │       ├── limits.ts        # applyLimits(intent, settings) → effective + clamps
│   │       ├── colour.ts        # follow-mode colour derivation
│   │       └── feedback.ts      # builds the compact feedback object
│   └── analysis/                # Node-only analysis on top of engine
│       └── src/
│           ├── features.ts
│           ├── mood-estimate.ts
│           └── spectrogram.ts   # later milestone
├── apps/
│   └── web/                     # Next.js app deployed to Vercel
│       ├── app/
│       │   ├── api/mcp/route.ts                     # MCP endpoint
│       │   ├── .well-known/oauth-protected-resource/route.ts
│       │   ├── .well-known/oauth-protected-resource/api/mcp/route.ts  # path-suffixed variant
│       │   ├── oauth/consent/page.tsx               # OAuth consent page
│       │   ├── login/page.tsx
│       │   ├── auth/callback/route.ts               # Supabase login callback
│       │   ├── sessions/page.tsx                    # list of the user's sessions
│       │   ├── s/[id]/page.tsx                      # player page
│       │   └── settings/page.tsx                    # connected apps, revoke grants
│       ├── lib/
│       │   ├── supabase/server.ts   # server client from cookies
│       │   ├── supabase/browser.ts
│       │   ├── supabase/bearer.ts   # client built from an MCP bearer token (RLS)
│       │   ├── auth/verify-token.ts # JWT verification with jose + JWKS
│       │   └── mcp/                 # tool implementations
│       ├── public/worklet/engine-worklet.js   # built from packages/engine
│       └── components/player/...
└── supabase/
    ├── migrations/0001_init.sql   # copy of docs/implementation/database.sql
    └── config.toml
```

The AudioWorklet must be a standalone script. Build it from `packages/engine` with esbuild into `apps/web/public/worklet/engine-worklet.js` as part of the web build.

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

Keep a `.env.example` with all of them.

Read them lazily, inside functions (`apps/web/lib/env.ts`), never at module scope: CI builds with two placeholder variables and Vercel previews have none, so a module-scope read breaks `next build`.

Next reads env files from `apps/web`, not the repo root. Locally, `apps/web/.env.local` is a symlink to the root `.env` (gitignored; `.worktreeinclude` copies it into worktrees). Next 16 calls the request interceptor `proxy.ts`, not `middleware.ts`.

## Commands (to create)
- `pnpm dev`: Next.js dev server
- `pnpm build`: builds packages, the worklet bundle, then the web app
- `pnpm test`: Vitest across packages
- `pnpm db:push`: apply Supabase migrations (Supabase CLI)
- `pnpm mcp:inspect`: run the MCP Inspector against the local endpoint

## Vercel settings
- Project root: `apps/web`, with pnpm workspace install.
- Node.js 20+ runtime for `/api/mcp` (not Edge: jose, analysis and the engine run in Node).
- Raise `maxDuration` for `/api/mcp` to ~30 s (analysis + DB calls; usually < 2 s).
