import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "../../../components/account-menu";
import { NavLinks } from "../../../components/nav-links";
import { NavShell } from "../../../components/nav-shell";
import { ThemeToggle } from "../../../components/theme-toggle";
import { DeleteAccountForm } from "../../settings/delete-account-form";

export const metadata: Metadata = { title: "Account lab", robots: { index: false, follow: false } };

// The signed-in header and the Settings delete section, without signing in: the header markup of SiteHeader with the account
// menu always shown. Nothing here is submitted: the delete button stays disabled until "delete" is typed, so do not type it.
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
          <p className="se-muted">The signed-in header (open the Account menu, or the burger below 900 px) and the delete section of Settings.</p>
        </div>
        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">Delete account</h2>
            <div className="se-stack">
              <p className="se-muted" style={{ margin: 0 }}>
                This deletes your account and everything in it: every session, every saved moment, and the apps connected to it. Shared links stop working. It cannot be undone.
              </p>
              <DeleteAccountForm />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
