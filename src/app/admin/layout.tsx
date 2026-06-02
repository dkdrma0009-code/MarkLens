import Link from "next/link"
import { LayoutDashboard, FileText, Mail, BarChart2, Rss } from "lucide-react"

const navItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/articles", label: "아티클", icon: FileText },
  { href: "/admin/newsletter", label: "뉴스레터", icon: Mail },
  { href: "/admin/analytics", label: "분석", icon: BarChart2 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-background flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link href="/" className="text-sm font-semibold">MarkLens</Link>
          <span className="ml-2 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Admin</span>
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
            <Rss className="w-3.5 h-3.5" />
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
