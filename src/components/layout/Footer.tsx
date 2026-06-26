import Link from "next/link"

export default function Footer({ className }: { className?: string }) {
  return (
    <footer className={`border-t border-border/50 mt-auto ${className ?? ""}`}>
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">MarkLens</p>
          <p className="text-xs text-muted-foreground mt-0.5">Where Marketing Trends Become Action</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/insights" className="hover:text-foreground transition-colors">인사이트</Link>
          <Link href="/glossary" className="hover:text-foreground transition-colors">용어사전</Link>
          <Link href="/newsletter" className="hover:text-foreground transition-colors">뉴스레터</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">소개</Link>
          <a href="/feed.xml" className="hover:text-foreground transition-colors">RSS</a>
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} MarkLens</p>
      </div>
    </footer>
  )
}
