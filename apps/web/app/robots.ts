import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Public pages can be indexed. Player links are private by obscurity (anyone with the link listens), so they stay out of search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/s/", "/sessions", "/settings", "/auth/", "/oauth/", "/login"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
