"use client"

import { useRef } from "react"
import { Menu, X } from "lucide-react"
import PublicNavigation from "./PublicNavigation"

// 기존 바텀 탭 대신 데스크톱과 같은 IA를 사용하는 인라인 메뉴.
export default function MobileBottomNav() {
  const menuRef = useRef<HTMLDetailsElement>(null)
  return (
    <details className="ml-mobile-menu" ref={menuRef}>
      <summary aria-label="모바일 메뉴 열기 또는 닫기">
        <Menu className="ml-menu-open" size={22} aria-hidden="true" />
        <X className="ml-menu-close" size={22} aria-hidden="true" />
      </summary>
      <PublicNavigation className="ml-mobile-nav" onNavigate={() => { if (menuRef.current) menuRef.current.open = false }} />
    </details>
  )
}
