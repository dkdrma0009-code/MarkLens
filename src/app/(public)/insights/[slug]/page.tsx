import { createPublicClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { getCategoryMeta } from "@/lib/category"
import { isHotlinkBlocked } from "@/lib/images"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import ArticleChat from "@/components/ArticleChat"
import ArticleFeedback from "@/components/ArticleFeedback"
import InsightCard from "@/components/InsightCard"
import InsightQuiz from "@/components/InsightQuiz"
import InterviewSoundbites from "@/components/InterviewSoundbites"
import ShareButtons from "@/components/ShareButtons"
import NewsletterInlineCta from "@/components/NewsletterInlineCta"
import ViewCounter from "@/components/ViewCounter"
import ReadingProgress from "@/components/ReadingProgress"
import Image from "next/image"
import type { Metadata } from "next"

// 발행 콘텐츠는 자주 안 바뀌므로 ISR로 캐시(홈·목록과 동일 정책). 공개 데이터만 읽어
// 쿠키를 안 쓰므로(createPublicClient) 실제로 캐시가 적용된다. 가장 많이 공유되는 페이지의 속도↑.
export const revalidate = 3600

// 동적 라우트는 generateStaticParams가 있어야 빌드 시 prerender + ISR 캐시된다.
// 발행된 인사이트 슬러그를 모두 미리 생성. 목록에 없는 신규 슬러그는 dynamicParams 기본값(true)으로
// 첫 요청 시 on-demand 생성 후 캐시된다. (발행 시 revalidatePublicContent로 즉시 갱신)
export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from("insights")
    .select("slug, article:articles!inner(status)")
    .eq("article.status", "published")
  return (data ?? []).map((i) => ({ slug: i.slug as string }))
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()
  const { data: insight } = await supabase
    .from("insights")
    .select("hook, summary, category, article:articles(title, image_url, source_name)")
    .eq("slug", slug)
    .single()

  if (!insight) return {}

  const article = insight.article as { title?: string; image_url?: string } | null
  const title = insight.hook ?? article?.title ?? "MarkLens 인사이트"
  const description = insight.summary ?? "글로벌 마케팅 트렌드에서 선별한 실무 인사이트"
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  // 공유 이미지는 동적 브랜드 OG 카드(hook 텍스트 + 카테고리 컬러)를 사용.
  // 원본 기사 image_url은 핫링크 차단 시 깨지고 브랜드도 없어 공유 전환에 불리하므로 쓰지 않는다.
  const ogImage = `${base}/api/og/${slug}`

  return {
    title: `${title} | MarkLens`,
    description,
    alternates: { canonical: `${base}/insights/${slug}` },
    openGraph: {
      title,
      description,
      url: `${base}/insights/${slug}`,
      siteName: "MarkLens",
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function InsightDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: insight } = await supabase
    .from("insights")
    .select("*, article:articles(*)")
    .eq("slug", slug)
    .single()

  if (!insight) notFound()

  // 관련 인사이트 — 같은 카테고리만 보는 대신 태그·키워드 겹침으로 관련도 랭킹.
  // 후보를 넉넉히 받아 JS에서 점수화(겹침×2 + 같은 카테고리 보너스, 최신순 동점 처리).
  // ISR 캐시라 이 연산은 빌드/재검증 시점에만 돈다.
  const { data: relatedPool } = await supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .neq("id", insight.id)
    .order("created_at", { ascending: false })
    .limit(60)

  const myTags = new Set(
    [...(insight.tags ?? []), ...(insight.keywords ?? [])].map((s: string) => String(s).toLowerCase())
  )
  const related = (relatedPool ?? [])
    .map((c) => {
      const ct = [...((c.tags as string[]) ?? []), ...((c.keywords as string[]) ?? [])].map((s) => String(s).toLowerCase())
      const overlap = ct.filter((t) => myTags.has(t)).length
      return { c, score: overlap * 2 + (c.category === insight.category ? 1 : 0) }
    })
    .sort((a, b) => b.score - a.score) // 동점은 최신순(쿼리 정렬 + 안정 정렬)
    .slice(0, 3)
    .map((s) => s.c)

  const article = insight.article
  const meta = getCategoryMeta(insight.category)

  // 이 글에 등장하는 마케팅 용어 (생성·저장돼 있으나 그동안 화면에 노출 안 됨 → 복원 + 구조화 데이터)
  const terms: { term: string; definition: string }[] = Array.isArray(insight.marketing_terms)
    ? insight.marketing_terms.filter((t: { term?: string; definition?: string }) => t?.term && t?.definition)
    : []

  // 구글 리치 스니펫 + AI 답변엔진(AEO) 인용용 구조화 데이터
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const title = insight.hook ?? article?.title ?? ""
  // FAQ — 본문에 실제로 존재하는 Q&A 구조 (요약·왜 중요·실전 적용)
  const faqs = [
    insight.summary && { q: `${title} — 핵심은 무엇인가?`, a: String(insight.summary) },
    insight.why_it_matters && { q: "마케터에게 왜 중요한가?", a: String(insight.why_it_matters).slice(0, 600) },
    insight.practical_applications && { q: "실무에 어떻게 적용하나?", a: String(insight.practical_applications).slice(0, 600) },
  ].filter(Boolean) as { q: string; a: string }[]

  // 목차 — 이 글에 실제로 렌더되는 섹션만 (섹션 id와 1:1 대응)
  const toc = [
    insight.summary && { id: "summary", label: "핵심 요약" },
    insight.key_takeaways?.length && { id: "takeaways", label: "이것만 기억하세요" },
    insight.why_it_matters && { id: "why", label: "왜 중요한가" },
    insight.practical_applications && { id: "apply", label: "실전 적용법" },
    insight.framework_analysis && { id: "framework", label: "프레임워크 분석" },
    terms.length && { id: "terms", label: "마케팅 용어" },
    insight.interview_points?.length && { id: "interview", label: "면접 한 마디" },
    (insight.quiz?.questions?.length || insight.quiz?.question) && { id: "learn", label: "학습 퀴즈" },
  ].filter(Boolean) as { id: string; label: string }[]

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: title,
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
          { "@type": "ListItem", position: 2, name: title, item: `${base}/insights/${slug}` },
        ],
      },
      // FAQPage — AI 답변엔진이 Q&A를 인용하기 쉽게
      ...(faqs.length ? [{
        "@type": "FAQPage",
        mainEntity: faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }] : []),
      // DefinedTermSet — 마케팅 용어 정의 (AEO에서 정의는 인용 가치 높음)
      ...(terms.length ? [{
        "@type": "DefinedTermSet",
        name: `${title} — 마케팅 용어`,
        hasDefinedTerm: terms.map(t => ({ "@type": "DefinedTerm", name: t.term, description: t.definition })),
      }] : []),
    ],
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ReadingProgress color={meta.color} />

      {/* Back */}
      <Link href="/insights"
        className="inline-flex items-center gap-1.5 text-base text-gray-400 hover:text-gray-900 transition-colors mb-10">
        <ArrowLeft className="w-4 h-4" />
        인사이트 목록
      </Link>

      {/* 썸네일 — 상단에는 이미지만. 핫링크 차단 매체는 깨진 이미지 대신 카테고리 그라데이션 폴백
          (InsightCard 카드와 동일 정책 — 저작권 존중 + 깨짐 방지) */}
      {article?.image_url && (
        <div className="relative rounded-2xl overflow-hidden mb-8 h-72">
          {isHotlinkBlocked(article.image_url) ? (
            <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`} />
          ) : (
            <Image src={article.image_url} alt="" fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 672px" />
          )}
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

      {/* ── 목차 ── (이 글에 있는 섹션만, 3개 이상일 때만 노출) */}
      {toc.length >= 3 && (
        <nav aria-label="목차" className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">목차</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  style={{ textDecorationColor: meta.color }}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── 핵심 요약 ── */}
      {insight.summary && (
        <div id="summary" className="scroll-mt-20 rounded-2xl p-7 mb-14" style={{ backgroundColor: meta.color + "12" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: meta.color }}>핵심 요약</span>
          </div>
          <SentenceText text={insight.summary} className="text-xl font-medium leading-relaxed text-gray-800" />
        </div>
      )}

      {/* ── 이것만 기억하세요 ── */}
      {insight.key_takeaways?.length > 0 && (
        <Section id="takeaways" title="이것만 기억하세요">
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
        <Section id="why" title="왜 중요한가">
          <Prose text={insight.why_it_matters} />
        </Section>
      )}

      {/* ── 실전 적용법 ── */}
      {insight.practical_applications && (
        <Section id="apply" title="실전 적용법">
          <Prose text={insight.practical_applications} />
        </Section>
      )}

      {/* ── 프레임워크 분석 ── */}
      {insight.framework_analysis && (
        <Section id="framework" title="프레임워크 분석">
          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-7">
            <Prose text={insight.framework_analysis} />
          </div>
        </Section>
      )}

      {/* ── 마케팅 용어 풀이 ── (생성된 marketing_terms 데이터 노출 + 구조화) */}
      {terms.length > 0 && (
        <Section id="terms" title="이 글의 마케팅 용어">
          <dl className="space-y-3">
            {terms.map((t, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <dt className="text-base font-bold text-gray-900 mb-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ backgroundColor: meta.color }} />
                  {t.term}
                </dt>
                <dd className="text-base leading-relaxed text-gray-600">{t.definition}</dd>
              </div>
            ))}
          </dl>
          <Link href="/glossary" className="inline-block mt-4 text-sm text-gray-400 hover:text-gray-900 transition-colors">
            → 전체 마케팅 용어 사전 보기
          </Link>
        </Section>
      )}

      {/* ── 면접 한 마디 ── */}
      {insight.interview_points?.length > 0 && (
        <Section id="interview" title="면접에서 이렇게 말해보세요">
          <InterviewSoundbites items={insight.interview_points} color={meta.color} />
        </Section>
      )}

      {/* ── 마케팅 학습하기 ── */}
      {(insight.quiz?.questions?.length > 0 || insight.quiz?.question) && (
        <Section id="learn" title="마케팅 학습하기">
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

      {/* ── 뉴스레터 구독 CTA ── */}
      <div className="mb-14">
        <NewsletterInlineCta location="insight_bottom" />
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

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-14">
      <h2 id={id} className="scroll-mt-20 text-2xl font-bold text-gray-900 mb-6">{title}</h2>
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
