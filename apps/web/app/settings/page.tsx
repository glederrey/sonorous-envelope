import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";
import { SettingsBody, type ConnectedApp } from "./settings-body";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=%2Fsettings");

  const { data } = await supabase.auth.oauth.listGrants();
  // one row per app name: Claude registers a new client each time the connector is added again, so one app can hold many grants
  const apps = new Map<string, ConnectedApp>();
  for (const g of data ?? []) {
    const a = apps.get(g.client.name);
    if (!a) apps.set(g.client.name, { name: g.client.name, ids: [g.client.id], first: g.granted_at, last: g.granted_at });
    else {
      a.ids.push(g.client.id);
      if (g.granted_at < a.first) a.first = g.granted_at;
      if (g.granted_at > a.last) a.last = g.granted_at;
    }
  }
  const grants = [...apps.values()];

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Settings</h1>
        </div>
        <SettingsBody grants={grants} error={error} />
      </main>
    </>
  );
}
