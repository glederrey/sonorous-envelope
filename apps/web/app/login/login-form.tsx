"use client";

import { useActionState, useState } from "react";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUp,
  type LoginState,
} from "./actions";

const initial: LoginState = { status: "idle" };
type Mode = "signin" | "signup" | "magic" | "reset";

const COPY: Record<Mode, { submit: string; pending: string }> = {
  signin: { submit: "Sign in", pending: "Signing in…" },
  signup: { submit: "Create account", pending: "Creating…" },
  magic: { submit: "Send sign-in link", pending: "Sending…" },
  reset: { submit: "Send reset link", pending: "Sending…" },
};

const ACTIONS = { signin: signInWithPassword, signup: signUp, magic: sendMagicLink, reset: sendPasswordReset };

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [state, action, pending] = useActionState(ACTIONS[mode], initial);
  const needsPassword = mode === "signin" || mode === "signup";

  return (
    <div className="se-stack">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="se-btn se-btn-block">Continue with Google</button>
      </form>
      <p className="se-sm se-muted se-divider">or with email</p>

      <form action={action} className="se-stack" key={mode}>
        <input type="hidden" name="next" value={next} />
        <div className="se-field">
          <label className="se-sm se-muted" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="se-input" />
        </div>
        {needsPassword ? (
          <div className="se-field">
            <label className="se-sm se-muted" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
              className="se-input"
            />
          </div>
        ) : null}
        <button type="submit" className="se-btn se-btn-primary" disabled={pending}>
          {pending ? COPY[mode].pending : COPY[mode].submit}
        </button>
        {state.message ? (
          <p role="status" className={state.status === "error" ? "se-error se-sm" : "se-sm"}>
            {state.message}
          </p>
        ) : null}
      </form>

      <div className="se-sm se-muted se-links">
        {mode === "signin" ? (
          <>
            <button type="button" className="se-link" onClick={() => setMode("signup")}>Create an account</button>
            <button type="button" className="se-link" onClick={() => setMode("reset")}>Forgot password</button>
            <button type="button" className="se-link" onClick={() => setMode("magic")}>Email me a link</button>
          </>
        ) : (
          <button type="button" className="se-link" onClick={() => setMode("signin")}>Back to sign in</button>
        )}
      </div>
    </div>
  );
}
