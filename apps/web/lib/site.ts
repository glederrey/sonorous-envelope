/** The public address, for metadata and the sitemap. Falls back to the production domain so a build without env vars still works. */
export const SITE_URL = (process.env.PUBLIC_BASE_URL || "https://sonorous-envelope.com").replace(/\/+$/, "");

const OG_IMAGE = { url: "/brand/og-image.png", width: 1200, height: 630, alt: "Sonorous Envelope: let the AI hum while it thinks. Non-verbal communication for your AI: a synthesizer, live Strudel music and visuals beside the chat, in three modes: Self, Attuned and Jukebox." };

/** Metadata for a public page: its own title, description and canonical path, carried into the link previews (Open Graph and X), which otherwise keep the home page's. */
export function pageMeta(title: string, description: string, path: string) {
  const full = `${title} · Sonorous Envelope`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website" as const, siteName: "Sonorous Envelope", title: full, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" as const, title: full, description, images: [OG_IMAGE.url] },
  };
}
