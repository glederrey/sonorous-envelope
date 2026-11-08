import { describe, expect, it } from "vitest";
import { createMcpHandler } from "mcp-handler";
import { registerTools } from "./tools";
import { SERVER_INSTRUCTIONS } from "./instructions";

const handler = createMcpHandler((s) => registerTools(s), { serverInfo: { name: "t", version: "0" }, instructions: SERVER_INSTRUCTIONS });

async function rpc(method: string, params?: object) {
  const res = await handler(new Request("https://app.example/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  const text = await res.text();
  const data = text.startsWith("event:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text;
  return JSON.parse(data);
}

describe("MCP tools", () => {
  it("lists the four tools with compact schemas", async () => {
    const r = await rpc("tools/list");
    const names = r.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["get_feedback", "set_sound", "silence", "start_session"]);
    const set = r.result.tools.find((t: { name: string }) => t.name === "set_sound");
    expect(set.inputSchema.required).toContain("mood");
    expect(JSON.stringify(set.inputSchema).length).toBeLessThan(9000);
  });

  it("does not advertise features that are not built", () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/gesture|purr|pressed calmer|reads_as/i);
  });

  it("answers an unauthenticated tool call with a readable error result", async () => {
    const r = await rpc("tools/call", { name: "start_session", arguments: {} });
    expect(r.result.isError).toBe(true);
    expect(JSON.parse(r.result.content[0].text).error).toBe("unauthorized");
  });

  it("rejects a mood outside 0 to 1", async () => {
    const r = await rpc("tools/call", { name: "set_sound", arguments: { mood: { warmth: 2, closeness: 0, joy: 0, calm: 0, spontaneity: 0 } } });
    expect(r.result?.isError ?? true).toBe(true);
  });
});
