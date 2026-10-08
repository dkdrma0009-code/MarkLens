import { createPublicClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import ArticleChat from "@/components/ArticleChat"
import ArticleFeedback from "@/components/ArticleFeedback"
import EditorialInsight from "@/components/insights/EditorialInsight"
import ArticleVisual from "@/components/insights/ArticleVisual"
import InsightQuiz from "@/components/InsightQuiz"
import InterviewSoundbites from "@/components/InterviewSoundbites"
import ShareButtons from "@/components/ShareButtons"
import NewsletterInlineCta from "@/components/NewsletterInlineCta"
import { midCtaAfterSection, countParas, type BodySection } from "@/lib/insights/mid-cta"
import ViewCounter from "@/components/ViewCounter"
import ReadingProgress from "@/components/ReadingProgress"
import type { Metadata } from "next"

// ISR 복구. 모든 발행 슬러그를 ASCII 로 마이그레이션(Phase 2)해서 x-next-cache-tags 헤더
// (Latin1) 500 위험이 사라졌다. 옛 한글 URL 은 proxy.ts 가 301 로 새 ASCII 로 보낸다.
export const revalidate = 3600

// 발행된 인사이트 슬러그를 빌드 시 prerender + ISR 캐시. 목록에 없는 신규 슬러그는
// dynamicParams 기본값(true)으로 첫 요청 시 on-demand 생성 후 캐시된다.
// 비-ASCII 슬러그는 방어적으로 프리렌더에서 제외(마이그레이션 후 전부 ASCII 라 실제 제외 0).
export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from("insights")
    .select("slug, article:articles!inner(status)")
    .eq("article.status", "published")
  return (data ?? [])
    .map((i) => ({ slug: i.slug as string }))
    .filter((p) => [...p.slug].every((c) => c.charCodeAt(0) < 128))
}

interface Props {
  params: Promise<{ slug: string }>
}

