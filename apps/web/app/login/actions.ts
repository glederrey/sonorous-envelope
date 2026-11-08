"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { publicBaseUrl } from "../../lib/env";
import { safeNext } from "../../lib/safe-next";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// Supabase's built-in mailer only sends a few emails an hour.
const RATE_LIMITED = "Too many emails sent. Try later, or use Google.";
function isRateLimited(error: { code?: string; status?: number }) {
  return error.code === "over_email_send_rate_limit" || error.status === 429;
}

function callbackUrl(next: string) {
  return `${publicBaseUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function read(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(String(formData.get("next") ?? "")),
  };
}

export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { email, password, next } = read(formData);
  if (!EMAIL.test(email) || !password) return { status: "error", message: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: "Wrong email or password." };
  redirect(next);
}

export async function signUp(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { email, password, next } = read(formData);
  if (!EMAIL.test(email)) return { status: "error", message: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD) {
    return { status: "error", message: `Use at least ${MIN_PASSWORD} characters for the password.` };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) {
    if (isRateLimited(error)) return { status: "error", message: RATE_LIMITED };
    return { status: "error", message: "Could not create the account. Try signing in instead." };
  }
  // With email confirmation off, Supabase returns a session right away.
  if (data.session) redirect(next);
  return { status: "sent", message: "Check your email to confirm your account." };
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { email, next } = read(formData);
  if (!EMAIL.test(email)) return { status: "error", message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(next) } });
  if (error) {
    if (isRateLimited(error)) return { status: "error", message: RATE_LIMITED };
    return { status: "error", message: "Could not send the link. Try again in a minute." };
  }
  return { status: "sent", message: "Check your email for a sign-in link." };
}

export async function sendPasswordReset(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { email } = read(formData);
  if (!EMAIL.test(email)) return { status: "error", message: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("/login/reset") });
  if (error && isRateLimited(error)) return { status: "error", message: RATE_LIMITED };
  // Same answer whether or not the account exists.
  return { status: "sent", message: "Check your email for a reset link." };
}

export async function updatePassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { password } = read(formData);
  if (password.length < MIN_PASSWORD) {
    return { status: "error", message: `Use at least ${MIN_PASSWORD} characters for the password.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  // Choosing the password you already have leaves the account as asked: treat it as done.
  if (error && error.code !== "same_password") {
    return { status: "error", message: "Could not change the password. Request a new reset link." };
  }
  redirect("/sessions");
}

export async function signInWithGoogle(formData: FormData) {
  const { next } = read(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
