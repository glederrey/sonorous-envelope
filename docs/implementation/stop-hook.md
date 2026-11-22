# Final-update hook for Claude Code

The server instructions ask the model to end every message with one `set_sound` call with `final: true`. Models forget, and then the turn counter, `pending_final` and the "no final update last turn" note do the catching up afterwards. In Claude Code a `Stop` hook can catch it before the turn ends.

## What it does

`scripts/claude-code/sonorous-stop-hook.mjs` (Node, no dependencies) runs when Claude is about to stop. It reads the conversation's own transcript (Claude Code passes `transcript_path`) and looks at the Sonorous tool calls (`start_session`, `set_sound`, `strudel_mode`, `silence`, on the claude.ai connector or a local server):

| Situation | Result |
|---|---|
| No Sonorous call in the conversation | stop |
| The last Sonorous call is `silence` (quiet by request, or the session ended) | stop |
| This turn ends with `set_sound`, `strudel_mode` or `moment` recall with `final: true` (`moment` keep and list change no sound and are ignored) | stop |
| This turn's last sound call is not final | block: "your last sound call this turn was not final..." |
| A session is open and this turn has no sound call (or only `start_session`) | block: "a sound session is open and this message has no final sound..." |
| `stop_hook_active` is true (it already blocked once this turn) | stop |

Blocking prints `{"decision":"block","reason":...}`; the reason tells the model to send one final `set_sound` (the same mood if nothing changed) and not to mention it.

## Why the transcript and not the server

The first plan was `GET /api/hook/turn-status?session=<id>`. A hook script has neither the caller's OAuth token (the connector holds it) nor the session id, and the repo rule forbids a service-role or unauthenticated shortcut. The transcript already holds every call and its `final` flag, on the user's own machine. So: no route, no token, nothing sent anywhere.

Two limits, both handled by failing open (the hook never blocks on an error):
- The transcript format is internal to Claude Code and can change. If it does, the hook stops finding calls and lets every stop through.
- The transcript can lag behind at Stop time. Before blocking, the hook reads it again up to three times, 300 ms apart.

## Install

Copy the script somewhere stable, e.g. `~/.claude/hooks/sonorous-stop-hook.mjs`, then add to `~/.claude/settings.json` (or a project's `.claude/settings.json`):

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "f=\"$HOME/.claude/hooks/sonorous-stop-hook.mjs\"; [ ! -f \"$f\" ] || node \"$f\"", "timeout": 10 } ] }
    ]
  }
}
```

The `[ ! -f ... ] ||` guard keeps a missing file from blocking anything. Stop takes no matcher. Subagents have their own `SubagentStop` event, so the hook does not run for them.

## Tests

`scripts/claude-code/sonorous-stop-hook.test.ts` (vitest): the tool names it recognises, each row of the table above, and the script run as a hook (block JSON, nothing when fine, nothing on a missing file or bad input).
