import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/ThemeProvider";
import AudienceAnalytics from "@/components/AudienceAnalytics";
import { PRODUCTION_SITE_URL } from "@/lib/tracked-url";
import "./globals.css";
// 한글 본문 — Pretendard 공식 dynamic subset(self-host). 페이지에 나온 글자의 조각만 받는다 → html.ml-font-pretendard 가 --font-sans 를 정한다.
import "./pretendard.css";

// 제목 — Gmarket Sans (self-host woff2), 본문과 대비되는 지오메트릭 디스플레이.
// preload 하지 않는다: 굵기마다 360KB 전체 파일이라, 실제로 그 굵기가 쓰이는 페이지에서만 받게 한다.
const gmarketSans = localFont({
  src: [
    { path: "../../public/fonts/GmarketSansMedium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/GmarketSansBold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
  preload: false,
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? PRODUCTION_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: {
    google: "io4NM_VvWISWgqikgbn_VSqP24ZW9Kwz367iUoDotCQ",
  },
  title: "MarkLens — Where Marketing Trends Become Action",
  description: "마케팅 트렌드를 선별해 실무와 포트폴리오에 바로 적용 가능한 인사이트로 전합니다. 주니어 마케터와 취준생을 위한 마케팅 미디어.",
  // RSS 피드 자동 발견 (브라우저·RSS 리더)
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/brand/marklens-mark-180.png", sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    title: "MarkLens — 마케팅 트렌드를 읽고, 실무를 준비하다",
    description: "글로벌 마케팅 트렌드를 선별해 실무·포트폴리오·면접에 어떻게 적용할지까지 짚어 드립니다.",
    siteName: "MarkLens",
    url: "https://marklens.site",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`ml-font-pretendard ${gmarketSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AudienceAnalytics deployment={process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV} />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
