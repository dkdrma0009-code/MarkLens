import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getCategoryMeta } from "@/lib/category"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

interface Props {
  params: Promise<{ slug: string }>
}

const SECTIONS = [
  { key: "summary",               label: "핵심 요약",     number: "01" },
  { key: "why_it_matters",        label: "왜 중요한가",   number: "02" },
  { key: "practical_applications",label: "실전 적용법",   number: "03" },
  { key: "framework_analysis",    label: "프레임워크",    number: "04" },
  { key: "portfolio_usage",       label: "포트폴리오 활용", number: "05" },
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

  await supabase
    .from("insights")
    .update({ view_count: (insight.view_count || 0) + 1 })
    .eq("id", insight.id)

  const article = insight.article
  const meta = getCategoryMeta(insight.category)

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">

      {/* Back */}
      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-10"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        인사이트 목록
      </Link>

      {/* Hero thumbnail */}
      {article?.image_url && (
        <div className="rounded-2xl overflow-hidden mb-8 h-56">
          <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Category + Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full text-white"
          style={{ backgroundColor: meta.color }}
        >
          {insight.category}
        </span>
        {insight.tags?.slice(0, 3).map((tag: string) => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500">
            {tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-snug mb-5">
        {article?.title}
      </h1>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400 mb-8 pb-8 border-b border-gray-100">
        <span className="font-medium text-gray-600">{article?.source_name}</span>
        {article?.author && <span>{article.author}</span>}
        <span>
          {new Date(insight.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
        </span>
        {article?.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors ml-auto"
          >
            원문 보기 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Byline */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-0.5 h-4 rounded-full" style={{ backgroundColor: meta.color }} />
        <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">MarkLens 에디터의 시각</p>
      </div>

      {/* Key Takeaways — always at top */}
      {insight.key_takeaways && insight.key_takeaways.length > 0 && (
        <div className="rounded-2xl p-6 mb-10" style={{ backgroundColor: meta.color + "0f" }}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: meta.color }}>
            이것만 기억하세요
          </h2>
          <ul className="space-y-2.5">
            {insight.key_takeaways.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-700">
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content Sections */}
      <div className="space-y-10">
        {SECTIONS.map(({ key, label, number }) => {
          const content = insight[key]
          if (!content) return null
          return (
            <section key={key}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-xs font-mono text-gray-300">{number}</span>
                <h2 className="text-base font-bold text-gray-900">{label}</h2>
              </div>
              <div className="text-[15px] leading-[1.85] text-gray-700 whitespace-pre-wrap">
                {content}
              </div>
            </section>
          )
        })}

        {/* Interview Points */}
        {insight.interview_points && insight.interview_points.length > 0 && (
          <section>
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-xs font-mono text-gray-300">06</span>
              <h2 className="text-base font-bold text-gray-900">면접에서 써먹기</h2>
            </div>
            <div className="space-y-4">
              {insight.interview_points.map((item: string, i: number) => (
                <div key={i} className="rounded-xl border border-gray-100 p-5">
                  <div className="text-xs font-bold text-gray-400 mb-2">Q{i + 1}</div>
                  <p className="text-[15px] leading-relaxed text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-14 pt-8 border-t border-gray-100">
        <Link
          href="/insights"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          모든 인사이트 보기
        </Link>
      </div>
    </div>
  )
}
