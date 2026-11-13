import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { CopyLink } from "../../components/copy-link";
import { createClient } from "../../lib/supabase/server";
import { ago, isOlder, sessionStatus } from "../../lib/session-status";
import { endSession } from "./actions";

export const metadata = { title: "Your sessions · Sonorous Envelope" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsessions");

  const { data: rows } = await supabase.from("sessions").select("id,title,created_at,last_active_at,ended_at,mode")
    .eq("owner_id", data.user.id).order("last_active_at", { ascending: false }).limit(50);
  const sessions = rows ?? [];
  const now = Date.now();
  const status = (s: { ended_at: string | null; last_active_at: string }) => sessionStatus(s, now);
  const recent = sessions.filter((s) => !isOlder(s, now));
  const older = sessions.filter((s) => isOlder(s, now));
  const row = (s: (typeof sessions)[number]) => (
    <section className="doc-row" key={s.id}>
      <h2 className="se-heading">{s.title || `Session of ${new Date(s.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}</h2>
      <div className="se-stack">
        <p className="se-sm se-muted" style={{ margin: 0 }}>
          {status(s) === "active" ? "Active" : status(s) === "ended" ? "Ended" : "Inactive"}{s.mode === "outer" || s.mode === "external" ? " · external face" : ""} · last sound {ago(s.last_active_at, now)}
        </p>
        {status(s) !== "ended" && (
          <div className="ss-actions">
            {status(s) === "active" && <a className="se-btn se-btn-primary" href={`/s/${s.id}`}>Open player</a>}
            {status(s) === "active" && <CopyLink path={`/s/${s.id}`} />}
            {status(s) === "inactive" && <a className="se-btn" href={`/s/${s.id}`}>Open player</a>}
            <form action={endSession}>
              <input type="hidden" name="session_id" value={s.id} />
              <button type="submit" className="se-btn">End session</button>
            </form>
          </div>
        )}
      </div>
    </section>
  );

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
                  Not connected yet? <a href="/#add">Add to your AI</a>. Your <a href="/settings">settings</a> list the
                  apps that can reach your account.
                </p>
              </div>
            </section>
          ) : (
            <>
              {recent.map(row)}
              {older.length > 0 && (
                // the older rows are siblings of the summary, so they use the same two columns as the recent ones
                <details className="doc-older">
                  <summary className="doc-row doc-older-summary"><h2 className="se-heading" style={{ margin: 0 }}>Older ({older.length})</h2></summary>
                  {older.map(row)}
                </details>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
