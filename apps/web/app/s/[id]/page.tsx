import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { Player } from "../../../components/player/player";
import { hasSupabaseEnv } from "../../../lib/env";
import { createClient } from "../../../lib/supabase/server";

export const metadata = { title: "Listening · Sonorous Envelope", robots: { index: false } };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{24}$/.test(id)) notFound();
  // A signed-in account gets a link to share; anyone else gets a way to add the connector to their own Claude.
  let signedIn = false;
  if (hasSupabaseEnv()) {
    const { data } = await (await createClient()).auth.getUser();
    signedIn = Boolean(data.user);
  }
  return (
    <>
      <SiteHeader hideAuth />
      <Player sessionId={id} signedIn={signedIn} />
    </>
  );
}
