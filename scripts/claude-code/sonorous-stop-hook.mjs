#!/usr/bin/env node
// Claude Code Stop hook for Sonorous Envelope (docs/implementation/stop-hook.md).
//
// The server instructions ask the model to end every message with one set_sound call with final=true. Models forget. This hook reads
// the conversation's own transcript (Claude Code passes its path), so it needs no token and never calls the server: if a sound session
// is live and this turn did not end with a final set_sound (or strudel_mode), it blocks the stop once and tells the model to send it.
//
// It lets the stop through when: no Sonorous tool was ever called, the last Sonorous call was `silence` (the user asked for quiet, or
// the session ended), the hook already blocked once this turn (`stop_hook_active`), or anything goes wrong (it fails open).

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SOUND_TOOLS = new Set(["start_session", "set_sound", "strudel_mode", "silence", "moment"]);

/** The Sonorous tool a tool_use calls, or null. Connector names look like `mcp__claude_ai_Sonorous_Envelope__set_sound`, a local
 *  server like `mcp__sonorous-envelope__set_sound`. */
export function soundTool(name) {
  if (typeof name !== "string" || !name.startsWith("mcp__") || !/sonorous/i.test(name)) return null;
  const tool = name.slice(name.lastIndexOf("__") + 2);
  return SOUND_TOOLS.has(tool) ? tool : null;
}

/** A message the user typed (not a tool result handed back to the model). */
function isUserTurn(entry) {
  if (entry?.type !== "user" || entry.isMeta) return false;
  const c = entry.message?.content;
  if (typeof c === "string") return true;
  return Array.isArray(c) && !c.some((b) => b?.type === "tool_result");
}

/** Decide from the transcript entries (parsed JSONL lines). Returns null to let the stop through, or the reason to block it. */
export function decide(entries, stopHookActive = false) {
  if (stopHookActive) return null;
  let lastUser = -1;
  const calls = []; // { at, tool, input }
  entries.forEach((e, at) => {
    if (isUserTurn(e)) { lastUser = at; return; }
    if (e?.type !== "assistant" || !Array.isArray(e.message?.content)) return;
    for (const b of e.message.content) {
      const tool = b?.type === "tool_use" ? soundTool(b.name) : null;
      if (tool && !(tool === "moment" && b.input?.action !== "recall")) calls.push({ at, tool, input: b.input ?? {} }); // keep and list change no sound
    }
  });
  if (!calls.length) return null; // no sound in this conversation
  const last = calls[calls.length - 1];
  if (last.tool === "silence") return null; // quiet by request, or the session is over: stay quiet
  const thisTurn = calls.filter((c) => c.at > lastUser);
  const end = thisTurn[thisTurn.length - 1];
  if (end && (end.tool === "set_sound" || end.tool === "strudel_mode" || end.tool === "moment") && end.input.final === true) return null; // a final recall is a final sound
  if (end && end.tool !== "start_session") {
    return "Sonorous Envelope: your last sound call this turn was not final. End the message with one set_sound call with final=true (the same mood again if nothing changed). Do not mention this in your reply.";
  }
  return "Sonorous Envelope: a sound session is open and this message has no final sound. End it with one set_sound call with final=true (the same mood again if nothing changed). Do not mention this in your reply.";
}

function read(path) {
  const entries = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* a line being written */ }
  }
  return entries;
}

async function main() {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (!input.transcript_path) return;
    const active = input.stop_hook_active === true;
    let reason = decide(read(input.transcript_path), active);
    // The transcript can lag behind at Stop time (hooks reference): before blocking, give the last lines a moment to land and look again.
    for (let i = 0; reason && i < 3; i++) {
      await new Promise((r) => setTimeout(r, 300));
      reason = decide(read(input.transcript_path), active);
    }
    if (reason) process.stdout.write(JSON.stringify({ decision: "block", reason }));
  } catch {
    // fail open: never trap a session over a hook error (the transcript format is internal to Claude Code and may change)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main();
