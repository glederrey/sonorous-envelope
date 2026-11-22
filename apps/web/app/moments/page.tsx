import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";
import { SavedList, type SavedRow } from "./saved-list";

export const metadata = { title: "Moments" };

export default async function SavedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fmoments");

  const { data: rows } = await supabase.from("saved_moments").select("id,name,saved_by,created_at,engine:effective->>engine")
    .eq("owner_id", data.user.id).order("created_at", { ascending: false }).limit(200);
  // only what the list shows: the engine is read out of the frozen state in the database, the state itself stays there
  const moments: SavedRow[] = (rows ?? []).map((r) => ({
    id: r.id, name: r.name, saved_by: r.saved_by, created_at: r.created_at, engine: r.engine === "strudel" ? "strudel" : "synth",
  }));

  return (
    <>
      <SiteHeader />
      <main className="doc-page">
        <div className="doc-head">
          <h1 className="doc-title">Moments</h1>
        </div>
        <SavedList moments={moments} />
      </main>
    </>
  );
}
