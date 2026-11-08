import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "../env";

/** Client that acts as the MCP caller, so Row Level Security sees auth.uid() = the user. */
export function supabaseForToken(token: string) {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
