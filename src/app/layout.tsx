import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/ThemeProvider";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 프로덕션에서만 GA 활성화 — 로컬/프리뷰 배포가 프로덕션 GA 데이터를 오염시키는 것 방지
const GA_ID = process.env.NODE_ENV === "production"
  ? (process.env.NEXT_PUBLIC_GA_ID ?? "G-9NCMJC4V6L")
  : null;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site";

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
    apple: "/icon.svg",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {GA_ID && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}</Script>
        </>}
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
