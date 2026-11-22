"use client";

import { useMemo, useState } from "react";
import { CopyLink } from "../../components/copy-link";
import { RenameMoment } from "../../components/moment/rename-moment";
import { deleteMoment } from "./actions";

export interface SavedRow { id: string; name: string; saved_by: "human" | "ai"; created_at: string; engine: "strudel" | "synth" }

// UTC on both sides, so the server render and the browser agree (no hydration mismatch)
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthKey = (iso: string) => iso.slice(0, 7); // "2026-11"
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** The owner's saved moments with a name search and a month filter. The list is at most 200 rows, so it filters in the browser. */
export function SavedList({ moments }: { moments: SavedRow[] }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const months = useMemo(() => [...new Set(moments.map((m) => monthKey(m.created_at)))], [moments]); // rows come newest first
  const q = query.trim().toLocaleLowerCase();
  const shown = moments.filter((m) => (month === "all" || monthKey(m.created_at) === month) && (!q || m.name.toLocaleLowerCase().includes(q)));

  if (moments.length === 0) {
    return (
      <div className="doc-rows">
        <section className="doc-row">
          <h2 className="se-heading">Nothing saved yet</h2>
          <div className="se-stack">
            <p style={{ margin: 0 }}>Press the bookmark in a session&apos;s controls, or ask your AI to save the moment.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="sv-filters" role="search">
        <label className="se-visually-hidden" htmlFor="saved-search">Search by name</label>
        <input id="saved-search" type="search" className="se-input" placeholder="Search by name" value={query}
          onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        <label className="se-visually-hidden" htmlFor="saved-month">Month</label>
        <select id="saved-month" className="se-input" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All dates</option>
          {months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
        </select>
      </div>
      <p className="se-sm se-muted sv-count" aria-live="polite">
        {shown.length === moments.length ? `${moments.length} saved` : `${shown.length} of ${moments.length}`}
      </p>
      <div className="doc-rows">
        {shown.length === 0 ? (
          <section className="doc-row">
            <h2 className="se-heading">No match</h2>
            <div className="se-stack">
              <p style={{ margin: 0 }}>No saved moment matches. <button type="button" className="se-link" onClick={() => { setQuery(""); setMonth("all"); }}>Show all</button></p>
            </div>
          </section>
        ) : shown.map((m) => (
          <section className="doc-row" key={m.id}>
            <h2 className="se-heading">{m.name}</h2>
            <div className="se-stack">
              <p className="se-sm se-muted" style={{ margin: 0 }}>
                Saved by {m.saved_by === "ai" ? "the AI" : "you"} · {day(m.created_at)} · {m.engine === "strudel" ? "Strudel" : "Synth"}
              </p>
              <div className="sv-actions">
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
    </>
  );
}
