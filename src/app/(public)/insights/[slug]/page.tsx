import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getCategoryMeta } from "@/lib/category"
import Link from "next/link"
import { ArrowLeft, ExternalLink, ArrowRight } from "lucide-react"
import ArticleChat from "@/components/ArticleChat"
import ArticleFeedback from "@/components/ArticleFeedback"
import ShareButtons from "@/components/ShareButtons"
import ViewCounter from "@/components/ViewCounter"
import Image from "next/image"
import type { Metadata } from "next"

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: insight } = await supabase
    .from("insights")
    .select("hook, summary, category, article:articles(title, image_url, source_name)")
    .eq("slug", slug)
    .single()

  if (!insight) return {}

  const title = insight.hook ?? (insight.article as any)?.title ?? "MarkLens 인사이트"
  const description = insight.summary ?? "글로벌 마케팅 아티클에서 추출한 실무 인사이트"
  const image = (insight.article as any)?.image_url
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"

  return {
    title: `${title} | MarkLens`,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/insights/${slug}`,
      siteName: "MarkLens",
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
      type: "article",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function InsightDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: insight } = await supabase
    .from("insights")
    .select("*, article:articles(*)")
    .eq("slug", slug)
    .single()

  if (!insight) notFound()

  const { data: related } = await supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("category", insight.category)
    .eq("articles.status", "published")
    .neq("id", insight.id)
    .order("created_at", { ascending: false })
    .limit(3)

  const article = insight.article
  const meta = getCategoryMeta(insight.category)

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">

      {/* Back */}
      <Link href="/insights"
        className="inline-flex items-center gap-1.5 text-base text-gray-400 hover:text-gray-900 transition-colors mb-10">
        <ArrowLeft className="w-4 h-4" />
        인사이트 목록
      </Link>

      {/* Thumbnail */}
      {article?.image_url && (
        <div className="relative rounded-2xl overflow-hidden mb-8 h-72">
          <Image src={article.image_url} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 672px" />
        </div>
      )}

      {/* Video Embed */}
      {insight.video_url && (
        <div className="rounded-2xl overflow-hidden mb-8 aspect-video">
          <VideoEmbed url={insight.video_url} />
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base text-gray-400 pb-8 border-b border-gray-100 mb-12">
        <span className="font-semibold text-gray-600">{article?.source_name}</span>
        {article?.author && <span>· {article.author}</span>}
        <span>· {new Date(insight.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</span>
        <div className="ml-auto flex items-center gap-3">
          {article?.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-gray-900 transition-colors">
              원문 보기 <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <ShareButtons slug={insight.slug} title={insight.hook ?? article?.title ?? ""} />
        </div>
      </div>

      {/* ── 핵심 요약 ── */}
      {insight.summary && (
        <div className="rounded-2xl p-7 mb-14" style={{ backgroundColor: meta.color + "12" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: meta.color }}>핵심 요약</span>
          </div>
          <p className="text-xl font-medium leading-relaxed text-gray-800">{insight.summary}</p>
        </div>
      )}

      {/* ── 이것만 기억하세요 ── */}
      {insight.key_takeaways?.length > 0 && (
        <Section title="이것만 기억하세요">
          <div className="space-y-3">
            {insight.key_takeaways.map((item: string, i: number) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: meta.color }}>
                  {i + 1}
                </span>
                <p className="text-lg leading-relaxed text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 왜 중요한가 ── */}
      {insight.why_it_matters && (
        <Section title="왜 중요한가">
          <Prose text={insight.why_it_matters} />
        </Section>
      )}

      {/* ── 실전 적용법 ── */}
      {insight.practical_applications && (
        <Section title="실전 적용법">
          <Prose text={insight.practical_applications} />
        </Section>
      )}

      {/* ── 프레임워크 분석 ── */}
      {insight.framework_analysis && (
        <Section title="프레임워크 분석">
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-7">
            <Prose text={insight.framework_analysis} />
          </div>
        </Section>
      )}

      {/* ── 포트폴리오 활용 ── STAR 파싱 */}
      {insight.portfolio_usage && (
        <Section title="포트폴리오 활용">
          <StarBlock text={insight.portfolio_usage} color={meta.color} />
        </Section>
      )}

      {/* ── 실생활에서 쓰기 ── Q/A 파싱 */}
      {insight.interview_points?.length > 0 && (
        <Section title="실생활에서 쓰기">
          <div className="space-y-5">
            {insight.interview_points.map((item: string, i: number) => (
              <QABlock key={i} text={item} index={i} color={meta.color} />
            ))}
          </div>
        </Section>
      )}

      {/* ── 관련 인사이트 ── */}
      {related && related.length > 0 && (
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">관련 인사이트</h2>
          <div className="space-y-3">
            {related.map((r: any) => {
              const rm = getCategoryMeta(r.category)
              return (
                <Link
                  key={r.id}
                  href={`/insights/${r.slug}`}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group"
                >
                  {r.article?.image_url ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <Image src={r.article.image_url} alt="" fill className="object-cover" sizes="64px" />
                    </div>
                  ) : (
                    <div className={`w-16 h-16 rounded-xl flex-shrink-0 bg-gradient-to-br ${rm.gradient}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white mb-1.5 inline-block"
                      style={{ backgroundColor: rm.color }}>
                      {r.category}
                    </span>
                    <p className="text-base font-semibold text-gray-900 group-hover:text-gray-600 transition-colors line-clamp-2 leading-snug">
                      {r.hook ?? r.article?.title}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="rounded-2xl p-8 mb-8 text-center" style={{ backgroundColor: meta.color }}>
        <p className="text-sm font-bold text-white/70 uppercase tracking-widest mb-2">MarkLens Weekly</p>
        <h3 className="text-2xl font-bold text-white mb-3 text-balance">
          매주 월요일, 이런 인사이트를 이메일로 받아보세요
        </h3>
        <p className="text-white/80 text-base mb-6">
          This Week&apos;s Signals, Case of the Week, Portfolio Insight 등 5가지 섹션 무료 발행
        </p>
        <Link href="/newsletter"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-sm font-bold hover:bg-gray-100 transition-colors"
          style={{ color: meta.color }}>
          무료 구독하기 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── 피드백 ── */}
      <div className="mb-10">
        <ArticleFeedback insightId={insight.id} color={meta.color} />
      </div>

      {/* Footer */}
      <div className="pt-8 border-t border-gray-100">
        <Link href="/insights"
          className="inline-flex items-center gap-2 text-base text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 모든 인사이트 보기
        </Link>
      </div>

      <ViewCounter slug={insight.slug} />

      {/* ── 챗봇 (floating) ── */}
      <ArticleChat
        color={meta.color}
        context={[
          insight.hook,
          insight.summary,
          insight.why_it_matters,
          insight.practical_applications,
          insight.framework_analysis,
        ].filter(Boolean).join("\n\n")}
      />
    </div>
  )
}

