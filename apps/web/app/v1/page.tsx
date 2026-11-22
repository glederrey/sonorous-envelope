import type { Metadata } from "next";
import { Fireworks } from "./fireworks";

export const metadata: Metadata = { title: "v1", robots: { index: false, follow: false } };

// Easter egg for the v1 release: a few seconds of fireworks, then the home page. Not linked anywhere, not in the sitemap.
export default function V1() {
  return <Fireworks />;
}
