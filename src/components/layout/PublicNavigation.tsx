"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"

const items = [
  { href: "/insights", label: "Insights" },
  { href: "/#signals", label: "Trends" },
  { href: "/#collections", label: "Collections" },
  { href: "/practice", label: "Career Lab" },
  { href: "/glossary", label: "Dictionary" },
  { href: "/newsletter", label: "Weekly" },
]

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
      {items.map(({ href, label }) => {
        const active = href.includes("#") ? pathname === "/" && hash === href.slice(1) : pathname.startsWith(href)
        return href.includes("#")
          ? <a key={href} href={href} aria-current={active ? "location" : undefined} onClick={onNavigate}>{label}</a>
          : <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={onNavigate}>{label}</Link>
      })}
    </nav>
  )
}
