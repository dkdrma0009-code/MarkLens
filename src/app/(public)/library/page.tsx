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
  searchParams: Promise<{ category?: string }>
}

export default async function LibraryPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(60)

  if (category) query = query.eq("category", category)

  const { data: insights } = await query

  const grouped: Record<string, any[]> = {}
  if (insights && !category) {
    for (const insight of insights) {
      const cat = insight.category ?? "기타"
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(insight)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">케이스 라이브러리</h1>
        <p className="text-gray-500">카테고리별로 정리된 마케팅 인사이트 아카이브</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.slug ? `/library?category=${cat.slug}` : "/library"}
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
          아직 등록된 케이스가 없습니다.
        </div>
      ) : category ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {insights.map((insight: any) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="space-y-14">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">{cat}</h2>
                <Link
                  href={`/library?category=${cat}`}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  전체 보기 →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.slice(0, 3).map((insight: any) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
