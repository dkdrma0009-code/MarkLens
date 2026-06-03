import Link from "next/link"
import { LayoutDashboard, FileText, Lightbulb, Mail, BarChart2, Rss, Users } from "lucide-react"

const navItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/articles", label: "아티클", icon: FileText },
  { href: "/admin/insights", label: "인사이트", icon: Lightbulb },
  { href: "/admin/newsletter", label: "뉴스레터", icon: Mail },
  { href: "/admin/subscribers", label: "구독자", icon: Users },
  { href: "/admin/sources", label: "RSS 소스", icon: Rss },
  { href: "/admin/analytics", label: "분석", icon: BarChart2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-background flex flex-col">
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
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-0.5"
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

      {/* Main */}
      <main className="flex-1 overflow-auto bg-muted/20">
        {children}
      </main>
    </div>
  )
}
