import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { Player } from "../../../components/player/player";

export const metadata = { title: "Listening · Sonorous Envelope", robots: { index: false } };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{24}$/.test(id)) notFound();
  return (
    <>
      <SiteHeader hideAuth />
      <Player sessionId={id} />
    </>
  );
}
