import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { CopyLink } from "../../components/copy-link";
import { RenameMoment } from "../../components/moment/rename-moment";
import { createClient } from "../../lib/supabase/server";
import { deleteMoment } from "./actions";

export const metadata = { title: "Saved moments" };

export default async function SavedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsaved");

  const { data: rows } = await supabase.from("saved_moments").select("id,name,saved_by,created_at,effective")
    .eq("owner_id", data.user.id).order("created_at", { ascending: false }).limit(200);
  const moments = rows ?? [];

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Saved moments</h1>
        </div>
        <div className="doc-rows">
          {moments.length === 0 ? (
            <section className="doc-row">
              <h2 className="se-heading">Nothing saved yet</h2>
              <div className="se-stack">
                <p style={{ margin: 0 }}>Nothing saved yet. Press the bookmark in a session&apos;s controls, or ask your AI to save the moment.</p>
              </div>
            </section>
          ) : moments.map((m) => (
            <section className="doc-row" key={m.id}>
              <h2 className="se-heading">{m.name}</h2>
              <div className="se-stack">
                <p className="se-sm se-muted" style={{ margin: 0 }}>
                  Saved by {m.saved_by === "ai" ? "the AI" : "you"} · {new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {(m.effective as { engine?: string }).engine === "strudel" ? "Strudel" : "Synth"}
                </p>
                <div className="ss-actions">
                  <a className="se-btn se-btn-primary" href={`/m/${m.id}`}>Open</a>
                  <CopyLink path={`/m/${m.id}`} />
                </div>
                <RenameMoment id={m.id} name={m.name} />
                <details>
                  <summary className="se-btn" style={{ display: "inline-flex" }}>Delete…</summary>
                  <form action={deleteMoment} style={{ marginTop: 12 }}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="se-btn se-btn-danger">Delete for good</button>
                  </form>
                </details>
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
