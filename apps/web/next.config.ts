import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// The sandboxed frame that runs the model's Strudel code (public/strudel/frame.html, docs/implementation/strudel.md): it may load its own
// script and start a blob worker, and nothing else. No network at all, no storage (the frame is also sandboxed without allow-same-origin
// by the page that embeds it), and it cannot make sound: the page turns its events into audio.
const FRAME_CSP = "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src blob:; connect-src 'none'; sandbox allow-scripts";

// Short hash of the share image, added to its URL as ?v=: link previews (X, Slack, ...) cache an image by its URL,
// so a redrawn card gets a new URL and a fresh fetch, while releases that leave the image alone keep the cached one.
const OG_IMAGE_HASH = createHash("sha256").update(readFileSync("public/brand/og-image.png")).digest("hex").slice(0, 8);

const nextConfig: NextConfig = {
  // set by the deploy workflow from the release tag
  env: { NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION ?? "", OG_IMAGE_HASH },
  transpilePackages: ["@sonorous/engine", "@sonorous/shared"],
  async redirects() {
    return [
      { source: "/faces", destination: "/modes", permanent: true },
      { source: "/guide", destination: "/how-it-works", permanent: true },
      { source: "/v1", destination: "/#v1", permanent: false }, // easter egg: the home page plays fireworks (components/fireworks.tsx)
    ];
  },
  async headers() {
    return [{
      source: "/strudel/frame.html",
      headers: [
        { key: "Content-Security-Policy", value: FRAME_CSP },
        { key: "Permissions-Policy", value: "autoplay=(), camera=(), microphone=(), geolocation=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Cache-Control", value: "public, max-age=300" },
      ],
    }];
  },
};

export default nextConfig;
