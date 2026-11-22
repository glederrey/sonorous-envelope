"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";

/** The delete-account form: the button stays off until the word "delete" is typed. */
export function DeleteAccountForm() {
  const [text, setText] = useState("");
  return (
    <details>
      <summary className="se-btn" style={{ display: "inline-flex" }}>Delete account…</summary>
      <form action={deleteAccount} className="se-stack" style={{ marginTop: 16 }}>
        <div>
          <label className="se-sm se-muted" htmlFor="delete-confirm">Type delete to confirm</label>
          <input
            id="delete-confirm" name="confirm" type="text" className="se-input" value={text}
            onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
          />
        </div>
        <button type="submit" className="se-btn se-btn-danger" disabled={text !== "delete"}>Delete my account</button>
      </form>
    </details>
  );
}
