import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getCategoryMeta } from "@/lib/category"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import ArticleChat from "@/components/ArticleChat"
import ArticleFeedback from "@/components/ArticleFeedback"
import InsightCard from "@/components/InsightCard"
import InsightQuiz from "@/components/InsightQuiz"
import InterviewSoundbites from "@/components/InterviewSoundbites"
import ShareButtons from "@/components/ShareButtons"
import ViewCounter from "@/components/ViewCounter"
import Image from "next/image"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

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

  const article = insight.article as { title?: string; image_url?: string } | null
  const title = insight.hook ?? article?.title ?? "MarkLens 인사이트"
  const description = insight.summary ?? "글로벌 마케팅 아티클에서 추출한 실무 인사이트"
  const image = article?.image_url
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"

  return {
    title: `${title} | MarkLens`,
    description,
    alternates: { canonical: `${base}/insights/${slug}` },
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

  // 구글 리치 스니펫용 Article 구조화 데이터
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: insight.hook ?? article?.title ?? "",
        description: insight.summary ?? undefined,
        ...(article?.image_url ? { image: [article.image_url] } : {}),
        datePublished: insight.created_at,
        dateModified: insight.updated_at ?? insight.created_at,
        articleSection: insight.category ?? undefined,
        mainEntityOfPage: { "@type": "WebPage", "@id": `${base}/insights/${slug}` },
        author: { "@type": "Organization", name: "MarkLens", url: base },
        publisher: {
          "@type": "Organization",
          name: "MarkLens",
          url: base,
          logo: { "@type": "ImageObject", url: `${base}/icon.svg` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "인사이트", item: `${base}/insights` },
          { "@type": "ListItem", position: 2, name: insight.hook ?? article?.title ?? "", item: `${base}/insights/${slug}` },
        ],
      },
    ],
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back */}
      <Link href="/insights"
        className="inline-flex items-center gap-1.5 text-base text-gray-400 hover:text-gray-900 transition-colors mb-10">
        <ArrowLeft className="w-4 h-4" />
        인사이트 목록
      </Link>

      {/* 썸네일 — 상단에는 이미지만 */}
      {article?.image_url && (
        <div className="relative rounded-2xl overflow-hidden mb-8 h-72">
          <Image src={article.image_url} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 672px" />
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
          <SentenceText text={insight.summary} className="text-xl font-medium leading-relaxed text-gray-800" />
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
                <SentenceText text={item} className="text-lg leading-relaxed text-gray-700" />
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

      {/* ── 면접 한 마디 ── */}
      {insight.interview_points?.length > 0 && (
        <Section title="면접에서 이렇게 말해보세요">
          <InterviewSoundbites items={insight.interview_points} color={meta.color} />
        </Section>
      )}

      {/* ── 마케팅 학습하기 ── */}
      {(insight.quiz?.questions?.length > 0 || insight.quiz?.question) && (
        <Section title="마케팅 학습하기">
          <InsightQuiz quiz={insight.quiz} color={meta.color} />
        </Section>
      )}

      {/* ── 영상 ── */}
      {insight.video_url && (
        <Section title="관련 영상">
          <div className="rounded-2xl overflow-hidden aspect-video">
            <VideoEmbed url={insight.video_url} />
          </div>
        </Section>
      )}

      {/* ── 피드백 + CTA ── */}
      <div className="mb-14">
        <ArticleFeedback insightId={insight.id} color={meta.color} />
      </div>

      {/* ── 관련 인사이트 ── */}
      {related && related.length > 0 && (
        <div className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">관련 인사이트</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {related.map((r) => (
              <InsightCard key={r.id} insight={r} />
            ))}
          </div>
        </div>
      )}

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
          insight.hook && `제목: ${insight.hook}`,
          insight.summary && `핵심 요약: ${insight.summary}`,
          insight.key_takeaways?.length && `핵심 포인트:\n${insight.key_takeaways.join('\n')}`,
          insight.why_it_matters && `왜 중요한가: ${insight.why_it_matters}`,
          insight.practical_applications && `실전 적용법: ${insight.practical_applications}`,
          insight.interview_points?.length && `실생활 적용:\n${insight.interview_points.join('\n')}`,
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

function splitInlineNumbers(text: string): string[] {
  const parts = text.split(/(?=\(\d+\)\s)/).filter(Boolean)
  return parts.length > 1 ? parts : [text]
}

function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let remaining = text.trim()
  // 마침표/물음표/느낌표로 끝나는 문장 구분
  const SENT_RE = /^(.+?[다요죠니까습][.?!]|.+?[.?!])\s+/
  while (remaining.length > 0) {
    const match = remaining.match(SENT_RE)
    if (match) {
      sentences.push(match[1])
      remaining = remaining.slice(match[0].length)
    } else {
      sentences.push(remaining)
      break
    }
  }
  return sentences.filter(s => s.trim().length > 0)
}

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
    <div className="space-y-4">
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
        // (1)...(2)... 인라인 번호가 있으면 카드로 분리
        const numbered = splitInlineNumbers(p)
        if (numbered.length > 1) {
          return (
            <div key={i} className="space-y-3">
              {numbered.map((n, j) => (
                <div key={j} className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                  <p className="text-lg leading-[1.9] text-gray-700"><InlineText text={n.trim()} /></p>
                </div>
              ))}
            </div>
          )
        }
        // 문장 단위 분리
        const sentences = splitSentences(p)
        if (sentences.length > 1) {
          return (
            <div key={i} className="space-y-2">
              {sentences.map((s, j) => (
                <p key={j} className="text-lg leading-[1.9] text-gray-600">
                  <InlineText text={s} />
                </p>
              ))}
            </div>
          )
        }
        return <SentenceText key={i} text={p} className="text-lg leading-[1.95] text-gray-600" />
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


function SentenceText({ text, className }: { text: string; className?: string }) {
  const sentences = splitSentences(text)
  if (sentences.length <= 1) {
    return <p className={className}><InlineText text={text} /></p>
  }
  return (
    <div>
      {sentences.map((s, i) => (
        <p key={i} className={className} style={{ marginBottom: "0.4em" }}>
          <InlineText text={s} />
        </p>
      ))}
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
