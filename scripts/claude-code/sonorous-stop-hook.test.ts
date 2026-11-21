import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain ESM script, no types
import { decide, soundTool } from "./sonorous-stop-hook.mjs";

const T = "mcp__claude_ai_Sonorous_Envelope__";
const user = (text: string) => ({ type: "user", message: { role: "user", content: text } });
const result = () => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "{}" }] } });
const call = (tool: string, input: Record<string, unknown> = {}, prefix = T) =>
  ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "..." }, { type: "tool_use", id: "x", name: prefix + tool, input }] } });
const say = () => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hello" }] } });

describe("Sonorous Stop hook", () => {
  it("recognises the connector and a local server, nothing else", () => {
    expect(soundTool(`${T}set_sound`)).toBe("set_sound");
    expect(soundTool("mcp__sonorous-envelope__silence")).toBe("silence");
    expect(soundTool(`${T}get_feedback`)).toBeNull();
    expect(soundTool("mcp__other__set_sound")).toBeNull();
    expect(soundTool("Bash")).toBeNull();
  });

  it("lets a conversation with no sound stop", () => {
    expect(decide([user("hi"), say()])).toBeNull();
  });

  it("lets the stop through when the turn ends with a final set_sound or strudel_mode", () => {
    expect(decide([user("hi"), call("start_session"), result(), call("set_sound", { final: true }), result(), say()])).toBeNull();
    expect(decide([user("hi"), call("strudel_mode", { on: true, final: true }), result(), say()])).toBeNull();
  });

  it("blocks when the last sound call of the turn is not final", () => {
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), user("more"), call("set_sound", { final: false }), result(), say()])).toMatch(/not final/);
  });

  it("blocks when a session is open and the turn has no sound call, or only start_session", () => {
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), say(), user("and now?"), say()])).toMatch(/no final sound/);
    expect(decide([user("hi"), call("start_session"), result(), say()])).toMatch(/no final sound/);
  });

  it("counts a final moment recall as the final sound, and ignores keep and list", () => {
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), user("back"), call("moment", { action: "recall", name: "a", final: true }), result(), say()])).toBeNull();
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), call("moment", { action: "keep", name: "a" }), result(), say()])).toBeNull();
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), user("more"), call("moment", { action: "list" }), result(), say()])).toMatch(/no final sound/);
  });

  it("stays quiet after silence, and never blocks twice", () => {
    expect(decide([user("hi"), call("set_sound", { final: true }), result(), user("stop"), call("silence", { final: true }), result(), say(), user("thanks"), say()])).toBeNull();
    expect(decide([user("hi"), call("set_sound", { final: false }), result(), say()], true)).toBeNull();
  });

  it("runs as a hook: block JSON on stdout, nothing when fine, nothing on bad input", () => {
    const dir = mkdtempSync(join(tmpdir(), "se-hook-"));
    const bad = join(dir, "bad.jsonl"), ok = join(dir, "ok.jsonl");
    writeFileSync(bad, [user("hi"), call("set_sound", { final: false }), result(), say()].map((l) => JSON.stringify(l)).join("\n"));
    writeFileSync(ok, [user("hi"), call("set_sound", { final: true }), result(), say()].map((l) => JSON.stringify(l)).join("\n") + "\n{partial");
    const run = (stdin: string) => spawnSync(process.execPath, [join(__dirname, "sonorous-stop-hook.mjs")], { input: stdin, encoding: "utf8" });
    const blocked = run(JSON.stringify({ transcript_path: bad, stop_hook_active: false }));
    expect(blocked.status).toBe(0);
    expect(JSON.parse(blocked.stdout)).toMatchObject({ decision: "block", reason: expect.stringMatching(/final=true/) });
    expect(run(JSON.stringify({ transcript_path: ok })).stdout).toBe("");
    expect(run(JSON.stringify({ transcript_path: join(dir, "missing.jsonl") })).stdout).toBe("");
    expect(run("not json").status).toBe(0);
  });
});