/* ─── 공통 컴포넌트 ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-14">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  )
}

const ORDINAL_RE = /^(첫째|둘째|셋째|넷째|다섯째|1\.|2\.|3\.|4\.|5\.)[,，\s]/

function Prose({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter(Boolean)

  // 전부 순서 단락이면 카드 리스트로 렌더
  const allOrdinal = paragraphs.length > 1 && paragraphs.every(p => ORDINAL_RE.test(p))
  if (allOrdinal) {
    return (
      <div className="space-y-3">
        {paragraphs.map((p, i) => {
          const match = p.match(ORDINAL_RE)!
          const label = match[1]
          const body = p.slice(match[0].length).trim()
          return (
            <div key={i} className="flex gap-4 rounded-2xl bg-gray-50 border border-gray-100 p-5">
              <span className="flex-shrink-0 text-sm font-bold text-gray-400 w-8 pt-0.5">{label}</span>
              <p className="text-lg leading-[1.9] text-gray-700"><InlineText text={body} /></p>
            </div>
          )
        })}
      </div>
    )
  }

  // 일부만 순서 단락이거나 일반 단락
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
              <p className="text-lg leading-[1.9] text-gray-700"><InlineText text={body} /></p>
            </div>
          )
        }
        return (
          <p key={i} className="text-lg leading-[1.95] text-gray-600">
            <InlineText text={p} />
          </p>
        )
      })}
    </div>
  )
}

// 따옴표 안 텍스트를 강조 스팬으로 변환
function InlineText({ text }: { text: string }) {
  const parts = text.split(/('[^']{1,40}')/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("'") && part.endsWith("'") ? (
          <mark key={i} className="bg-yellow-100 text-gray-900 px-0.5 rounded not-italic font-medium" style={{ background: "none", borderBottom: "2px solid #fbbf24" }}>
            {part.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

/* STAR 패턴 파서 — Situation/Task/Action/Result/포트폴리오 팁 */
const STAR_LABELS: { key: string; label: string; emoji: string }[] = [
  { key: "Situation", label: "상황", emoji: "📍" },
  { key: "Task",      label: "과제", emoji: "🎯" },
  { key: "Action",    label: "실행", emoji: "⚡" },
  { key: "Result",    label: "결과", emoji: "📈" },
  { key: "포트폴리오 팁", label: "팁", emoji: "💡" },
]

