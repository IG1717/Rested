import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen is per-user and authenticated, so the classic dynamic model is simpler here.
  cacheComponents: false,
};

export default nextConfig;
