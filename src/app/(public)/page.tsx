import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import InsightCard from "@/components/InsightCard"

const CATEGORIES = [
  { label: "브랜딩", slug: "브랜딩" },
  { label: "퍼포먼스 마케팅", slug: "퍼포먼스 마케팅" },
  { label: "SEO", slug: "SEO" },
  { label: "콘텐츠 마케팅", slug: "콘텐츠 마케팅" },
  { label: "소셜 미디어", slug: "소셜 미디어" },
  { label: "AI 마케팅", slug: "AI 마케팅" },
  { label: "CRM", slug: "CRM" },
  { label: "소비자 심리", slug: "소비자 심리" },
]

export default async function HomePage() {
  const supabase = await createClient()

  const { data: recentInsights } = await supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(7)

  const featured = recentInsights?.[0]
  const rest = recentInsights?.slice(1, 7) ?? []

  return (
    <div className="flex flex-col">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-14">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            매주 월요일 7:30 AM 발행
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
            마케팅 트렌드를 읽고,<br />
            <span className="text-gray-400">실무를 준비하다.</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl break-keep">
            글로벌 마케팅 인사이트를 분석하여 왜 중요한지, 어떻게 적용할 수 있는지, 포트폴리오에 어떻게 녹여낼 수 있는지를 함께 전달합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/newsletter"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              뉴스레터 구독하기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/insights"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              인사이트 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100" />

      {/* Latest Insights */}
      {recentInsights && recentInsights.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">최신 인사이트</h2>
            <Link href="/insights" className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1">
              전체 보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Featured */}
          {featured && (
            <div className="mb-6">
              <InsightCard insight={featured as any} size="large" />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((insight: any) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="border-t border-gray-100" />

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold">레퍼런스</h2>
          <Link href="/library" className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1">
            전체 보기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/library?category=${cat.slug}`}
              className="px-5 py-2 text-sm border border-gray-200 rounded-full font-medium hover:bg-black hover:text-white hover:border-black transition-all"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-100" />

      {/* Newsletter CTA */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="bg-black rounded-2xl p-10 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">MarkLens Weekly</p>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            매주 월요일, 한 주를 시작하는<br />마케팅 브리핑
          </h2>
          <p className="text-gray-400 leading-relaxed mb-7 max-w-lg">
            This Week&apos;s Signals, Case of the Week, AI Marketing Brief, Portfolio Insight, Career Lens —
            5가지 섹션을 무료로 받아보세요.
          </p>
          <Link
            href="/newsletter"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            무료 구독하기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

    </div>
  )
}
