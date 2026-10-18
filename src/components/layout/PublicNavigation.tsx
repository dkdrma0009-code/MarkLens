"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PUBLIC_NAV_ITEMS, navCurrent } from "./navigation"

export default function PublicNavigation({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className={className} aria-label="공개 콘텐츠 메뉴">
      {PUBLIC_NAV_ITEMS.map(item => <Link key={item.href} href={item.href} aria-current={navCurrent(item, pathname)} onClick={onNavigate}>{item.label}</Link>)}
    </nav>
  )
}
