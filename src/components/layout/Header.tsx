"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon, ArrowUpRight } from "lucide-react"
import PublicNavigation from "./PublicNavigation"
import MobileBottomNav from "./MobileBottomNav"

export default function Header() {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <header className={`ml-header ${pathname === "/" ? "ml-header-home" : ""}`}>
      <a className="ml-skip" href="#main-content">본문으로 건너뛰기</a>
      <div className="ml-container ml-header-inner">
        <Link href="/#main-content" className="ml-logo" aria-label="MarkLens 홈">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M6 26V8l10 4 10-4v18" />
            <circle cx="16" cy="18" r="5" />
          </svg>
          MarkLens<span className="ml-logo-dot">.</span>
        </Link>
        <PublicNavigation className="ml-desktop-nav" />
        <div className="ml-header-actions">
          <button className="ml-theme" aria-label="밝은 테마와 어두운 테마 전환" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            <Moon className="ml-theme-moon" size={18} aria-hidden="true" />
            <Sun className="ml-theme-sun" size={18} aria-hidden="true" />
          </button>
          <Link href="/newsletter" className="ml-header-subscribe">구독하기 <ArrowUpRight size={14} aria-hidden="true" /></Link>
          <MobileBottomNav />
        </div>
      </div>
    </header>
  )
}
