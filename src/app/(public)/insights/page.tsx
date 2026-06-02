import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { formatDate, truncate } from "@/lib/utils"
import Link from "next/link"
import type { Insight, Article } from "@/types"

const CATEGORIES = [
  { label: "전체", slug: "" },
  { label: "브랜딩", slug: "branding" },
  { label: "퍼포먼스 마케팅", slug: "performance-marketing" },
  { label: "SEO", slug: "seo" },
  { label: "콘텐츠 마케팅", slug: "content-marketing" },
  { label: "소셜 미디어", slug: "social-media" },
  { label: "AI 마케팅", slug: "ai-marketing" },
  { label: "CRM", slug: "crm" },
  { label: "소비자 심리", slug: "consumer-psychology" },
]

interface Props {
  searchParams: Promise<{ category?: string; q?: string }>
}

export default async function InsightsPage({ searchParams }: Props) {
  const { category, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("insights")
    .select("*, article:articles(*)")
    .order("created_at", { ascending: false })
    .limit(30)

  if (category) query = query.eq("category", category)
  if (q) query = query.ilike("article.title", `%${q}%`)

  const { data: insights } = await query

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">인사이트</h1>
        <p className="text-sm text-muted-foreground">
          글로벌 마케팅 아티클에서 추출한 실무 인사이트
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-10">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.slug ? `/insights?category=${cat.slug}` : "/insights"}
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

      {/* Articles Grid */}
      {!insights || insights.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          아직 발행된 인사이트가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.map((insight: Insight & { article: Article }) => (
            <Link
              key={insight.id}
              href={`/insights/${insight.slug}`}
              className="group block border border-border rounded-lg p-5 hover:border-foreground/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-xs font-normal">
                  {insight.category}
                </Badge>
                {insight.is_featured && (
                  <Badge variant="outline" className="text-xs font-normal">
                    추천
                  </Badge>
                )}
              </div>
              <h2 className="font-medium text-sm leading-snug mb-2 group-hover:text-foreground/80 transition-colors line-clamp-2">
                {insight.article?.title}
              </h2>
              {insight.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                  {truncate(insight.summary, 120)}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{insight.article?.source_name}</span>
                <span>{formatDate(insight.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
