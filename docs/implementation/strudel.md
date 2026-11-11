# Strudel (roadmap #18)

The model has two engines. The **built-in synth** is its own voice (internal or external face). **Strudel** is live-coded music as on strudel.cc, **external face only**, switched on and off with the tool `strudel_mode`. Decisions by Gael (2026-11-11): tool named `strudel_mode`; samples in v1 so it works as on strudel.cc; the owner's "allow code" switch is on by default; **no sound safety on Strudel** (no loudness governor, no parameter clamps, no 0.9 cap, only the listener's volume); the code is shown collapsed with Copy code and a link to strudel.cc, and cannot be edited on sonorous; the hero page and the guide explain both engines; only `strudel_mode` switches engines (`set_sound` never does).

## The tool
`strudel_mode { session_id?, on, code?, bpm?, colour?, final, title?, note? }` ([mcp-tools.md](mcp-tools.md)). `on: true` writes a state with `engine: "strudel"` and `pattern: { code, bpm }`; **all synth fields stay filled** (the paused synth), because `playingOf`, `hardCaps`, `nextGrid` and `silence` read them. `on: false` writes the synth back. A face change to internal (by the model) or an owner lock writes or shows the synth again, and the player refuses to run a pattern unless the face is external and `allow_code` is true. The server parses the code with acorn (a syntax error comes back in the same result) and never runs it.

## Where the code runs
```
model code -> [worker inside a sandboxed frame] -- haps --> page -- validate --> superdough -> listener volume -> speakers
```
- `public/strudel/frame.html`, served with a CSP (`next.config.ts`): `default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src blob:; connect-src 'none'; sandbox allow-scripts`, embedded as `<iframe sandbox="allow-scripts">` with **no `allow-same-origin`**: an opaque origin, so no storage, cookies, IndexedDB or same-origin requests. `frame.ts` starts a blob worker from source the page sends and relays its messages with a per-load token the code cannot read, rate limited to 600 events a second.
- `strudel/worker.ts` (built to `public/strudel/worker.js` by `pnpm build:strudel`, part of `pnpm build`; run it after changing the worker) loads `@strudel/core`, `mini`, `tonal`, `transpiler`, evaluates the code with Strudel's own `repl`, and runs its own scheduler on the page's clock: it looks 300 ms ahead and posts events (haps), never sound. `Math.random` is seeded from the state's seed. Drawing methods (`pianoroll`, `scope`...) and `setcps` are no-ops that add a note to the report. `samples({...})` is refused; `samples('github:tidalcycles/dirt-samples')` asks the page.
- The page (`lib/strudel/output.ts`) checks each event's shape (`protocol.ts`: known key names, finite numbers, short strings, no limit on loudness or range), plays it with `superdough` into `AudioOutput.strudelBus` (the listener's volume and mute, like the synth's gain), loads samples from the allowed banks only (`banks.ts`, pinned commits), and has a watchdog: no heartbeat for 2.5 s (an endless loop) removes the frame and reports it.
- Checked in Chromium (2026-11-11): fetch, XHR, `importScripts` of another script, IndexedDB, storage, `parent`, a nested worker's fetch are all blocked; a `while(true)` freezes only the worker. A hostile run is in `scripts/strudel-sandbox-check.py`. Not checked: Safari (an opaque-origin blob worker needs a check on a Mac or iPhone).
- Honest limits: the code can burn CPU in its worker (hence the watchdog), can write any text into its own report (it is the model's code, so that is the model's own context), and nothing limits how loud or harsh it is.

## Time and tempo
`bpm` is authoritative (`setcps` is ignored); one cycle is one bar of four beats, `cps = bpm / 240`. The cycle position comes from the shared timeline (`beatsAt(state, tau) / 4`, with `grid.beat` carried through engine switches), so devices hear the same bar. A pattern starts on the **next bar**; there is **no tempo glide** (`beatsAt` and `tempoAt` return `pattern.bpm` for a Strudel state), so the picture follows the music. Events are scheduled `latency` early, as the picture is drawn `latency` late.

## What the model learns
No `reads_as` or spectrogram (Strudel renders only in a browser). The owner's player reports what the code did through `report_pattern` (error text, events per cycle, sounds used, shimmed calls), once per state, and only the session owner can write it: a link listener must not put text into the model's context. It returns as `pattern` in `strudel_mode`, `get_feedback` and the next call, labelled `source: "the owner's player"`; with nobody listening it says it has not run.

## Listener side
Collapsed "Strudel code" panel in the player: read-only code, **Copy code** (adds `setcps(bpm/60/4)` when the code has no tempo, so it sounds the same there), **Open in Strudel** (strudel.cc with the code in the URL hash: base64, URL-encoded), and **Stop pattern** (local to the device). The owner has "Let the model play Strudel code" in the player. The panel notes that the code is the model's and not covered by our licence.

## Tests
Unit: `lib/strudel/strudel.test.ts` (hap and report checks, banks, copy link, beat), `lib/mcp/strudel-code.test.ts`. Integration (real Postgres, `scripts/test-api.sh`): faces and locks, code off, syntax errors, engine switches and the beat, `set_sound` while Strudel is on, the report's permissions. Browser: `scripts/strudel-sandbox-check.py`.
