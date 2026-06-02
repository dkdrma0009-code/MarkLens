"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/insights", label: "인사이트" },
  { href: "/library", label: "케이스 라이브러리" },
  { href: "/newsletter", label: "뉴스레터" },
  { href: "/about", label: "소개" },
]

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-semibold text-[15px] tracking-tight">MarkLens</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                pathname.startsWith(item.href)
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/newsletter"
          className="text-sm font-medium px-4 py-1.5 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          구독하기
        </Link>
      </div>
    </header>
  )
}
