import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";

export const metadata = { title: "Your sessions · Sonorous Envelope" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsessions");

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Your sessions</h1>
        </div>
        <div className="doc-rows">
          <section className="doc-row">
            <h2 className="se-heading">Nothing playing yet</h2>
            <div className="se-stack">
              <p style={{ margin: 0 }}>
                Each conversation you start with the connector turned on gets its own session and a link to its player.
                It will appear here.
              </p>
              <p className="se-sm se-muted" style={{ margin: 0 }}>
                Not connected yet? <a href="/#add">Add it to Claude</a>. Your <a href="/settings">settings</a> list the
                apps that can reach your account.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
