import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { hasSupabaseEnv } from "../lib/env";

export async function SiteHeader() {
  let signedIn = false;
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }
  return (
    <header className="se-header">
      <Link href="/" className="se-lockup">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" width={32} height={32} alt="" />
        sonorous envelope
      </Link>
      <nav>
        {signedIn ? (
          <Link className="se-btn" href="/sessions">Your sessions</Link>
        ) : (
          <Link className="se-btn" href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
