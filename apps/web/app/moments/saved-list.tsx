"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { CopyLink } from "../../components/copy-link";
import { deleteMoment, renameMoment } from "./actions";

export interface SavedRow { id: string; name: string; saved_by: "human" | "ai"; created_at: string; engine: "strudel" | "synth" }

// UTC on both sides, so the server render and the browser agree (no hydration mismatch)
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthKey = (iso: string) => iso.slice(0, 7); // "2026-11"
const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** The owner's saved moments: a name search and filters by month, engine and who saved, then one row per moment with Open, Copy link,
 *  Rename (in place) and Delete (a confirm card). At most 200 rows, so it filters in the browser. */
export function SavedList({ moments }: { moments: SavedRow[] }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [engine, setEngine] = useState<"all" | SavedRow["engine"]>("all");
  const [by, setBy] = useState<"all" | SavedRow["saved_by"]>("all");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedRow | null>(null);
  const months = useMemo(() => [...new Set(moments.map((m) => monthKey(m.created_at)))], [moments]); // rows come newest first
  const q = query.trim().toLocaleLowerCase();
  const shown = moments.filter((m) => (month === "all" || monthKey(m.created_at) === month) && (engine === "all" || m.engine === engine)
    && (by === "all" || m.saved_by === by) && (!q || m.name.toLocaleLowerCase().includes(q)));
  const reset = () => { setQuery(""); setMonth("all"); setEngine("all"); setBy("all"); };

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (deleting && !d.open) d.showModal();
    if (!deleting && d.open) d.close();
  }, [deleting]);

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
        <input id="saved-search" type="search" className="se-input sv-search" placeholder="Search by name" value={query}
          onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        <label className="se-visually-hidden" htmlFor="saved-month">Month</label>
        <select id="saved-month" className="se-input" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All dates</option>
          {months.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
        </select>
        <label className="se-visually-hidden" htmlFor="saved-engine">Engine</label>
        <select id="saved-engine" className="se-input" value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)}>
          <option value="all">All sounds</option>
          <option value="synth">Synth</option>
          <option value="strudel">Strudel</option>
        </select>
        <label className="se-visually-hidden" htmlFor="saved-by">Saved by</label>
        <select id="saved-by" className="se-input" value={by} onChange={(e) => setBy(e.target.value as typeof by)}>
          <option value="all">By anyone</option>
          <option value="human">By you</option>
          <option value="ai">By the AI</option>
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
              <p style={{ margin: 0 }}>No saved moment matches. <button type="button" className="se-link" onClick={reset}>Show all</button></p>
            </div>
          </section>
        ) : shown.map((m) => (
          <section className="doc-row" key={m.id}>
            <h2 className="se-heading sv-name">{m.name}</h2>
            <div className="se-stack">
              <p className="se-sm se-muted" style={{ margin: 0 }}>
                Saved by {m.saved_by === "ai" ? "the AI" : "you"} · {day(m.created_at)} · {m.engine === "strudel" ? "Strudel" : "Synth"}
              </p>
              <div className="sv-actions">
                <a className="se-btn se-btn-primary" href={`/m/${m.id}`}>Open</a>
                <CopyLink path={`/m/${m.id}`} />
                <button type="button" className="se-btn" aria-expanded={renaming === m.id} onClick={() => setRenaming(renaming === m.id ? null : m.id)}>
                  <Pencil size={16} aria-hidden />Rename
                </button>
                <button type="button" className="se-btn se-btn-danger" aria-haspopup="dialog" onClick={() => setDeleting(m)}>
                  <Trash2 size={16} aria-hidden />Delete
                </button>
              </div>
              {renaming === m.id ? (
                <form className="sv-rename" action={async (fd) => { await renameMoment(fd); setRenaming(null); }}>
                  <input type="hidden" name="id" value={m.id} />
                  <label className="se-visually-hidden" htmlFor={`rename-${m.id}`}>New name</label>
                  <input id={`rename-${m.id}`} name="name" type="text" className="se-input" defaultValue={m.name} maxLength={80} required autoFocus autoComplete="off" />
                  <button type="submit" className="se-btn se-btn-primary">Save</button>
                  <button type="button" className="se-btn" onClick={() => setRenaming(null)}>Cancel</button>
                </form>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      {/* the delete confirm: a centred card, like Delete account (Esc, a click outside or Cancel closes it) */}
      <dialog ref={dialog} className="se-dialog" aria-labelledby="delete-moment-title" onClose={() => setDeleting(null)}
        onClick={(e) => { if (e.target === e.currentTarget) setDeleting(null); }}>
        {deleting ? (
          <form className="se-dialog-body" action={async (fd) => { await deleteMoment(fd); setDeleting(null); }}>
            <input type="hidden" name="id" value={deleting.id} />
            <h2 id="delete-moment-title" className="se-heading" style={{ margin: 0 }}>Delete “{deleting.name}” for good?</h2>
            <p className="se-muted" style={{ margin: 0 }}>
              The moment is gone for good. Anyone who opens its link, you included, lands on a “not found” page (404). This cannot be undone.
            </p>
            <div className="se-dialog-actions">
              <button type="button" className="se-btn" onClick={() => setDeleting(null)}>Cancel</button>
              <button type="submit" className="se-btn se-btn-danger se-btn-danger-solid">Delete for good</button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
