import { createClient } from "@/lib/supabase/server"
import InsightCard from "@/components/InsightCard"
import Link from "next/link"

const CATEGORIES = [
  { label: "전체", slug: "" },
  { label: "브랜딩", slug: "브랜딩" },
  { label: "퍼포먼스 마케팅", slug: "퍼포먼스 마케팅" },
  { label: "SEO", slug: "SEO" },
  { label: "콘텐츠 마케팅", slug: "콘텐츠 마케팅" },
  { label: "소셜 미디어", slug: "소셜 미디어" },
  { label: "AI 마케팅", slug: "AI 마케팅" },
  { label: "CRM", slug: "CRM" },
  { label: "소비자 심리", slug: "소비자 심리" },
]

interface Props {
  searchParams: Promise<{ category?: string; q?: string }>
}

export default async function InsightsPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("insights")
    .select("*, article:articles(*)")
    .order("created_at", { ascending: false })
    .limit(30)

  if (category) query = query.eq("category", category)

  const { data: insights } = await query
  const featured = insights?.[0]
  const rest = insights?.slice(1) ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">인사이트</h1>
        <p className="text-gray-500">글로벌 마케팅 아티클에서 추출한 실무 인사이트</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.slug ? `/insights?category=${cat.slug}` : "/insights"}
            className={`px-4 py-1.5 text-sm rounded-full border font-medium transition-all ${
              category === cat.slug || (!category && !cat.slug)
                ? "bg-black text-white border-black"
                : "border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {!insights || insights.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          아직 발행된 인사이트가 없습니다.
        </div>
      ) : (
        <>
          {/* Featured — first article large */}
          {!category && featured && (
            <div className="mb-8">
              <InsightCard insight={featured as any} size="large" />
            </div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(category ? insights : rest).map((insight: any) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
