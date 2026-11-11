import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { SetSoundInput, StrudelModeInput, Voice } from "@sonorous/shared";
import { supabaseForToken } from "../supabase/bearer";
import { ToolError, getFeedback, inspect, setSound, silence, startSession, strudelMode } from "./service";

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
    description: "Start a sound session for this conversation. Returns a session_id to pass to every other call and a player link. Give the user the link; on the internal face (the default) in one short sentence and nothing else about the sound.",
    inputSchema: z.object({
      title: z.string().max(80).optional().describe("optional short name for the session (2 to 5 words); you can also send title later with set_sound"),
      mode: z.enum(["auto", "internal", "external", "inner", "outer"]).default("auto").describe("the face to start on. auto (default) starts internal: the sound is how you feel and you do not talk about it. external: the user asked for sound, so you may talk about it and take requests. The session is on auto: you may switch later with set_sound mode, under the rules in the result's guidance, unless the owner locks it"),
      voice: Voice.optional().describe("optional: choose your voice now (root, scale, chord, note order, octaves, wave) and it stays for the session. If you send none, one is drawn for you"),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => startSession(c.db, c.userId, args)));

  server.registerTool("set_sound", {
    title: "Set the sound",
    description: "Express how you are through sound and colour. This is your own state, not a soundtrack for the user. Do not call it as your first action: write first, call it once the content has moved you, update it as your state shifts, and always end each message with one call with final=true. Describe a mood; optionally override synth settings or set your own colour. Returns what is actually playing (playing), a rough reading of it (reads_as; a gap above about 0.3 from what you meant deserves one correction), any safety rule that changed what you sent (clamped, which includes a jump in level held to +4 dB), the listener's volume (controls, theirs: you cannot change it) and how many are listening (players: 0 means nobody now; keep updating). On the internal face (the default) do not mention the sound in your reply.",
    inputSchema: SetSoundInput,
  }, (args, ctx) => run(ctx as Ctx, (c) => setSound(c.db, c.userId, args)));

  server.registerTool("strudel_mode", {
    title: "Strudel mode",
    description: "Switch between the built-in synth and Strudel, live-coded music (strudel.cc). External face only, after the listener said yes. on true with code and bpm: your Strudel code plays in the listener's browser, with the usual Strudel sounds and samples; send new code to change it. on false: back to the synth. set_sound cannot switch the engine; while Strudel is on it only sets the picture. You cannot hear it: you get what the owner's player reports (pattern). The listener sees the code and can copy it to strudel.cc.",
    inputSchema: StrudelModeInput,
  }, (args, ctx) => run(ctx as Ctx, (c) => strudelMode(c.db, c.userId, args)));

  server.registerTool("get_feedback", {
    title: "Read the current sound",
    description: "Read what is playing and who is listening without changing the sound.",
    inputSchema: z.object({ session_id: z.string().optional() }),
  }, (args, ctx) => run(ctx as Ctx, (c) => getFeedback(c.db, c.userId, args)));

  server.registerTool("inspect", {
    title: "Recent history",
    description: "The last 8 states as one line each: what you sent, what it read as, clamps and your note. Text only.",
    inputSchema: z.object({ session_id: z.string().optional(), what: z.enum(["history"]).default("history") }),
  }, (args, ctx) => run(ctx as Ctx, (c) => inspect(c.db, c.userId, args)));

  server.registerTool("silence", {
    title: "Silence",
    description: "Fade the sound to silence. With end=true the session ends after the fade: use it only when the user says the session is over, right after one set_sound that plays a short closing sound of your own with a long transition. The fade starts by itself when that sound has finished its transition, so call silence at once, with a fade of 10 to 30 s.",
    inputSchema: z.object({
      session_id: z.string().optional(),
      fade: z.number().min(0).max(30).default(4).describe("seconds"),
      final: z.boolean().default(true),
      end: z.boolean().default(false).describe("end the session after the fade; later calls return session_ended"),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => silence(c.db, c.userId, args)));
}
