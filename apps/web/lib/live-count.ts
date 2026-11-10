import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

export interface LiveCount { sessions: number; listeners: number }

/** "3 sessions live with 5 humans listening", in the right singular and plural. */
export function liveSentence({ sessions, listeners }: LiveCount): string {
  if (sessions < 1 || listeners < 1) return "No session is live right now.";
  const s = sessions === 1 ? "1 session" : `${sessions} sessions`;
  const l = listeners === 1 ? "1 human" : `${listeners} humans`;
  return `${s} live with ${l} listening.`;
}

let cache: { at: number; value: LiveCount | null } | null = null;
const TTL_MS = 20_000;

/** The public counter. Cached for 20 s per server instance, so a busy landing page is one query, not one per visit. Null on any failure: the page then shows nothing. */
export async function getLiveCount(now = Date.now()): Promise<LiveCount | null> {
  if (cache && now - cache.at < TTL_MS) return cache.value;
  let value: LiveCount | null = null;
  try {
    const db = createClient(supabaseUrl(), supabaseAnonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc("live_counts");
    const d = data as { sessions?: unknown; listeners?: unknown } | null;
    if (!error && d && Number.isFinite(d.sessions) && Number.isFinite(d.listeners)) value = { sessions: Number(d.sessions), listeners: Number(d.listeners) };
  } catch { /* leave null */ }
  cache = { at: now, value };
  return value;
}
