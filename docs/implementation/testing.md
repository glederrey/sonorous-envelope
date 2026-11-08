# Testing and acceptance criteria

## Automated tests (Vitest)

### packages/engine
- Determinism: same state + seed → identical buffers (Node).
- No NaN/Infinity, output within ±1 for 1000 random valid states.
- No allocation in `process` (check with a heap snapshot or by instrumenting allocations in a test build).
- Glide: changing cutoff over 4 s produces a monotonic centroid change, no clicks (max sample-to-sample jump below a threshold).
- Arp: note events match the pattern, rate and density for known seeds.
- Each gesture renders under 2.5 s and peaks below −3 dBFS.

### packages/shared
- Mood mapping: monotonicity, bounds, snapshots (mood-mapping.md).
- Limits: each consent level, each clamp rule, the hard colour rule (pulse ≤ 3 Hz) with adversarial inputs (model asks for 12 Hz pulse in "anything" consent → still ≤ 3 Hz).
- Feedback builder: omits empty fields, rounding, length ≤ ~900 characters for a typical state.
- Zod schemas reject out-of-range values with readable errors.

### packages/analysis
- Features on synthetic signals: pure sine at 440 Hz → centroid ≈ 440; silence → density "silent", loudness very low; white noise → high brightness.
- Mood estimate: on the 6 reference moods, each axis's `reads_as` is ordered the same way as intent for at least 4 of 6 pairs.
- Performance: render + analysis < 300 ms.

### apps/web
- `verifyToken`: valid token, expired token, token without `client_id`, wrong issuer.
- Tools: session resolution (missing ID, someone else's ID), rate limit, error shapes.
- RLS: a second user cannot read or write another user's session, states or reactions (run against a local Supabase with the CLI).

### End-to-end (Playwright, one smoke test)
Log in → create a session through the MCP endpoint with a test token → open `/s/<id>` → start listening → call `set_sound` → the page receives the state (check a debug attribute with the state ID) → press "calmer" → `get_feedback` returns it.

## Manual checks
- MCP Inspector: OAuth flow, list tools, call each tool.
- claude.ai web: add the connector, run a conversation of 10+ messages, check the final call happens every message.
- Mobile: open the player on a phone while chatting on the laptop; then chat on the phone with the player in another tab, and note what happens to audio.

## Acceptance criteria per milestone (see roadmap.md)

1. **Foundations:** `pnpm build` and `pnpm test` pass; deployed to Vercel; login works; migration applied; RLS tests pass.
2. **OAuth:** claude.ai can add the connector, the consent page appears, and an authenticated `tools/list` succeeds. A request without a token gets 401 with the `WWW-Authenticate` header.
3. **First tools + player:** in claude.ai, `start_session` returns a working link; `set_sound` changes the sound in the open player within 1 s; glides are smooth; colour follows.
4. **Analysis + feedback:** feedback includes `sound` and `reads_as`; < 300 ms analysis; feedback stays compact.
5. **Listener controls:** reactions appear in the next feedback exactly once; limits clamp server-side and show in `clamped`; owner-only settings are rejected for non-owners.
6. **Gestures:** each gesture plays once per state; the gesture rate limit and gestures-off work.
7. **Mood estimate:** calibration script committed; correlation per axis reported in README.
8. **Several listeners:** invite flow works; reactions labelled; listeners can't change settings.
9. **Final-update hook (Claude Code):** a turn without a final call is blocked and the model is told to make one.
10. **Spectrogram:** image returned only when enabled; size < 80 KB.
11. **Mobile stream:** audio keeps playing with the screen locked on iOS and Android.
