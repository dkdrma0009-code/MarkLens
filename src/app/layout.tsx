import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  verification: {
    google: "io4NM_VvWISWgqikgbn_VSqP24ZW9Kwz367iUoDotCQ",
  },
  title: "MarkLens — Where Marketing Trends Become Action",
  description: "마케팅 트렌드를 분석하고, 실무에 바로 적용 가능한 인사이트를 제공합니다.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "MarkLens",
    description: "Where Marketing Trends Become Action",
    siteName: "MarkLens",
    url: "https://www.marklens.site",
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
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
