import type { MetadataRoute } from "next";
import { publicBaseUrl } from "../lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicBaseUrl();
  return ["", "/guide", "/safety", "/privacy"].map((path) => ({ url: `${base}${path}` }));
}
