import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sonorous/engine", "@sonorous/shared"],
};

export default nextConfig;
