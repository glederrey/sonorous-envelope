import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { SetSoundInput } from "@sonorous/shared";
import { supabaseForToken } from "../supabase/bearer";
import { ToolError, getFeedback, setSound, silence, startSession } from "./service";

type Ctx = { http?: { authInfo?: { token?: string; extra?: Record<string, unknown> } } };

function caller(ctx: Ctx) {
  const info = ctx.http?.authInfo;
  const userId = info?.extra?.userId;
  if (!info?.token || typeof userId !== "string") throw new ToolError("unauthorized", "Sign in again to use this tool.");
  return { db: supabaseForToken(info.token), userId };
}

/** Run a tool body: compact JSON out, readable errors as tool results (never protocol errors). */
async function run(ctx: Ctx, body: (c: ReturnType<typeof caller>) => Promise<object>) {
  try {
    const result = await body(caller(ctx));
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
  } catch (e) {
    const err = e instanceof ToolError ? e : new ToolError("server_error", "Something went wrong. Try again.");
    if (!(e instanceof ToolError)) console.error("mcp tool failed:", e);
    const body = { error: err.code, message: err.message };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(body) }], structuredContent: body };
  }
}

export function registerTools(server: McpServer) {
  server.registerTool("start_session", {
    title: "Start a sound session",
    description: "Start a sound session for this conversation. Returns a session_id to pass to every other call and a player link to give the user.",
    inputSchema: z.object({ title: z.string().max(80).optional().describe("optional short label") }),
  }, (args, ctx) => run(ctx as Ctx, (c) => startSession(c.db, c.userId, args)));

  server.registerTool("set_sound", {
    title: "Set the sound",
    description: "Update the sound and colour that play to the user. Call it whenever you want during your turn, and always once with final=true at the end of each message. Describe a mood; optionally override synth settings or set your own colour. Returns what is actually playing, any limits that applied, and the listener's volume and echo settings.",
    inputSchema: SetSoundInput,
  }, (args, ctx) => run(ctx as Ctx, (c) => setSound(c.db, c.userId, args)));

  server.registerTool("get_feedback", {
    title: "Read the current sound",
    description: "Read what is playing and who is listening without changing the sound.",
    inputSchema: z.object({ session_id: z.string().optional() }),
  }, (args, ctx) => run(ctx as Ctx, (c) => getFeedback(c.db, c.userId, args)));

  server.registerTool("silence", {
    title: "Silence",
    description: "Fade the sound to silence.",
    inputSchema: z.object({
      session_id: z.string().optional(),
      fade: z.number().min(0).max(30).default(4).describe("seconds"),
      final: z.boolean().default(true),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => silence(c.db, c.userId, args)));
}
