import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { QuietPage } from "../components/not-found/quiet-page";

export const metadata: Metadata = { title: "Not found", robots: { index: false, follow: false } };

// Every 404 of the site, including a deleted saved moment (/m/<id> calls notFound()).
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <QuietPage />
    </>
  );
}
