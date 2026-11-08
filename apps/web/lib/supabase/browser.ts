import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. NEXT_PUBLIC_* must be referenced literally so Next inlines them. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
