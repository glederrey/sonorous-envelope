import Link from "next/link";
import { createClient } from "../lib/supabase/server";
import { getSignedInUser } from "../lib/supabase/user";
import { hasSupabaseEnv } from "../lib/env";
import { signOut } from "../app/settings/actions";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader({ overlay = false, hideAuth = false }: { overlay?: boolean; hideAuth?: boolean }) {
  let signedIn = false;
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    signedIn = Boolean(await getSignedInUser(supabase));
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
        {signedIn ? (
          <>
            <Link className="se-btn" href="/sessions">Your sessions</Link>
            <form action={signOut}>
              <button type="submit" className="se-btn">Sign out</button>
            </form>
          </>
        ) : hideAuth ? null : (
          <>
            <Link className="se-btn" href="/login">Sign in</Link>
            <Link className="se-btn se-btn-primary" href="/login?mode=signup">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
