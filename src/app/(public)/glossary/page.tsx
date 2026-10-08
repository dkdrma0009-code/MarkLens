import type { Metadata } from "next"
import Link from "next/link"
import { createPublicClient } from "@/lib/supabase/server"

// 발행 인사이트에 쌓인 marketing_terms를 한 페이지로 집약 — "○○ 뜻" 검색·AI 인용(AEO) 타깃.
export const revalidate = 3600

export const metadata: Metadata = {
  title: "MarkLens Dictionary — 마케팅 언어를 정확하게",
  description:
    "마케팅 트렌드 분석에서 실제로 등장한 용어·약어를 한곳에. AEO·CRM·퍼포먼스 마케팅 등 실무 용어를 맥락과 함께 풀이합니다.",
  alternates: { canonical: "/glossary" },
  openGraph: { title: "MarkLens Dictionary — 마케팅 언어를 정확하게", description: "실무에서 쓰는 마케팅 용어를 맥락과 함께 풀이합니다.", url: "/glossary", siteName: "MarkLens", type: "website" },
}

function anchorId(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "term"
}

export default async function GlossaryPage() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from("insights")
    .select("slug, hook, marketing_terms, article:articles!inner(status, title)")
    .eq("article.status", "published")
    .order("created_at", { ascending: false })

  // 용어 집약 — term(소문자 기준) 중복 제거, 첫(=최신) 등장의 정의·출처 링크 유지
  const map = new Map<string, { term: string; definition: string; slug: string; hook: string }>()
  for (const i of (data ?? []) as Array<{ slug: string; hook?: string; marketing_terms?: unknown; article?: { title?: string } }>) {
    const list = Array.isArray(i.marketing_terms) ? (i.marketing_terms as { term?: string; definition?: string }[]) : []
    for (const t of list) {
      if (!t?.term || !t?.definition) continue
      const key = String(t.term).trim().toLowerCase()
      if (key && !map.has(key)) {
        map.set(key, { term: String(t.term).trim(), definition: String(t.definition).trim(), slug: i.slug, hook: i.hook ?? i.article?.title ?? "" })
      }
    }
  }
  const terms = [...map.values()].sort((a, b) => a.term.localeCompare(b.term, "ko"))

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "MarkLens Dictionary",
    url: `${base}/glossary`,
    inLanguage: "ko-KR",
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.definition,
      url: `${base}/glossary#${anchorId(t.term)}`,
    })),
  }

  return (
    <div className="ml-pages">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="ml-page-hero">
        <div className="ml-container">
          <p className="ml-eyebrow">MARKLENS DICTIONARY</p>
          <h1>마케팅 언어를<br />정확하게 이해하세요.</h1>
          <div className="ml-dictionary-intro">
            <p className="ml-page-intro">발행된 Insights에서 실제로 등장한 용어를 맥락과 함께 풀이합니다. 정의를 읽고, 그 언어가 쓰인 사례로 이어가세요.</p>
            <span className="ml-dictionary-count">{terms.length} TERMS / 0–9 · 가나다 · A–Z</span>
          </div>
        </div>
      </header>

      {terms.length === 0 ? (
        <p className="ml-empty ml-container">아직 정리된 용어가 없습니다.</p>
      ) : (
        <dl className="ml-dictionary-list ml-container">
          {terms.map((t) => (
            <div key={t.term} id={anchorId(t.term)} className="ml-term">
              <dt><span className="ml-term-letter" aria-hidden="true">{t.term[0].toLocaleUpperCase()}</span><span className="ml-term-name">{t.term}</span></dt>
              <dd>{t.definition}
                {t.hook && <Link href={`/insights/${t.slug}`}>관련 Insight → {t.hook}</Link>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
