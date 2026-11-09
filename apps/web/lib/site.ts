/** The public address, for metadata and the sitemap. Falls back to the production domain so a build without env vars still works. */
export const SITE_URL = (process.env.PUBLIC_BASE_URL || "https://sonorous-envelope.com").replace(/\/+$/, "");
