import type { NextConfig } from "next";

// cache-bust: 2026-06-08
const nextConfig: NextConfig = {
  // 워크스페이스 루트를 이 프로젝트로 고정 — 홈 디렉토리의 떠돌이 lockfile이
  // 루트로 오인돼 next/font 모듈 해시가 서버/클라 불일치(하이드레이션 에러)나는 것 방지
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Remotion(번들러·렌더러)은 네이티브 바이너리 포함 — 서버 번들에서 제외(로컬 렌더 시 node_modules에서 직접 require)
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  // 카드뉴스 렌더링용 Pretendard 폰트를 서버리스 번들에 포함
  outputFileTracingIncludes: {
    "/api/admin/cardnews/render": ["./assets/fonts/*"],
    "/api/admin/cardnews/download": ["./assets/fonts/*"],
    "/api/admin/cardnews/publish": ["./assets/fonts/*"],
    "/api/admin/shorts/preview": ["./assets/fonts/*"],
    "/api/lead-magnet/interview": ["./assets/fonts/*"],
    "/api/newsletter/visual": ["./assets/fonts/*"],
    // 릴스(실사) 라우트가 카테고리→클립 목록을 읽는 매니페스트를 서버리스 번들에 포함.
    // glob 이라 fetch 전(파일 없음)에도 빌드가 깨지지 않는다.
    "/api/admin/shorts/render": ["./assets/video/stock/*.json"],
  },
  // 인스타 바이오 단축링크 — marklens.site/ig → 구독 페이지 직행(리드마그넷+폼 즉시 노출, UTM 추적)
  async redirects() {
    return [
      {
        source: "/ig",
        destination: "/newsletter?utm_source=instagram&utm_medium=bio&utm_campaign=profile",
        permanent: false,
      },
      { source: "/library", destination: "/insights", permanent: true },
      { source: "/library/:path*", destination: "/insights", permanent: true },
      { source: "/competitions", destination: "/insights", permanent: true },
      { source: "/competitions/:path*", destination: "/insights", permanent: true },
    ]
  },
};

export default nextConfig;
