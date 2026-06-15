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
    "/api/admin/cardnews/publish": ["./assets/fonts/*"],
    "/api/admin/shorts/preview": ["./assets/fonts/*"],
    "/api/lead-magnet/interview": ["./assets/fonts/*"],
    "/api/admin/competitions/thumbnail": ["./assets/fonts/*"],
  },
  // 인스타 바이오 단축링크 — marklens.site/ig → 구독 페이지 직행(리드마그넷+폼 즉시 노출, UTM 추적)
  async redirects() {
    return [
      {
        source: "/ig",
        destination: "/newsletter?utm_source=instagram&utm_medium=bio&utm_campaign=profile",
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
