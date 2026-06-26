import type { Metadata } from "next"
import Link from "next/link"
import { createPublicClient } from "@/lib/supabase/server"

// 발행 인사이트에 쌓인 marketing_terms를 한 페이지로 집약 — "○○ 뜻" 검색·AI 인용(AEO) 타깃.
export const revalidate = 3600

export const metadata: Metadata = {
  title: "마케팅 용어 사전 — MarkLens",
  description:
    "마케팅 트렌드 분석에서 실제로 등장한 용어·약어를 한곳에. AEO·CRM·퍼포먼스 마케팅 등 실무 용어를 맥락과 함께 풀이합니다.",
  alternates: { canonical: "/glossary" },
  openGraph: { title: "마케팅 용어 사전 — MarkLens", description: "실무에서 쓰는 마케팅 용어를 맥락과 함께 풀이합니다.", url: "/glossary", siteName: "MarkLens", type: "website" },
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
    name: "MarkLens 마케팅 용어 사전",
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
    <div className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-3">마케팅 용어 사전</h1>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          MarkLens 인사이트에서 실제로 등장한 마케팅 용어 {terms.length}개를 맥락과 함께 풀이합니다.
          각 용어는 다룬 인사이트로 이어집니다.
        </p>
      </header>

      {terms.length === 0 ? (
        <p className="text-gray-400">아직 정리된 용어가 없습니다.</p>
      ) : (
        <dl className="space-y-4">
          {terms.map((t) => (
            <div key={t.term} id={anchorId(t.term)} className="scroll-mt-20 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900 p-5">
              <dt className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1.5">{t.term}</dt>
              <dd className="text-base leading-relaxed text-gray-600 dark:text-gray-300">{t.definition}</dd>
              {t.hook && (
                <Link href={`/insights/${t.slug}`} className="inline-block mt-3 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  → 관련 인사이트: {t.hook}
                </Link>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
