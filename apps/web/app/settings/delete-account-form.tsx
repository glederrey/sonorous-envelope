"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteAccount } from "./actions";

/** Delete account: the warning with a red button on its right (like Revoke). The button opens a centred card (a modal dialog: Esc,
 *  a click outside or Cancel closes it) whose filled red button stays off until the word "delete" is typed. */
export function DeleteAccountForm({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <div className="se-grant se-grant-last">
        <div>{children}</div>
        <button type="button" className="se-btn se-btn-danger" aria-haspopup="dialog" onClick={() => { setText(""); setOpen(true); }}>
          Delete account
        </button>
      </div>
      <dialog ref={dialog} className="se-dialog" aria-labelledby="delete-account-title" onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open ? (
          <form action={deleteAccount} className="se-dialog-body">
            <h2 id="delete-account-title" className="se-heading" style={{ margin: 0 }}>Delete your account?</h2>
            <p className="se-muted" style={{ margin: 0 }}>
              Every session, every saved moment and every connected app goes with it. Shared links stop working. This cannot be undone.
            </p>
            <div className="se-field se-dialog-field">
              <label className="se-sm se-muted" htmlFor="delete-confirm">Type <kbd className="se-keyword">delete</kbd> to confirm</label>
              <input
                id="delete-confirm" name="confirm" type="text" className="se-input" value={text} autoFocus
                onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
              />
            </div>
            <div className="se-dialog-actions">
              <button type="button" className="se-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="se-btn se-btn-danger se-btn-danger-solid" disabled={text !== "delete"}>Delete my account</button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