function StarBlock({ text }: { text: string; color?: string }) {
  const blocks: { label: string; emoji: string; content: string }[] = []
  let remaining = text

  for (const { key, label, emoji } of STAR_LABELS) {
    const regex = new RegExp(`${key}:\\s*`, "i")
    const idx = remaining.search(regex)
    if (idx === -1) continue

    const before = remaining.slice(0, idx).trim()
    if (before) blocks.push({ label: "기타", emoji: "•", content: before })

    const after = remaining.slice(idx).replace(regex, "")
    let end = after.length
    for (const { key: nextKey } of STAR_LABELS) {
      if (nextKey === key) continue
      const ni = after.search(new RegExp(`${nextKey}:\\s*`, "i"))
      if (ni !== -1 && ni < end) end = ni
    }
    blocks.push({ label, emoji, content: after.slice(0, end).trim() })
    remaining = after.slice(end)
  }
  if (remaining.trim()) blocks.push({ label: "기타", emoji: "•", content: remaining.trim() })

  // STAR 패턴이 하나도 감지 안 되면 일반 텍스트
  if (blocks.length === 0) return <Prose text={text} />

  return (
    <div className="space-y-4">
      {blocks.filter(b => b.content).map((b, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-base font-bold text-gray-700">{b.emoji} {b.label}</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-lg leading-[1.9] text-gray-600">{b.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Q/A 파서 */
function QABlock({ text, index, color }: { text: string; index: number; color: string }) {
  const qMatch = text.match(/Q[:：]\s*['"]?(.+?)['"]?\s*A[:：]\s*([\s\S]+)/i)
  if (qMatch) {
    return (
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100" style={{ backgroundColor: color + "0d" }}>
          <p className="text-lg font-semibold text-gray-900">{qMatch[1].replace(/['"]$/,"").replace(/^['"]/,"")}</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-lg leading-[1.9] text-gray-600">{qMatch[2].trim()}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 p-6">
      <span className="text-sm font-bold text-gray-400 block mb-3">상황 {index + 1}</span>
      <p className="text-lg leading-[1.9] text-gray-700">{text}</p>
    </div>
  )
}

function VideoEmbed({ url }: { url: string }) {
  const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]
  if (youtubeId) {
    return <iframe src={`https://www.youtube.com/embed/${youtubeId}`}
      className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
  if (vimeoId) {
    return <iframe src={`https://player.vimeo.com/video/${vimeoId}`}
      className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  return null
}
