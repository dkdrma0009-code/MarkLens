import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import InsightCard from "@/components/InsightCard"
import Link from "next/link"

export const metadata: Metadata = {
  title: "캠페인 라이브러리 — MarkLens",
  description: "Muse by Clio · Adweek · Campaign Brief · Creative Review에서 엄선한 실제 브랜드 & 캠페인 사례 모음.",
  alternates: { canonical: "/library" },
}

export const revalidate = 3600

const CASE_SOURCES = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

const CATEGORIES = [
  { label: "전체", slug: "" },
  { label: "브랜딩", slug: "브랜딩" },
  { label: "퍼포먼스 마케팅", slug: "퍼포먼스 마케팅" },
  { label: "콘텐츠 마케팅", slug: "콘텐츠 마케팅" },
  { label: "소셜 미디어", slug: "소셜 미디어" },
  { label: "AI 마케팅", slug: "AI 마케팅" },
  { label: "SEO", slug: "SEO" },
  { label: "소비자 심리", slug: "소비자 심리" },
]

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function LibraryPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .order("created_at", { ascending: false })
    .limit(200)

  if (category) query = query.eq("category", category)

  const { data: allInsights } = await query

  // source_type 기반 필터 (없으면 source slug 기반 폴백)
  const insights = (allInsights ?? []).filter(
    (i) => {
      const srcType = i.article?.source_type
      if (srcType) return i.article?.status === "published" && srcType === "campaign"
      return i.article?.status === "published" && CASE_SOURCES.includes(i.article?.source)
    }
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1 text-gray-900 dark:text-gray-100">캠페인</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Muse by Clio · Adweek · Campaign Brief · Creative Review에서 엄선한 실제 브랜드 & 캠페인 사례
        </p>
      </div>

      {/* Category Filter — 모바일: 좌우 스크롤 / 데스크탑: 줄바꿈 */}
      <div className="overflow-x-auto scrollbar-hide mb-10 md:overflow-visible">
        <div className="flex gap-2 pb-0.5 w-max md:w-auto md:flex-wrap">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug ? `/library?category=${cat.slug}` : "/library"}
              className={`px-4 py-1.5 text-sm rounded-full border font-medium transition-all whitespace-nowrap ${
                category === cat.slug || (!category && !cat.slug)
                  ? "bg-black text-white border-black dark:bg-white dark:text-black"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {!insights || insights.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg mb-2">콘텐츠 준비 중입니다.</p>
          <p className="text-sm">Muse by Clio, Adweek, Campaign Brief, Creative Review의 최신 사례를 분석 중입니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
