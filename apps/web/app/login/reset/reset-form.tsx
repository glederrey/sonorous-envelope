"use client";

import { useActionState } from "react";
import { updatePassword, type LoginState } from "../actions";

const initial: LoginState = { status: "idle" };

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="se-stack">
      <div className="se-field">
        <label className="se-sm se-muted" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="se-input" />
      </div>
      <button type="submit" className="se-btn se-btn-primary se-btn-block" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
      {state.message ? <p role="alert" className="se-error se-sm">{state.message}</p> : null}
    </form>
  );
}
