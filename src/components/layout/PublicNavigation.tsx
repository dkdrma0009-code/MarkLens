"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { PUBLIC_NAV_ITEMS, navCurrent } from "./navigation"

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback)
  window.addEventListener("popstate", callback)
  return () => {
    window.removeEventListener("hashchange", callback)
    window.removeEventListener("popstate", callback)
  }
}

export default function PublicNavigation({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "")
  return (
    <nav className={className} aria-label="공개 콘텐츠 메뉴">
      {PUBLIC_NAV_ITEMS.map(item => {
        const { href, label } = item, current = navCurrent(item, pathname, hash)
        return href.includes("#")
          ? <a key={href} href={href} aria-current={current} onClick={onNavigate}>{label}</a>
          : <Link key={href} href={href} aria-current={current} onClick={onNavigate}>{label}</Link>
      })}
    </nav>
  )
}
