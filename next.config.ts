import type { NextConfig } from "next";

// cache-bust: 2026-06-08
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // 카드뉴스 렌더링용 Pretendard 폰트를 서버리스 번들에 포함
  outputFileTracingIncludes: {
    "/api/admin/cardnews/render": ["./assets/fonts/*"],
    "/api/admin/cardnews/download": ["./assets/fonts/*"],
  },
};

export default nextConfig;
