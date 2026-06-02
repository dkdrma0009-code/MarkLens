import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

interface Props {
  params: Promise<{ slug: string }>
}

const SECTIONS = [
  { key: "summary", label: "핵심 요약" },
  { key: "why_it_matters", label: "왜 중요한가" },
  { key: "practical_applications", label: "실전 적용법" },
  { key: "framework_analysis", label: "프레임워크 분석" },
  { key: "portfolio_usage", label: "포트폴리오 활용" },
] as const

export default async function InsightDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: insight } = await supabase
    .from("insights")
    .select("*, article:articles(*)")
    .eq("slug", slug)
    .single()

  if (!insight) notFound()

  // 조회수 증가
  await supabase
    .from("insights")
    .update({ view_count: (insight.view_count || 0) + 1 })
    .eq("id", insight.id)

  const article = insight.article

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Back */}
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        인사이트 목록
      </Link>

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs font-normal">
            {insight.category}
          </Badge>
          {insight.tags?.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-snug mb-4">
          {article?.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{article?.source_name}</span>
          {article?.author && <span>{article.author}</span>}
          <span>{formatDate(insight.created_at)}</span>
          {article?.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              원문 보기 <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* MarkLens 에디터 바이라인 */}
      <div className="border-l-2 border-border pl-4 mb-12">
        <p className="text-xs text-muted-foreground">MarkLens 에디터의 시각</p>
      </div>

      {/* Content Sections */}
      <div className="space-y-12">
        {SECTIONS.map(({ key, label }) => {
          const content = insight[key]
          if (!content) return null
          return (
            <section key={key}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {label}
              </h2>
              <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {content}
              </div>
            </section>
          )
        })}

        {/* Key Takeaways */}
        {insight.key_takeaways && insight.key_takeaways.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              이것만 기억하세요
            </h2>
            <ul className="space-y-2">
              {insight.key_takeaways.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="text-muted-foreground mt-0.5">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Interview Points */}
        {insight.interview_points && insight.interview_points.length > 0 && (
          <section className="border border-border rounded-lg p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              면접에서 써먹기
            </h2>
            <ul className="space-y-3">
              {insight.interview_points.map((item: string, i: number) => (
                <li key={i} className="text-sm leading-relaxed text-foreground/90">
                  <span className="font-medium text-xs text-muted-foreground mr-2">Q{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
