import { createClient } from "@/lib/supabase/server"
import { formatDate, truncate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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
    .select("*, article:articles(*)")
    .order("created_at", { ascending: false })
    .limit(60)

  if (category) query = query.eq("category", category)

  const { data: insights } = await query

  const grouped: Record<string, typeof insights> = {}
  if (insights) {
    for (const insight of insights) {
      const cat = insight.category ?? "기타"
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat]!.push(insight)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">케이스 라이브러리</h1>
        <p className="text-sm text-muted-foreground">
          카테고리별로 정리된 마케팅 인사이트 아카이브
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-12">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.slug ? `/library?category=${cat.slug}` : "/library"}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              category === cat.slug || (!category && !cat.slug)
                ? "bg-foreground text-background border-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {!insights || insights.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          아직 등록된 케이스가 없습니다.
        </div>
      ) : category ? (
        // 특정 카테고리 선택 시 일반 그리드
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {insights.map((insight: any) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        // 전체: 카테고리별 그룹
        <div className="space-y-14">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold">{cat}</h2>
                <Link
                  href={`/library?category=${cat}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  전체 보기 →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items?.slice(0, 3).map((insight: any) => (
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

function InsightCard({ insight }: { insight: any }) {
  return (
    <Link
      href={`/insights/${insight.slug}`}
      className="group block border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors"
    >
      <Badge variant="secondary" className="text-xs font-normal mb-3">
        {insight.category}
      </Badge>
      <h3 className="font-medium text-sm leading-snug mb-2 group-hover:text-foreground/80 line-clamp-2">
        {insight.article?.title}
      </h3>
      {insight.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
          {truncate(insight.summary, 100)}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{insight.article?.source_name}</span>
        <span>{formatDate(insight.created_at)}</span>
      </div>
    </Link>
  )
}
