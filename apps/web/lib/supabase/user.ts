import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * The signed-in account, or null. Anonymous users (people who opened a player link) count as signed out:
 * they must not see account pages, skip the login form or authorize a connector.
 */
export async function getSignedInUser(supabase: SupabaseClient): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user && !data.user.is_anonymous ? data.user : null;
}
