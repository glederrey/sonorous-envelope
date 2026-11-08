"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initial);
  return (
    <form action={action} className="se-stack">
      <input type="hidden" name="next" value={next} />
      <label className="se-sm se-muted" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required className="se-input" />
      <button type="submit" className="se-btn se-btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.message ? (
        <p role="status" className={state.status === "error" ? "se-error se-sm" : "se-sm"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
