import { SiteHeader } from "../../components/site-header";
import { safeNext } from "../../lib/safe-next";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Sonorous Envelope" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="se-narrow se-stack">
        <h1 className="se-title">Sign in</h1>
        <p className="se-muted">Use your email and password, or Google.</p>
        {error ? <p className="se-error se-sm" role="alert">That link did not work. Try again.</p> : null}
        <LoginForm next={safeNext(next)} />
      </main>
    </>
  );
}
