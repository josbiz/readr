import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Versions the service worker: each build registers /sw.js?v=<this>.
  env: {
    NEXT_PUBLIC_APP_VERSION: String(Date.now()),
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
