"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Lightbulb, Mail,
  BarChart2, Rss, Users, MessageSquare, Image as ImageIcon, Clapperboard, Trophy
} from "lucide-react"

const navItems = [
  { href: "/admin",              label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/articles",     label: "아티클",   icon: FileText },
  { href: "/admin/insights",     label: "인사이트", icon: Lightbulb },
  { href: "/admin/cardnews",     label: "카드뉴스", icon: ImageIcon },
  { href: "/admin/competitions", label: "대외활동", icon: Trophy },
  { href: "/admin/adkit",        label: "광고 패키징", icon: Clapperboard },
  { href: "/admin/newsletter",   label: "뉴스레터", icon: Mail },
  { href: "/admin/subscribers",  label: "구독자",   icon: Users },
  { href: "/admin/sources",      label: "RSS",      icon: Rss },
  { href: "/admin/analytics",    label: "분석",     icon: BarChart2 },
  { href: "/admin/feedback",     label: "피드백",   icon: MessageSquare },
]

// 바텀탭에는 자주 쓰는 5개만
const bottomItems = [
  { href: "/admin",            label: "홈",     icon: LayoutDashboard },
  { href: "/admin/articles",   label: "아티클", icon: FileText },
  { href: "/admin/newsletter", label: "뉴스레터",icon: Mail },
  { href: "/admin/analytics",  label: "분석",   icon: BarChart2 },
  { href: "/admin/feedback",   label: "피드백", icon: MessageSquare },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

  return (
    <div className="flex min-h-screen">

      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex w-56 border-r border-border bg-background flex-col flex-shrink-0">
        <div className="h-14 flex items-center px-4 border-b border-border gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            className="w-6 h-6 flex-shrink-0">
            <path d="M6 26V8l10 4 10-4v18"/>
            <circle cx="16" cy="18" r="5"/>
            <circle cx="16" cy="18" r="0.5" fill="currentColor" stroke="none"/>
          </svg>
          <Link href="/" className="text-sm font-semibold">MarkLens</Link>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Admin</span>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors mb-0.5 ${
                isActive(item.href)
                  ? "text-foreground bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LayoutDashboard className="w-3.5 h-3.5" />
            공개 사이트 보기
          </Link>
        </div>
      </aside>

      {/* ── 모바일 상단 헤더 ── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-40 h-12 flex items-center justify-between px-4 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <path d="M6 26V8l10 4 10-4v18"/>
              <circle cx="16" cy="18" r="5"/>
              <circle cx="16" cy="18" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
            <span className="text-sm font-bold">MarkLens</span>
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Admin</span>
          </div>
          <Link href="/" className="text-xs text-muted-foreground">사이트 보기 →</Link>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-auto bg-muted/20 pb-16 md:pb-0">
          {children}
        </main>

        {/* ── 모바일 바텀 탭 ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex items-center justify-around h-14">
            {bottomItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
                  <span className={`text-[9px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
