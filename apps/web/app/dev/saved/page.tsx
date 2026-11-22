import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site-header";
import { SavedList, type SavedRow } from "../../moments/saved-list";

export const metadata: Metadata = { title: "Saved lab", robots: { index: false, follow: false } };

const NAMES = ["Rain at dusk", "First light · 09:12", "Moment · 23:41", "A very long name for a saved moment that keeps going to see how it wraps on a phone", "Calm before the storm", "Tension · 14:05", "Late night Strudel", "Morning coffee"];
// made-up rows over three months, newest first: the list, the search and the month filter with no database (rename and delete do not work here)
const ROWS: SavedRow[] = NAMES.map((name, i) => ({
  id: `lab${String(i).padStart(19, "0")}`, name, saved_by: i % 3 === 1 ? "ai" : "human",
  created_at: new Date(Date.UTC(2026, 10 - Math.floor(i / 3), 20 - i)).toISOString(), engine: i % 4 === 2 ? "strudel" : "synth",
}));

export default function Page() {
  return (
    <>
      <SiteHeader hideAuth />
      <main className="doc-page">
        <div className="doc-head"><h1 className="doc-title">Saved moments</h1></div>
        <SavedList moments={ROWS} />
        <h2 className="se-heading" style={{ marginTop: 48 }}>Empty</h2>
        <SavedList moments={[]} />
      </main>
    </>
  );
}
