import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "../../../components/account-menu";
import { NavLinks } from "../../../components/nav-links";
import { NavShell } from "../../../components/nav-shell";
import { ThemeToggle } from "../../../components/theme-toggle";
import { SettingsBody, type ConnectedApp } from "../../settings/settings-body";

export const metadata: Metadata = { title: "Account lab", robots: { index: false, follow: false } };

// The signed-in header and the Settings rows (SettingsBody, the same component /settings renders), without signing in: the header markup of SiteHeader with the account
// menu always shown. Nothing here is submitted: the delete button stays disabled until "delete" is typed, so do not type it.
// Claude added 15 times (each time registers a new client), shown as one row; another app connected once. Revoke does nothing here.
const APPS: ConnectedApp[] = [
  { name: "Claude", ids: Array.from({ length: 15 }, (_, i) => `lab-claude-${i}`), first: "2026-11-08T09:00:00Z", last: "2026-11-21T18:00:00Z" },
  { name: "Another app", ids: ["lab-other"], first: "2026-11-12T09:00:00Z", last: "2026-11-12T09:00:00Z" },
];

export default function AccountLab() {
  return (
    <>
      <header className="se-header">
        <Link href="/" className="se-lockup">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" width={32} height={32} alt="" />
          <span className="se-wordmark">sonorous envelope</span>
        </Link>
        <NavShell>
          <NavLinks />
          <ThemeToggle />
          <AccountMenu />
        </NavShell>
      </header>
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Account lab</h1>
          <p className="se-muted">The signed-in header (open the Account menu, or the burger below 900 px) and the Settings rows on made-up apps.</p>
        </div>
        <SettingsBody grants={APPS} />
      </main>
    </>
  );
}
