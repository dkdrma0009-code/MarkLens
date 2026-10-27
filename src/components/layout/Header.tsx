"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Sun, Moon, ArrowUpRight } from "lucide-react"
import PublicNavigation from "./PublicNavigation"
import MobileBottomNav from "./MobileBottomNav"
import Wordmark from "@/components/brand/Wordmark"

// The stored theme is only known after hydration; the server renders the toggle as "light".
const noop = () => () => {}

export default function Header() {
  const pathname = usePathname()
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const dark = mounted && resolvedTheme === "dark"

  // The home header, hero and pulse strip are dark in both themes, so a toggle there changed almost nothing on
  // screen (measured: 1% of the first screen at 1440px, 0% at 390px) and looked broken. Say what happened.
  function toggleTheme() {
    const next = dark ? "light" : "dark"
    setTheme(next)
    toast(next === "dark" ? "어두운 화면으로 바꿨어요" : "밝은 화면으로 바꿨어요", { id: "theme", duration: 1800 })
  }

  return (
    <header className={`ml-header ${pathname === "/" ? "ml-header-home" : ""}`}>
      <a className="ml-skip" href="#main-content">본문으로 건너뛰기</a>
      <div className="ml-container ml-header-inner">
        <Link href="/#main-content" className="ml-logo" aria-label="MarkLens 홈">
          <Wordmark className="ml-wordmark-primary" />
          <Wordmark reverse className="ml-wordmark-reverse" />
        </Link>
        <PublicNavigation className="ml-desktop-nav" />
        <div className="ml-header-actions">
          <button className="ml-theme" aria-pressed={dark} aria-label={dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환"} title={dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환"} onClick={toggleTheme}>
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
