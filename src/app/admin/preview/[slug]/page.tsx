import { createAdminClient } from "@/lib/supabase/admin"
import { notFound, redirect } from "next/navigation"
import { getCategoryMeta } from "@/lib/category"
import Link from "next/link"
import { ArrowLeft, ExternalLink, ArrowRight } from "lucide-react"

// 실제 발행 페이지와 동일한 레이아웃 — 어드민 전용 (RLS 우회)

interface Props {
  params: Promise<{ slug: string }>
}

const ORDINAL_RE = /^(첫째|둘째|셋째|넷째|다섯째|1\.|2\.|3\.|4\.|5\.)[,，\s]/

function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter(Boolean)
  return (
    <div className="space-y-5">
      {paragraphs.map((p, i) => {
        const match = p.match(ORDINAL_RE)
        if (match) {
          const label = match[1]
          const body = p.slice(match[0].length).trim()
          return (
            <div key={i} className="flex gap-4 rounded-2xl bg-gray-50 border border-gray-100 p-5">
              <span className="flex-shrink-0 text-sm font-bold text-gray-400 w-8 pt-0.5">{label}</span>
              <p className="text-lg leading-[1.9] text-gray-700">{body}</p>
            </div>
          )
        }
        return <p key={i} className="text-lg leading-[1.95] text-gray-600">{p}</p>
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-14">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  )
}

export default async function AdminPreviewPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: insight } = await supabase
    .from("insights")
    .select("*, article:articles(*)")
    .eq("slug", slug)
    .single()

  if (!insight) notFound()

  const article = insight.article as any
  const meta = getCategoryMeta(insight.category)

  return (
    <div className="min-h-screen bg-white">
      {/* 어드민 프리뷰 배너 */}
      <div className="sticky top-0 z-50 bg-amber-400 text-amber-900 text-xs font-semibold text-center py-2 flex items-center justify-center gap-3">
        <span>👁 미리보기 모드 — 실제 발행 전 검토용입니다</span>
        <Link href="/admin/articles" className="underline hover:opacity-70">
          어드민으로 돌아가기
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-14">

        <Link href="/admin/articles"
          className="inline-flex items-center gap-1.5 text-base text-gray-400 hover:text-gray-900 transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" />
          어드민
        </Link>

        {/* Thumbnail */}
        {article?.image_url && (
          <div className="rounded-2xl overflow-hidden mb-8 h-72">
            <img src={article.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Category */}
        <div className="mb-5">
          <span className="text-sm font-bold px-3 py-1.5 rounded-full text-white"
            style={{ backgroundColor: meta.color }}>
            {insight.category}
          </span>
        </div>

        {/* Hook */}
        {insight.hook && (
          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 mb-4 text-balance">
            {insight.hook}
          </h1>
        )}

        {/* Original title */}
        <p className="text-lg text-gray-400 mb-6">{article?.title}</p>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-gray-400 pb-8 border-b border-gray-100 mb-12">
          <span className="font-semibold text-gray-600">{article?.source_name}</span>
          {article?.author && <span>· {article.author}</span>}
          <span>· {new Date(insight.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
          {article?.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors">
              원문 보기 <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* 핵심 요약 */}
        {insight.summary && (
          <div className="rounded-2xl p-7 mb-14" style={{ backgroundColor: meta.color + "12" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: meta.color }}>핵심 요약</span>
            </div>
            <p className="text-xl font-medium leading-relaxed text-gray-800">{insight.summary}</p>
          </div>
        )}

        {/* 이것만 기억하세요 */}
        {insight.key_takeaways?.length > 0 && (
          <Section title="이것만 기억하세요">
            <div className="space-y-3">
              {insight.key_takeaways.map((item: string, i: number) => (
                <div key={i} className="flex gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: meta.color }}>{i + 1}</span>
                  <p className="text-lg leading-relaxed text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {insight.why_it_matters && (
          <Section title="왜 중요한가"><Prose text={insight.why_it_matters} /></Section>
        )}

        {insight.practical_applications && (
          <Section title="실전 적용법"><Prose text={insight.practical_applications} /></Section>
        )}

        {insight.framework_analysis && (
          <Section title="프레임워크 분석">
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-7">
              <Prose text={insight.framework_analysis} />
            </div>
          </Section>
        )}

        {insight.portfolio_usage && (
          <Section title="지금 바로 해볼 수 있는 프로젝트">
            <Prose text={insight.portfolio_usage} />
          </Section>
        )}

        {insight.interview_points?.length > 0 && (
          <Section title="실생활에서 쓰기">
            <div className="space-y-5">
              {insight.interview_points.map((item: string, i: number) => {
                const qMatch = item.match(/Q[:：]\s*['"]?(.+?)['"]?\s*A[:：]\s*([\s\S]+)/i)
                if (qMatch) {
                  return (
                    <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="px-6 py-5 border-b border-gray-100" style={{ backgroundColor: meta.color + "0d" }}>
                        <p className="text-lg font-semibold text-gray-900">{qMatch[1]}</p>
                      </div>
                      <div className="px-6 py-5">
                        <p className="text-lg leading-[1.9] text-gray-600">{qMatch[2].trim()}</p>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={i} className="rounded-2xl border border-gray-100 p-6">
                    <span className="text-sm font-bold text-gray-400 block mb-3">상황 {i + 1}</span>
                    <p className="text-lg leading-[1.9] text-gray-700">{item}</p>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* CTA 미리보기 */}
        <div className="rounded-2xl p-8 mb-8 text-center" style={{ backgroundColor: meta.color }}>
          <p className="text-sm font-bold text-white/70 uppercase tracking-widest mb-2">MarkLens Weekly</p>
          <h3 className="text-2xl font-bold text-white mb-3 text-balance">
            매주 월요일, 이런 인사이트를 이메일로 받아보세요
          </h3>
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-sm font-bold opacity-80"
            style={{ color: meta.color }}>
            무료 구독하기 <ArrowRight className="w-4 h-4" />
          </div>
        </div>

      </div>
    </div>
  )
}
