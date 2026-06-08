import type { NextConfig } from "next";

// cache-bust: 2026-06-08
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
