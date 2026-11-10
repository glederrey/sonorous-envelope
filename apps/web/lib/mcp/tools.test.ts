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
  it("lists the five tools with compact schemas", async () => {
    const r = await rpc("tools/list");
    const names = r.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(["get_feedback", "inspect", "set_sound", "silence", "start_session"]);
    const set = r.result.tools.find((t: { name: string }) => t.name === "set_sound");
    expect(set.inputSchema.properties).toHaveProperty("mood"); // optional: left out, the last mood stays
    expect(JSON.stringify(set.inputSchema).length).toBeLessThan(9000);
  });

  it("does not advertise features that are not built", () => {
    expect(SERVER_INSTRUCTIONS).not.toMatch(/spectrogram|strudel/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/gesture/i); // built in v0.5
  });

  it("frames the sound as the model's own state, written first, never announced", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/not a soundtrack/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/not .*first action/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/Say nothing about the sound/);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/play to the user|plays to the user/i);
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

  it("serialises the schemas the connector will load: new fields in, volume out, end on silence", async () => {
    const r = await rpc("tools/list");
    const tool = (n: string) => r.result.tools.find((t: { name: string }) => t.name === n);
    const synth = tool("set_sound").inputSchema.properties.synth.properties;
    expect(synth.osc.properties.stack).toBeDefined();
    expect(synth.pad.properties.notes.maxItems).toBe(5);
    expect(synth.lfo.items.properties.rate.maximum).toBe(80);
    expect(synth).not.toHaveProperty("volume");
    expect(tool("set_sound").inputSchema.properties).toHaveProperty("voice");
    expect(tool("set_sound").inputSchema.properties).toHaveProperty("rest_after");
    expect(tool("silence").inputSchema.properties).toHaveProperty("end");
    expect(tool("start_session").inputSchema.properties).toHaveProperty("voice");
    expect(synth.lfo.items.properties.rate.description).toMatch(/stay until you change them.*\[\]/);
    expect(tool("set_sound").inputSchema.properties.colour.description).toMatch(/stays until you change it/);
    expect(JSON.stringify(tool("set_sound").inputSchema).length).toBeLessThan(11000);
  });
});

