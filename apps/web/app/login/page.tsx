import { SiteHeader } from "../../components/site-header";
import { safeNext } from "../../lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Sonorous Envelope" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; mode?: string }> }) {
  const { next, error, mode } = await searchParams;
  return (
    <>
      <SiteHeader hideAuth />
      <main className="se-narrow se-stack">
        <h1 className="se-title">Your account</h1>
        <p className="se-muted">Sign in, or create an account, to connect Claude.</p>
        {error ? <p className="se-error se-sm" role="alert">That link did not work. Try again.</p> : null}
        <LoginForm next={safeNext(next)} initialMode={mode === "signup" ? "signup" : "signin"} />
      </main>
    </>
  );
}
