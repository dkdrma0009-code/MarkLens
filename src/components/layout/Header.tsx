"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

const navItems = [
  { href: "/insights",   label: "인사이트" },
  { href: "/practice",   label: "면접 준비" },
  { href: "/newsletter", label: "뉴스레터" },
  { href: "/about",      label: "소개" },
]

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className="w-7 h-7">
      <path d="M6 26V8l10 4 10-4v18"/>
      <circle cx="16" cy="18" r="5"/>
      <circle cx="16" cy="18" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  if (resolvedTheme === undefined) return <div className="w-8 h-8" />
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="테마 전환"
    >
      {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight">
          <Logo />
          <span>MarkLens</span>
        </Link>

        {/* 데스크탑 nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 우측: 테마 + 구독 */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/newsletter"
            className="hidden md:inline-flex text-sm font-semibold px-4 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
          >
            구독하기
          </Link>
        </div>
      </div>
    </header>
  )
}
