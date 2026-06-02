import Link from "next/link"

export default function Footer() {
  return (
    <footer className="border-t border-border/50 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">MarkLens</p>
          <p className="text-xs text-muted-foreground mt-0.5">Where Marketing Trends Become Action</p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/insights" className="hover:text-foreground transition-colors">인사이트</Link>
          <Link href="/library" className="hover:text-foreground transition-colors">케이스 라이브러리</Link>
          <Link href="/newsletter" className="hover:text-foreground transition-colors">뉴스레터</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">소개</Link>
        </nav>
        <p className="text-xs text-muted-foreground">© 2025 MarkLens</p>
      </div>
    </footer>
  )
}
