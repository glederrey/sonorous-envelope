"use client";

import { useEffect, useRef, useState } from "react";
import { deleteSession } from "./actions";

/** Delete one session: a button that opens a centred card (a modal dialog: Esc, a click outside or Cancel closes it), like Settings' delete account. */
export function DeleteSessionForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" className="se-btn se-btn-danger" aria-haspopup="dialog" onClick={() => setOpen(true)}>Delete</button>
      <dialog ref={dialog} className="se-dialog" aria-labelledby={`delete-session-${sessionId}`} onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open ? (
          <form action={deleteSession} className="se-dialog-body">
            <input type="hidden" name="session_id" value={sessionId} />
            <h2 id={`delete-session-${sessionId}`} className="se-heading" style={{ margin: 0 }}>Delete this session?</h2>
            <p className="se-muted" style={{ margin: 0 }}>
              Delete this session and everything the AI played in it? Saved moments stay on your Moments page. This cannot be undone.
            </p>
            <div className="se-dialog-actions">
              <button type="button" className="se-btn" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="se-btn se-btn-danger se-btn-danger-solid">Delete session</button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
