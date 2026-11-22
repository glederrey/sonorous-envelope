"use client";

import { useState } from "react";
import { CopyLink } from "../copy-link";

/** The line under the player's controls after a save: the automatic name, with Rename (inline, in place), Open and Copy link.
 *  `onEditing` lets the player keep the line on screen while the name is being typed. */
export function SaveNotice({ id, name, already, onRename, onEditing }: {
  id: string; name: string; already: boolean;
  onRename: (name: string) => Promise<boolean>; onEditing: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => { setEditing(false); setFailed(false); onEditing(false); };

  if (editing) {
    return (
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
    );
  }
  return (
    <>
      <span className="pl-save-name">{already ? "Already saved" : "Saved"} as “{name}”</span>
      <span className="pl-save-links">
        <button type="button" className="se-link" onClick={() => { setValue(name); setEditing(true); onEditing(true); }}>Rename</button>
        <span aria-hidden>·</span>
        <a href={`/m/${id}`}>Open</a>
        <span aria-hidden>·</span>
        <CopyLink path={`/m/${id}`} label="Copy link" inline />
      </span>
    </>
  );
}
