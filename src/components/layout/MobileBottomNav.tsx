"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Newspaper, Megaphone, BookOpen, Info } from "lucide-react"

const NAV_ITEMS = [
  { href: "/",         label: "홈",      icon: Home },
  { href: "/insights", label: "인사이트", icon: Newspaper },
  { href: "/library",  label: "캠페인",  icon: Megaphone },
  { href: "/learn",    label: "학습",    icon: BookOpen },
  { href: "/about",    label: "소개",    icon: Info },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-colors ${
                active
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-600"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-all ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`}
              />
              <span className={`text-[10px] font-medium tracking-tight ${active ? "font-bold" : ""}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
