import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { hasSupabaseEnv } from "../lib/env";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader({ overlay = false, hideAuth = false }: { overlay?: boolean; hideAuth?: boolean }) {
  let signedIn = false;
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }
  return (
    <header className={overlay ? "se-header se-header-overlay" : "se-header"}>
      <Link href="/" className="se-lockup">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" width={32} height={32} alt="" />
        <span className="se-wordmark">sonorous envelope</span>
      </Link>
      <nav className="se-nav">
        <NavLinks />
        <ThemeToggle />
        {hideAuth ? null : signedIn ? (
          <Link className="se-btn" href="/sessions">Your sessions</Link>
        ) : (
          <Link className="se-btn" href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
