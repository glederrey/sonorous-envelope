import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { CopyLink } from "../../components/copy-link";
import { createClient } from "../../lib/supabase/server";

export const metadata = { title: "Your sessions · Sonorous Envelope" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsessions");

  const { data: rows } = await supabase.from("sessions").select("id,title,last_active_at,ended_at")
    .eq("owner_id", data.user.id).order("last_active_at", { ascending: false }).limit(50);
  const sessions = rows ?? [];

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Your sessions</h1>
        </div>
        <div className="doc-rows">
          {sessions.length === 0 ? (
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
          ) : (
            sessions.map((s) => (
              <section className="doc-row" key={s.id}>
                <h2 className="se-heading">{s.title || "Untitled session"}</h2>
                <div className="se-stack">
                  <p className="se-sm se-muted" style={{ margin: 0 }}>
                    {s.ended_at ? "Ended" : "Active"} · last sound {new Date(s.last_active_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!s.ended_at && <a className="se-btn se-btn-primary" href={`/s/${s.id}`}>Open player</a>}
                    {!s.ended_at && <CopyLink path={`/s/${s.id}`} label="Copy link to share" />}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </main>
    </>
  );
}
