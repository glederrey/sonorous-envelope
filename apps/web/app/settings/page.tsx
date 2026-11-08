import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";
import { getSignedInUser } from "../../lib/supabase/user";
import { revokeGrant, signOut } from "./actions";

export const metadata = { title: "Settings · Sonorous Envelope" };

export default async function SettingsPage() {
  const supabase = await createClient();
  if (!(await getSignedInUser(supabase))) redirect("/login?next=%2Fsettings");

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
        </div>
      </main>
    </>
  );
}
