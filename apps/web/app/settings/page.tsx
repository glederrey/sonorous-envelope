import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";
import { revokeGrant, signOut } from "./actions";

export const metadata = { title: "Settings · Sonorous Envelope" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=%2Fsettings");

  const { data } = await supabase.auth.oauth.listGrants();
  const grants = data ?? [];

  return (
    <>
      <SiteHeader />
      <main className="se-page se-stack">
        <h1 className="se-title">Settings</h1>

        <section className="se-stack">
          <h2 className="se-heading">Connected apps</h2>
          {grants.length === 0 ? (
            <p className="se-muted">No apps are connected.</p>
          ) : (
            grants.map((grant) => (
              <form key={grant.client.id} action={revokeGrant} className="se-card" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <strong>{grant.client.name}</strong>
                  <div className="se-sm se-muted">Since {new Date(grant.granted_at).toLocaleDateString("en-GB")}</div>
                </div>
                <input type="hidden" name="client_id" value={grant.client.id} />
                <button type="submit" className="se-btn">Revoke</button>
              </form>
            ))
          )}
        </section>

        <form action={signOut}>
          <button type="submit" className="se-btn">Sign out</button>
        </form>
      </main>
    </>
  );
}
