"use client";

import { useState } from "react";
import { BookmarkCheck, ExternalLink, Pencil } from "lucide-react";
import { CopyLink } from "../copy-link";

/** The card under the player's controls after a save: a tick and the name, then Rename (in place), Open and Copy link as small buttons.
 *  `onEditing` lets the player keep the card on screen while the name is being typed. */
export function SaveNotice({ id, name, already, onRename, onEditing }: {
  id: string; name: string; already: boolean;
  onRename: (name: string) => Promise<boolean>; onEditing: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => { setEditing(false); setFailed(false); onEditing(false); };

  const head = (
    <p className="pl-save-head">
      <BookmarkCheck size={16} aria-hidden />
      <span className="pl-save-what">{already ? "Already saved" : "Saved"}</span>
      <span className="pl-save-name" title={name}>{name}</span>
    </p>
  );

  if (editing) {
    return (
      <>
        {head}
        <form className="pl-save-rename" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await onRename(value);
          setBusy(false);
          if (ok) close(); else setFailed(true);
        }}>
          <label className="se-visually-hidden" htmlFor="save-rename">Name of the saved moment</label>
          <input id="save-rename" className="se-input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} required autoFocus autoComplete="off" />
          <button type="submit" className="se-btn se-btn-primary" disabled={busy || !value.trim()}>Save</button>
          <button type="button" className="se-btn" onClick={close}>Cancel</button>
          {failed ? <span className="se-sm" role="alert">Could not rename. Try again.</span> : null}
        </form>
      </>
    );
  }
  return (
    <>
      {head}
      <div className="pl-save-actions">
        <button type="button" className="se-btn" onClick={() => { setValue(name); setEditing(true); onEditing(true); }}>
          <Pencil size={14} aria-hidden />Rename
        </button>
        <a className="se-btn" href={`/m/${id}`}><ExternalLink size={14} aria-hidden />Open</a>
        <CopyLink path={`/m/${id}`} label="Copy link" />
      </div>
    </>
  );
}
