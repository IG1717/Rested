import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen is per-user and authenticated, so the classic dynamic model is simpler here.
  cacheComponents: false,
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
