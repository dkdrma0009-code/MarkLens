import { cache } from "react"
import { PUBLIC_INSIGHT_DETAIL_SELECT, publicCard, type PublicInsightDetail } from "@/lib/insights/public-select"
import ArticleStory from "@/components/insights/ArticleStory"
import { createPublicClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import ArticleChat from "@/components/ArticleChat"
import ArticleFeedback from "@/components/ArticleFeedback"
import EditorialInsight from "@/components/insights/EditorialInsight"
import NewsletterInlineCta from "@/components/NewsletterInlineCta"
import { rankRelated } from "@/lib/insights/related"
import { relatedCandidates } from "@/lib/insights/related-pool"
import ViewCounter from "@/components/ViewCounter"
import ReadingProgress from "@/components/ReadingProgress"
import type { Metadata } from "next"

// ISR 복구. 모든 발행 슬러그를 ASCII 로 마이그레이션(Phase 2)해서 x-next-cache-tags 헤더
// (Latin1) 500 위험이 사라졌다. 옛 한글 URL 은 proxy.ts 가 301 로 새 ASCII 로 보낸다.
// 글 변경(발행·편집·삭제·상태 변경·cron 발행)은 revalidatePublicContent({ slugs })가 해당 slug만
// 즉시 무효화한다. 시간 기반 재생성은 그 경로 밖의 변경(관련 글·대체 이미지·퀴즈 등)을 위한
// 하루 1회 fallback 이다. (1시간 주기는 상세 ~1,000개의 재생성 기회를 시간마다 만들어 ISR Writes를 키웠다)
export const revalidate = 86400

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

// slug 또는 legacy_slug(옛 한글 슬러그)로 한 번에 찾는다 — 슬러그 ASCII 마이그레이션 후 옛 URL(검색 인덱싱분)이
// 안 깨지게 하는 폴백. 두 행이 걸리면 slug 일치가 우선이다(기존: slug 조회 → 없을 때만 legacy 조회).
// 받은 행은 slug·legacy_slug 가 실제로 일치하는지 다시 확인한다 — 일치하는 행이 없으면 다른 글이 아니라 404.
// legacy_slug 컬럼이 없는 DB(012 전) 등으로 OR 조회가 실패하면 slug 만으로 다시 찾는다.
// generateMetadata 와 페이지가 같은 렌더에서 함께 부르므로 React cache 로 한 번만 조회한다.
const getInsight = cache(async (slug: string): Promise<PublicInsightDetail | null> => {
  let s = slug
  try { s = decodeURIComponent(slug) } catch { /* 잘못된 % 인코딩: 그대로 찾는다(없으면 404) */ }
  const supabase = createPublicClient()
  const quoted = `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  const { data, error } = await supabase.from("insights").select(`${PUBLIC_INSIGHT_DETAIL_SELECT},legacy_slug`)
    .or(`slug.eq.${quoted},legacy_slug.eq.${quoted}`).limit(2).returns<(PublicInsightDetail & { legacy_slug: string | null })[]>()
  if (!error) {
    const rows = data.map(({ legacy_slug: legacySlug, ...insight }) => ({ legacySlug, insight }))
    return (rows.find((row) => row.insight.slug === s) ?? rows.find((row) => row.legacySlug === s))?.insight ?? null
  }
  const bySlug = await supabase.from("insights").select(PUBLIC_INSIGHT_DETAIL_SELECT).eq("slug", s).maybeSingle<PublicInsightDetail>()
  return bySlug.data ?? null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const insight = await getInsight(slug)

  if (!insight) return {}

  const title = insight.hook ?? insight.article?.title ?? "MarkLens 인사이트"
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

  // slug 또는 legacy_slug(옛 한글 URL 보존). generateMetadata 와 같은 조회를 공유한다.
  const insight = await getInsight(slug)

  if (!insight) notFound()

  // 관련 인사이트 — 최신 발행 60개 후보를 rankRelated 로 점수화(겹침×2 + 같은 카테고리, 점수 0 제외, 최신순 동점).
  // 후보는 모든 상세가 공유하는 캐시(related-pool)에서 온다 — 상세마다 60행을 다시 받지 않는다.
  const related = rankRelated(insight, await relatedCandidates(insight.id)).map(publicCard)

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
        <ArticleStory insight={insight} title={title} terms={terms} color={color}>
          <div className="ml-article-ask ml-article-chat"><p>이 글에서 더 궁금한 점이 있나요?</p><ArticleChat color={color} context={[
            insight.hook && `제목: ${insight.hook}`,
            insight.summary && `핵심 요약: ${insight.summary}`,
            insight.key_takeaways?.length && `핵심 포인트:\n${insight.key_takeaways.join('\n')}`,
            insight.why_it_matters && `왜 중요한가: ${insight.why_it_matters}`,
            insight.practical_applications && `실전 적용법: ${insight.practical_applications}`,
            insight.interview_points?.length && `실생활 적용:\n${insight.interview_points.join('\n')}`,
          ].filter(Boolean).join("\n\n")} /></div>
          <section className="ml-article-utility" aria-label="이 인사이트에 대한 의견"><div className="ml-article-feedback"><ArticleFeedback insightId={insight.id} /></div></section>
        </ArticleStory>
        {related.length
          ? <section className="ml-article-related" aria-labelledby="related-title"><div className="ml-section-heading"><div><h2 id="related-title">함께 읽을 인사이트</h2></div></div>{related.map(r => <EditorialInsight key={r.id} insight={r} />)}</section>
          : <section className="ml-article-next-empty" aria-labelledby="related-title"><h2 id="related-title">다음으로 읽기</h2><p>아직 이 글과 주제가 겹치는 인사이트가 없습니다.</p><Link href="/insights" className="ml-article-back"><ArrowLeft size={16} aria-hidden="true" /> 모든 인사이트 보기</Link></section>}
        <section className="ml-article-newsletter ml-article-newsletter-bottom" aria-labelledby="article-weekly-title"><div><p className="ml-eyebrow">MARKLENS WEEKLY</p><h2 id="article-weekly-title">다음 주의 관점을,<br />이번 주의 인사이트로.</h2><p>매주 월요일 7:30 · 무료 마케팅 브리핑</p></div><NewsletterInlineCta variant="weekly" location="insight_bottom" /></section>
        {related.length ? <Link href="/insights" className="ml-article-back ml-article-end"><ArrowLeft size={16} aria-hidden="true" /> 모든 인사이트 보기</Link> : null}
      </div>
      <ViewCounter slug={insight.slug} />
    </article>
  )
}

/* ─── 공통 컴포넌트 ─── */
