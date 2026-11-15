import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL;
  return ["", "/add", "/how-it-works", "/modes", "/privacy"].map((path) => ({ url: `${base}${path}` }));
}
