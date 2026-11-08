import { redirect } from "next/navigation";
import { SiteHeader } from "../../components/site-header";
import { createClient } from "../../lib/supabase/server";

export const metadata = { title: "Your sessions · Sonorous Envelope" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsessions");

  return (
    <>
      <SiteHeader />
      <main className="se-page se-stack">
        <h1 className="se-title">Your sessions</h1>
        <p className="se-muted">
          No sessions yet. Add the connector in Claude and start a conversation: each one gets its own session and a
          link to its player.
        </p>
        <a className="se-btn" href="/settings">Settings</a>
      </main>
    </>
  );
}
