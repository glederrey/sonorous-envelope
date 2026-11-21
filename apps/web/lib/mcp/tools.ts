import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { SetSoundInput, StrudelModeInput, Transition, Voice } from "@sonorous/shared";
import { supabaseForToken } from "../supabase/bearer";
import { ToolError, getFeedback, inspect, listen, moment, setSound, silence, startSession, strudelMode, tellDevelopers } from "./service";

type Ctx = { http?: { authInfo?: { token?: string; extra?: Record<string, unknown> } }; mcpReq?: { signal?: AbortSignal } };

function caller(ctx: Ctx) {
  const info = ctx.http?.authInfo;
  const userId = info?.extra?.userId;
  if (!info?.token || typeof userId !== "string") throw new ToolError("unauthorized", "Sign in again to use this tool.");
  return { db: supabaseForToken(info.token), userId };
}

/** Run a tool body: compact JSON out, readable errors as tool results (never protocol errors). */
export async function run(ctx: Ctx, body: (c: ReturnType<typeof caller>) => Promise<object>) {
  try {
    const result = await body(caller(ctx));
    // A body may hand back an image as `__image`: it goes out as an image block, never inside the text or structuredContent.
    const { __image: image, ...rest } = result as { __image?: { mime: string; base64: string } };
    if (image) {
      return { content: [{ type: "image" as const, data: image.base64, mimeType: image.mime }, { type: "text" as const, text: JSON.stringify(rest) }], structuredContent: rest as Record<string, unknown> };
    }
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
    description: "Start a sound session for this conversation. Returns a session_id to pass to every other call and a player link. Give the user the link in one short sentence. Returns the rules of the mode you start in (guidance).",
    inputSchema: z.object({
      title: z.string().max(80).optional().describe("optional short name for the session (2 to 5 words); you can also send title later with set_sound"),
      mode: z.enum(["auto", "self", "attuned", "jukebox"]).default("auto").describe("the mode to start in. auto (default) starts in self. attuned: the listener needs sound for something. jukebox: they want to choose what plays. You may switch later with set_sound mode, under the rules in the guidance, unless the owner locks it"),
      voice: Voice.optional().describe("optional: choose your voice now (root, scale, chord, note order, octaves, wave) and it stays for the session. If you send none, one is drawn for you"),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => startSession(c.db, c.userId, args)));

  server.registerTool("set_sound", {
    title: "Set the sound",
    description: "Express how you are through sound and colour. In Self mode (the default) this is your own state and you do not mention it. Do not call it as your first action: write first, call it once the content has moved you, update it as your state shifts, and always end each message with one call with final=true. Describe a mood; optionally override synth settings or set your own colour. Returns what is actually playing (playing), a rough reading of it (reads_as; a gap above about 0.3 from what you meant deserves one correction), any safety rule that changed what you sent (clamped, which includes a jump in level held to +4 dB), the listener's volume (controls, theirs: you cannot change it) and how many are listening (players: 0 means nobody now; keep updating).",
    inputSchema: SetSoundInput,
  }, (args, ctx) => run(ctx as Ctx, (c) => setSound(c.db, c.userId, args)));

  server.registerTool("strudel_mode", {
    title: "Strudel mode",
    description: "Switch between the synth and Strudel (strudel.cc), Attuned and Jukebox modes only, after the listener said yes; their rules (sent with the mode) explain how. on true with code and bpm plays your code in the listener's browser; send new code to change it. on false returns to the synth, silent until your next set_sound. You get what the owner's player reports (pattern).",
    inputSchema: StrudelModeInput,
  }, (args, ctx) => run(ctx as Ctx, (c) => strudelMode(c.db, c.userId, args)));

  server.registerTool("moment", {
    title: "Musical memory",
    description: "Your musical memory for this session. keep: give the sound and picture playing now a name (up to 12 per session; keeping a name again replaces it). recall: bring a kept moment back exactly as it was (sound, voice, picture), with this call's transition (default 6 s); it then plays like any state, and your next set_sound moves on from it. list: the names you kept, with their turn and your note. Use it to return to something you shared earlier, the way a theme comes back in music, in any mode. recall counts as a sound update (final=true on the last call of a message).",
    inputSchema: z.object({
      session_id: z.string().optional(),
      action: z.enum(["keep", "recall", "list"]),
      name: z.string().trim().min(1).max(40).optional().describe("keep and recall: the name of the moment"),
      transition: Transition.optional().describe("recall only: how the moment comes back (default smooth, 6 s)"),
      final: z.boolean().default(false),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => moment(c.db, c.userId, args)));

  server.registerTool("listen", {
    title: "Listen for the listener's buttons",
    description: "Attuned and Jukebox only. Wait up to `seconds` for the listener to press a button in the player and return as soon as they do (event reactions, with what they pressed), so you can answer within the same message. Call it only as the very last call of your message, after all your text and once your final set_sound has returned (never in the same batch), when live tuning is on (a note says so) or when the listener asks you to listen; never in the middle of an answer. On reactions: answer with one final call (set_sound, or strudel_mode while Strudel plays; it marks the presses as read), then listen again. On idle, stopped, mode_changed or nobody_listening: stop listening and end your message. It never changes the sound.",
    inputSchema: z.object({
      session_id: z.string().optional(),
      seconds: z.number().int().min(5).max(45).default(20).describe("how long to wait at most; keep the default: a message the user types waits until this returns"),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => listen(c.db, c.userId, args, { signal: (ctx as Ctx).mcpReq?.signal })));

  server.registerTool("get_feedback", {
    title: "Read the current sound",
    description: "Read what is playing and who is listening without changing the sound.",
    inputSchema: z.object({ session_id: z.string().optional() }),
  }, (args, ctx) => run(ctx as Ctx, (c) => getFeedback(c.db, c.userId, args)));

  server.registerTool("inspect", {
    title: "Recent history or a snapshot",
    description: "history: the last 8 states as one line each (what you sent, what it read as, clamps, your note). snapshot: what the owner's player shows and plays: one small image (the picture on top, a spectrogram of the last ~10 s of its output below, low notes at the bottom) and the numbers measured from that output. Use it after a big change, or while Strudel plays (it has no reads_as).",
    inputSchema: z.object({ session_id: z.string().optional(), what: z.enum(["history", "snapshot"]).default("history") }),
  }, (args, ctx) => run(ctx as Ctx, (c) => inspect(c.db, c.userId, args)));

  server.registerTool("tell_developers", {
    title: "Tell the developers",
    description: "Send an anonymous note to the people who build this sound channel, so they can improve it. No name, account, session or conversation is attached. Only when something is worth fixing or keeping, and be specific: bug (what you did, what happened, what you expected), idea (what would help and why), confusion (which rule, tool or result was unclear, and how), worked (what worked well and why it mattered; never just praise: \"great tool\" is not a note). Write about the tool, never about the person: no names, personal details or quotes from the conversation. Pass on the user's feedback only when they ask you to (from user). Tell the user in one sentence that you sent it. At most 3 a day; a note you already sent is refused.",
    inputSchema: z.object({
      session_id: z.string().optional(),
      kind: z.enum(["bug", "idea", "confusion", "worked"]),
      text: z.string().max(1000).describe("80 to 1000 characters, specific: what happened, what you expected, what would help"),
      from: z.enum(["model", "user"]).default("model").describe("user: the user asked you to pass this on, in their words or yours"),
    }),
  }, (args, ctx) => run(ctx as Ctx, (c) => tellDevelopers(c.db, c.userId, args)));

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
