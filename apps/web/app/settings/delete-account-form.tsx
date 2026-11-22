"use client";

import { useState, type ReactNode } from "react";
import { deleteAccount } from "./actions";

/** Delete account: the warning with a red button on its right (like Revoke); the button opens the form below, whose final button stays
 *  off until the word "delete" is typed. */
export function DeleteAccountForm({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <>
      <div className="se-grant se-grant-last">
        <div>{children}</div>
        <button type="button" className="se-btn se-btn-danger" aria-expanded={open} aria-controls="delete-account-confirm"
          onClick={() => { setOpen((o) => !o); setText(""); }}>
          {open ? "Cancel" : "Delete account…"}
        </button>
      </div>
      {open ? (
        <form id="delete-account-confirm" action={deleteAccount} className="se-stack">
          <div>
            <label className="se-sm se-muted" htmlFor="delete-confirm">Type delete to confirm</label>
            <input
              id="delete-confirm" name="confirm" type="text" className="se-input" value={text} autoFocus
              onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
            />
          </div>
          <button type="submit" className="se-btn se-btn-danger se-btn-danger-solid" disabled={text !== "delete"}>Delete my account</button>
        </form>
      ) : null}
    </>
  );
}
