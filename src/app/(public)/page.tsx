import Link from "next/link"
import { ArrowRight } from "lucide-react"

const CATEGORIES = [
  { label: "브랜딩", slug: "branding" },
  { label: "퍼포먼스 마케팅", slug: "performance-marketing" },
  { label: "SEO", slug: "seo" },
  { label: "콘텐츠 마케팅", slug: "content-marketing" },
  { label: "소셜 미디어", slug: "social-media" },
  { label: "AI 마케팅", slug: "ai-marketing" },
  { label: "CRM", slug: "crm" },
  { label: "소비자 심리", slug: "consumer-psychology" },
]

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground border border-border/60 rounded-full px-3 py-1 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            매주 월요일 7:30 AM 발행
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.15] mb-6">
            마케팅 트렌드를 읽고,<br />
            <span className="text-muted-foreground">실무를 준비하다.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            글로벌 마케팅 인사이트를 분석하여 왜 중요한지, 어떻게 적용할 수 있는지,
            포트폴리오에 어떻게 녹여낼 수 있는지를 함께 전달합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/newsletter"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              뉴스레터 구독하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/insights"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              인사이트 둘러보기
            </Link>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* What MarkLens Offers */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
          MarkLens가 제공하는 것
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "글로벌 마케팅 인사이트",
              description: "HubSpot, Ahrefs, Think with Google 등 주요 마케팅 미디어의 핵심 아티클을 매일 큐레이션합니다.",
            },
            {
              title: "실무 중심 분석",
              description: "단순 요약이 아닙니다. 왜 중요한지, 어떻게 적용할 수 있는지, 어떤 프레임워크가 숨어 있는지를 분석합니다.",
            },
            {
              title: "포트폴리오 & 커리어",
              description: "마케팅 사례를 포트폴리오에 어떻게 녹여낼 수 있는지, 면접에서 어떻게 활용할 수 있는지 함께 제안합니다.",
            },
          ].map((item) => (
            <div key={item.title} className="space-y-3">
              <h3 className="font-medium text-sm">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between mb-10">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            케이스 라이브러리
          </p>
          <Link href="/library" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            전체 보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/library?category=${cat.slug}`}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Newsletter CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-xl">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            MarkLens Weekly
          </p>
          <h2 className="text-2xl font-semibold tracking-tight mb-3">
            매주 월요일, 한 주를 시작하는 마케팅 브리핑
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            This Week&apos;s Signals, Case of the Week, AI Marketing Brief, Portfolio Insight, Career Lens — 5가지 섹션으로 구성된 뉴스레터를 무료로 받아보세요.
          </p>
          <Link
            href="/newsletter"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            무료 구독하기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
