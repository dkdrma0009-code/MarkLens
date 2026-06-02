"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/insights", label: "인사이트" },
  { href: "/library", label: "케이스 라이브러리" },
  { href: "/newsletter", label: "뉴스레터" },
  { href: "/about", label: "소개" },
]

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-base tracking-tight">
          MarkLens
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-gray-900 bg-gray-100"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/newsletter"
          className="text-sm font-semibold px-4 py-2 rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
        >
          구독하기
        </Link>
      </div>
    </header>
  )
}