// slug 로 못 찾으면 legacy_slug(옛 한글 슬러그)로 재조회한다. 슬러그 ASCII 마이그레이션 후
// 옛 URL(검색 인덱싱분)이 안 깨지게 하는 폴백. legacy_slug 컬럼이 아직 없을 때(마이그레이션 전)도
// try/catch 로 안전하게 slug-only 로 떨어진다.
async function resolveInsight(
  supabase: ReturnType<typeof createPublicClient>,
  slug: string,
  select: string,
) {
  const s = decodeURIComponent(slug)
  const { data } = await supabase.from("insights").select(select).eq("slug", s).maybeSingle()
  if (data) return data
  try {
    const legacy = await supabase.from("insights").select(select).eq("legacy_slug", s).maybeSingle()
    return legacy.data ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()
  const insight = await resolveInsight(
    supabase, slug,
    "hook, summary, category, article:articles(title, image_url, source_name)",
  ) as { hook?: string; summary?: string; category?: string; article?: unknown } | null

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

  // slug → 없으면 legacy_slug 폴백(옛 한글 URL 보존). decodeURIComponent 로 %EB.. 도 매칭.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insight = await resolveInsight(supabase, slug, "*, article:articles(*)") as any

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
  const color = "#164bff"

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

  // Existing anchors remain stable; only sections with stored content are shown.
  const toc = [
    insight.summary && { id: "summary", label: "핵심 요약" },
    insight.key_takeaways?.length && { id: "takeaways", label: "무슨 일이 있었나" },
    insight.why_it_matters && { id: "why", label: "왜 중요한가" },
    insight.framework_analysis && { id: "framework", label: "MarkLens의 해석" },
    insight.practical_applications && { id: "apply", label: "실전 적용법" },
    insight.portfolio_usage && { id: "portfolio", label: "포트폴리오에 활용하기" },
    insight.interview_points?.length && { id: "interview", label: "면접 한 마디" },
    terms.length && { id: "terms", label: "마케팅 용어" },
    (insight.quiz?.questions?.length || insight.quiz?.question) && { id: "learn", label: "학습 퀴즈" },
  ].filter(Boolean) as { id: string; label: string }[]

  const bodySections = [
    insight.summary && { id: "summary", paras: 1 },
    insight.key_takeaways?.length && { id: "takeaways", paras: insight.key_takeaways.length },
    insight.why_it_matters && { id: "why", paras: countParas(insight.why_it_matters) },
    insight.framework_analysis && { id: "framework", paras: countParas(insight.framework_analysis) },
    insight.practical_applications && { id: "apply", paras: countParas(insight.practical_applications) },
    insight.portfolio_usage && { id: "portfolio", paras: countParas(insight.portfolio_usage) },
    insight.interview_points?.length && { id: "interview", paras: insight.interview_points.length },
    terms.length && { id: "terms", paras: terms.length },
    (insight.quiz?.questions?.length || insight.quiz?.question) && { id: "learn", paras: 1 },
  ].filter(Boolean) as BodySection[]
  const midCtaAfter = midCtaAfterSection(bodySections)
  const midCta = (id: string) => midCtaAfter === id ? <div className="ml-article-newsletter ml-article-newsletter-mid"><NewsletterInlineCta variant="inline" location="insight_mid" /></div> : null

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
    <article className="ml-article">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ReadingProgress color={color} />
      <div className="ml-container">
        <header className="ml-article-header">
          <Link href="/insights" className="ml-article-back"><ArrowLeft size={16} aria-hidden="true" /> 인사이트 목록</Link>
          <p className="ml-eyebrow"><Link href={`/insights?category=${encodeURIComponent(insight.category)}`}>{insight.category}</Link><span> / {article?.source_name || "MARKLENS"}</span></p>
          <h1>{title}</h1>
          {article?.title && article.title !== title ? <p className="ml-article-deck">{article.title}</p> : null}
          <div className="ml-article-meta">
            <div><span>{article?.source_name}</span>{article?.author ? <span>{article.author}</span> : null}<span>분석 <time dateTime={insight.created_at}>{new Date(insight.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })}</time></span></div>
            <div className="ml-article-sharing">{article?.url ? <a href={article.url} target="_blank" rel="noopener noreferrer">원문 보기 <ExternalLink size={14} aria-hidden="true" /></a> : null}<ShareButtons slug={insight.slug} title={title} /></div>
          </div>
        </header>
        <ArticleVisual key={insight.id} article={article} />
        <div className="ml-article-reading">
          {toc.length >= 3 ? <nav aria-label="목차" className="ml-article-toc"><details><summary>IN THIS STORY <span>목차</span></summary><ol>{toc.map(t => <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>)}</ol></details></nav> : null}
          <div className="ml-article-body">
            {insight.summary ? <Section id="summary" title="핵심 요약"><SentenceText text={insight.summary} className="ml-article-summary" /></Section> : null}
            {midCta("summary")}
            {insight.key_takeaways?.length ? <Section id="takeaways" title="무슨 일이 있었나"><ol className="ml-article-takeaways">{insight.key_takeaways.map((item: string, i: number) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><SentenceText text={item} /></li>)}</ol></Section> : null}
            {midCta("takeaways")}
            {insight.why_it_matters ? <Section id="why" title="마케터에게 왜 중요한가"><Prose text={insight.why_it_matters} /></Section> : null}
            {midCta("why")}
            {insight.framework_analysis ? <Section id="framework" title="MarkLens의 해석"><Prose text={insight.framework_analysis} /></Section> : null}
            {midCta("framework")}
            {insight.practical_applications ? <Section id="apply" title="실무에 어떻게 적용할까"><Prose text={insight.practical_applications} /></Section> : null}
            {midCta("apply")}
            {insight.portfolio_usage || insight.interview_points?.length ? <div className="ml-article-career"><p className="ml-eyebrow">FROM INSIGHT TO CAREER</p>
              {insight.portfolio_usage ? <Section id="portfolio" title="포트폴리오에 활용하기"><Prose text={insight.portfolio_usage} /><Link href="/insight-lab" className="ml-text-link">Insight Lab에서 관점 정리하기 →</Link></Section> : null}
              {midCta("portfolio")}
              {insight.interview_points?.length ? <Section id="interview" title="면접에서 이렇게 말해보세요"><InterviewSoundbites items={insight.interview_points} color={color} /><Link href="/interview" className="ml-text-link">면접 연습으로 연결하기 →</Link></Section> : null}
              {midCta("interview")}
            </div> : null}
            {terms.length ? <Section id="terms" title="이 글의 마케팅 용어"><dl className="ml-article-terms">{terms.map((t, i) => <div key={i}><dt>{t.term}</dt><dd>{t.definition}</dd></div>)}</dl><Link href="/glossary" className="ml-text-link">전체 마케팅 용어 사전 보기 →</Link></Section> : null}
            {midCta("terms")}
            {(insight.quiz?.questions?.length || insight.quiz?.question) ? <Section id="learn" title="읽은 내용을 내 것으로"><p className="ml-utility-deck">짧은 퀴즈로 핵심 개념을 확인해보세요.</p><div className="ml-article-quiz"><InsightQuiz quiz={insight.quiz} color={color} /></div></Section> : null}
            {insight.video_url ? <Section title="관련 영상"><div className="ml-article-video"><VideoEmbed url={insight.video_url} /></div></Section> : null}
            <section className="ml-article-utility" aria-labelledby="feedback-title"><p className="ml-eyebrow">YOUR PERSPECTIVE</p><h2 id="feedback-title">이 인사이트에 대한 생각을 들려주세요.</h2><div className="ml-article-feedback"><ArticleFeedback insightId={insight.id} color={color} /></div></section>
          </div>
        </div>
        {related.length ? <section className="ml-article-related" aria-labelledby="related-title"><div className="ml-section-heading"><div><p className="ml-eyebrow">KEEP READING</p><h2 id="related-title">함께 읽을 인사이트<span className="ml-blue">.</span></h2></div></div>{related.map(r => <EditorialInsight key={r.id} insight={r} />)}</section> : null}
        <section className="ml-article-newsletter ml-article-newsletter-bottom" aria-labelledby="article-weekly-title"><div><p className="ml-eyebrow">MARKLENS WEEKLY</p><h2 id="article-weekly-title">다음 주의 관점을,<br />이번 주의 인사이트로.</h2><p>매주 월요일 7:30 · 무료 마케팅 브리핑</p></div><NewsletterInlineCta variant="weekly" location="insight_bottom" /></section>
        <Link href="/insights" className="ml-article-back ml-article-end"><ArrowLeft size={16} aria-hidden="true" /> 모든 인사이트 보기</Link>
      </div>
      <ViewCounter slug={insight.slug} />
      <div className="ml-article-chat"><ArticleChat color={color} context={[
        insight.hook && `제목: ${insight.hook}`,
        insight.summary && `핵심 요약: ${insight.summary}`,
        insight.key_takeaways?.length && `핵심 포인트:\n${insight.key_takeaways.join('\n')}`,
        insight.why_it_matters && `왜 중요한가: ${insight.why_it_matters}`,
        insight.practical_applications && `실전 적용법: ${insight.practical_applications}`,
        insight.interview_points?.length && `실생활 적용:\n${insight.interview_points.join('\n')}`,
      ].filter(Boolean).join("\n\n")} /></div>
    </article>
  )
}

