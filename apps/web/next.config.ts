import type { NextConfig } from "next";

// The sandboxed frame that runs the model's Strudel code (public/strudel/frame.html, docs/implementation/strudel.md): it may load its own
// script and start a blob worker, and nothing else. No network at all, no storage (the frame is also sandboxed without allow-same-origin
// by the page that embeds it), and it cannot make sound: the page turns its events into audio.
const FRAME_CSP = "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src blob:; connect-src 'none'; sandbox allow-scripts";

const nextConfig: NextConfig = {
  // set by the deploy workflow from the release tag
  env: { NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION ?? "" },
  transpilePackages: ["@sonorous/engine", "@sonorous/shared"],
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
