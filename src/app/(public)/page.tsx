import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import InsightCard from "@/components/InsightCard"
import type { Insight } from "@/types"

export const revalidate = 3600

const CAMPAIGN_SOURCES = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

export default async function HomePage() {
  const supabase = await createClient()

  const { data: allRecent } = await supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(20)

  const recentInsights = (allRecent ?? [])
    .filter((i) => {
      const srcType = (i.article as { source_type?: string })?.source_type
      if (srcType) return srcType === "insight"
      return !CAMPAIGN_SOURCES.includes((i.article as { source?: string })?.source ?? "")
    })
    .slice(0, 7) as Insight[]

  const featured = recentInsights[0]
  const rest = recentInsights.slice(1, 7)

  // 브랜드 엔티티 구조화데이터 (Organization + WebSite) — 소셜 채널 연결
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "MarkLens",
        url: base,
        logo: `${base}/icon.svg`,
        description: "마케팅 트렌드를 분석하고 실무에 바로 적용 가능한 인사이트를 제공합니다.",
        sameAs: [
          "https://www.instagram.com/marklens.site",
          "https://www.threads.com/@marklens.site",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: "MarkLens",
        url: base,
        inLanguage: "ko-KR",
        publisher: { "@id": `${base}/#organization` },
      },
    ],
  }

  return (
    <div className="flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            매주 월요일 7:30 AM 발행
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.12] mb-5 text-gray-900 dark:text-gray-100">
            마케팅 트렌드를 읽고,<br />
            <span className="text-gray-500 dark:text-gray-500">실무를 준비하다.</span>
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
            글로벌 마케팅 아티클을 AI로 분석해 왜 중요한지, 어떻게 적용할 수 있는지,
            포트폴리오에 어떻게 녹여낼 수 있는지를 함께 전달합니다.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/newsletter"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
            >
              뉴스레터 구독하기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              인사이트 보기
            </Link>
          </div>
        </div>
      </section>

      {/* Latest Insights */}
      {recentInsights.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">최신 인사이트</h2>
            <Link href="/insights" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors flex items-center gap-1">
              전체 보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {featured && (
            <div className="mb-5">
              <InsightCard insight={featured} size="large" />
            </div>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Newsletter CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">MarkLens Weekly</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              매주 월요일, 한 주를 여는 마케팅 브리핑
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              5가지 섹션 — 무료, 언제든 취소 가능
            </p>
          </div>
          <Link
            href="/newsletter"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            무료 구독하기 <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

    </div>
  )
}
