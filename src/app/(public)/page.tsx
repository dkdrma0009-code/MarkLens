import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { createPublicClient } from "@/lib/supabase/server"
import InsightCard from "@/components/InsightCard"
import NewsletterInlineCta from "@/components/NewsletterInlineCta"
import type { Insight } from "@/types"

// 홈 전용 메타데이터 — 구글이 본문 대신 의도한 description을 쓰도록. 타깃 키워드 자연 포함.
export const metadata: Metadata = {
  title: "MarkLens — 마케팅 트렌드를 읽고, 실무를 준비하다",
  description:
    "글로벌 마케팅 트렌드와 인사이트를 선별해 전합니다. 주니어 마케터와 취준생을 위해 왜 중요한지, 실무와 포트폴리오·면접에 어떻게 적용할지까지 짚어 드립니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MarkLens — 마케팅 트렌드를 읽고, 실무를 준비하다",
    description:
      "글로벌 마케팅 트렌드와 인사이트를 선별해, 실무·포트폴리오·면접에 어떻게 적용할지까지 짚어 드립니다.",
    url: "https://marklens.site",
    siteName: "MarkLens",
    type: "website",
  },
}

export const revalidate = 3600

const CAMPAIGN_SOURCES = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

export default async function HomePage() {
  const supabase = createPublicClient()

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
            글로벌 마케팅 트렌드를 선별해 왜 중요한지, 어떻게 적용할 수 있는지,
            포트폴리오와 면접에 어떻게 녹여낼 수 있는지까지 짚어 전달합니다.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#subscribe"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
            >
              뉴스레터 구독하기 <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              인사이트 보기
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            🎁 지금 구독하면 「마케팅 면접 질문 40선」 PDF를 드려요
          </p>
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

      {/* Newsletter CTA — 인라인 구독 폼 (페이지 이동 없이 그 자리에서 구독) */}
      <section id="subscribe" className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">MarkLens Weekly</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
              매주 월요일, 면접에서 바로 쓸 수 있는<br />
              마케팅 트렌드 3개를 정리해 드립니다
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              포트폴리오에 녹이는 법과 면접 답변 예시까지.
            </p>
          </div>
          <NewsletterInlineCta location="home_inline" />
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">무료 · 언제든 구독 취소 가능</p>
        </div>
      </section>

    </div>
  )
}
