"use server";

import { createClient } from "../../lib/supabase/server";
import { publicBaseUrl } from "../../lib/env";
import { safeNext } from "../../lib/safe-next";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const next = safeNext(String(formData.get("next") ?? ""));
  const redirectTo = `${publicBaseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) return { status: "error", message: "Could not send the link. Try again in a minute." };
  return { status: "sent", message: `Check ${email} for a sign-in link.` };
}
