import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // set by the deploy workflow from the release tag
  env: { NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION ?? "" },
  transpilePackages: ["@sonorous/engine", "@sonorous/shared"],
};

export default nextConfig;
