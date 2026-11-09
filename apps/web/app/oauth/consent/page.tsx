import { redirect } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { createClient } from "../../../lib/supabase/server";
import { decide } from "./actions";

export const metadata = { title: "Authorize · Sonorous Envelope" };

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
}) {
  const { authorization_id: id, error } = await searchParams;
  if (error || !id || id.length > 200) {
    return (
      <>
        <SiteHeader />
        <main className="se-narrow se-stack">
          <h1 className="se-title">Authorization failed</h1>
          <p className="se-muted">This request is invalid or has expired. Go back to your AI app and connect again.</p>
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  }

  const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (detailsError || !data) {
    return (
      <>
        <SiteHeader />
        <main className="se-narrow se-stack">
          <h1 className="se-title">Authorization failed</h1>
          <p className="se-muted">This request is invalid or has expired. Go back to your AI app and connect again.</p>
        </main>
      </>
    );
  }
  // Already consented: Supabase hands back the redirect straight away.
  if ("redirect_url" in data) redirect(data.redirect_url);

  const clientName = data.client.name || "An app";
  return (
    <>
      <SiteHeader />
      <main className="se-narrow se-stack">
        <h1 className="se-title">Connect {clientName}?</h1>
        <p>
          <strong>{clientName}</strong> will be able to, on your account{data.user.email ? ` (${data.user.email})` : ""}:
        </p>
        <ul className="se-card se-sm" style={{ margin: 0, paddingLeft: 32 }}>
          <li>create sound sessions</li>
          <li>update the sound and colour</li>
          <li>read your reactions</li>
        </ul>
        <p className="se-sm se-muted">
          It can never go past your own limits. You can revoke access any time in Settings.
        </p>
        <form action={decide} style={{ display: "flex", gap: 12 }}>
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button type="submit" name="decision" value="approve" className="se-btn se-btn-primary">Approve</button>
          <button type="submit" name="decision" value="deny" className="se-btn">Deny</button>
        </form>
      </main>
    </>
  );
}