/* ─── 공통 컴포넌트 ─── */

const SECTION_LABELS: Record<string, string> = {
  summary: "SUMMARY", takeaways: "WHAT HAPPENED", why: "WHY IT MATTERS",
  framework: "MARKLENS TAKE / FRAMEWORK", apply: "HOW TO USE IT",
  portfolio: "FOR YOUR PORTFOLIO", interview: "FOR YOUR INTERVIEW",
  terms: "TERMS TO KNOW", learn: "READ / THINK / APPLY",
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return <section id={id} className={`ml-article-section${id === "framework" ? " ml-article-take" : ""}`}>
    {id ? <p className="ml-eyebrow">{SECTION_LABELS[id]}</p> : null}
    <h2>{title}</h2>{children}
  </section>
}

function Prose({ text }: { text: string }) {
  return <div className="ml-article-prose">{text.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}><InlineText text={p} /></p>)}</div>
}

function InlineText({ text }: { text: string }) {
  return <>{text.split(/('[^']{1,40}')/g).map((part, i) => part.startsWith("'") && part.endsWith("'") ? <mark key={i} className="ml-article-quote">{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>)}</>
}

function SentenceText({ text, className }: { text: string; className?: string }) {
  return <p className={className}><InlineText text={text} /></p>
}

function VideoEmbed({ url }: { url: string }) {
  const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]
  if (youtubeId) {
    return <iframe src={`https://www.youtube.com/embed/${youtubeId}`}
      title="관련 영상" className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
  if (vimeoId) {
    return <iframe src={`https://player.vimeo.com/video/${vimeoId}`}
      title="관련 영상" className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  return null
}
