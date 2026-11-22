import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";
import { revokeGrant, signOut } from "./actions";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=%2Fsettings");

  const { data } = await supabase.auth.oauth.listGrants();
  const grants = data ?? [];

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Settings</h1>
        </div>
        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">Connected apps</h2>
            <div className="se-stack">
              {grants.length === 0 ? (
                <p className="se-muted" style={{ margin: 0 }}>No apps are connected.</p>
              ) : (
                grants.map((grant) => (
                  <form key={grant.client.id} action={revokeGrant} className="se-grant">
                    <div>
                      <strong>{grant.client.name}</strong>
                      <div className="se-sm se-muted">Since {new Date(grant.granted_at).toLocaleDateString("en-GB")}</div>
                    </div>
                    <input type="hidden" name="client_id" value={grant.client.id} />
                    <button type="submit" className="se-btn">Revoke</button>
                  </form>
                ))
              )}
            </div>
          </section>
          <section className="doc-row">
            <h2 className="se-heading">Account</h2>
            <form action={signOut}>
              <button type="submit" className="se-btn">Sign out</button>
            </form>
          </section>
          <section className="doc-row">
            <h2 className="se-heading">Delete account</h2>
            <p className="se-muted" style={{ marginTop: 0 }}>
              This deletes your account and everything in it: every session, every saved moment, and the apps connected to it.
              Shared links stop working. It cannot be undone.
            </p>
            {error === "delete" ? <p className="se-error se-sm" role="alert">The account could not be deleted. Try again.</p> : null}
            <DeleteAccountForm />
          </section>
        </div>
      </main>
    </>
  );
}
