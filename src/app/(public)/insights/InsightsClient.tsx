"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X, ArrowDown } from "lucide-react"
import EditorialInsight from "@/components/insights/EditorialInsight"
import type { Insight } from "@/types"

const CATEGORIES = ["브랜딩", "퍼포먼스 마케팅", "SEO", "콘텐츠 마케팅", "소셜 미디어", "AI 마케팅", "CRM", "소비자 심리"]
const PAGE_SIZE = 12

export default function InsightsClient({ allInsights }: { allInsights: Insight[] }) {
  const searchParams = useSearchParams()
  const category = searchParams.get("category") ?? ""
  const [query, setQuery] = useState("")
  const categories = [...new Set([...CATEGORIES, ...allInsights.map(i => i.category).filter(Boolean)])]
  const filtered = allInsights.filter(insight => {
    if (category && insight.category !== category) return false
    if (!query) return true
    const q = query.toLowerCase()
    return insight.hook?.toLowerCase().includes(q) || insight.summary?.toLowerCase().includes(q) || insight.article?.title?.toLowerCase().includes(q) || insight.tags?.some(t => t.toLowerCase().includes(q)) || insight.category?.toLowerCase().includes(q)
  })

  return <>
    <div className="ml-feed-controls">
      <div className="ml-feed-search">
        <Search size={18} aria-hidden="true" />
        <input type="search" aria-label="인사이트 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="키워드로 인사이트 찾기" />
        {query ? <button onClick={() => setQuery("")} aria-label="검색어 지우기"><X size={18} /></button> : null}
      </div>
      <nav aria-label="인사이트 카테고리" className="ml-feed-categories">
        {["", ...categories].map(cat => <Link key={cat} href={cat ? `/insights?category=${encodeURIComponent(cat)}` : "/insights"} aria-current={category === cat ? "page" : undefined}>{cat || "전체"}</Link>)}
      </nav>
    </div>
    <InsightResults key={`${category}\u0000${query}`} insights={filtered} query={query} />
  </>
}

// Filter changes remount only pagination; search remains in the parent.
function InsightResults({ insights, query }: { insights: Insight[]; query: string }) {
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()
  const shown = insights.slice(0, page * PAGE_SIZE)
  const [featured, ...rest] = shown
  return <div className="ml-feed-results">
    <p className="ml-feed-count" role="status">{insights.length}개의 인사이트{query ? ` · “${query}”` : ""}</p>
    {featured ? <>
      <div className="ml-feed-featured"><p className="ml-eyebrow">IN FOCUS</p><EditorialInsight insight={featured} variant="featured" /></div>
      {rest.length ? <section className="ml-feed-list" aria-label="인사이트 목록">{rest.map(i => <EditorialInsight key={i.id} insight={i} />)}</section> : null}
      {shown.length < insights.length ? <div className="ml-feed-more"><button className="ml-button" disabled={pending} onClick={() => startTransition(() => setPage(p => p + 1))}>더 보기 ({insights.length - shown.length}개 남음)<ArrowDown size={16} aria-hidden="true" /></button></div> : null}
    </> : <p className="ml-feed-empty">{query ? `“${query}”에 대한 결과가 없습니다. 다른 검색어를 입력해보세요.` : "이 카테고리에 발행된 인사이트가 아직 없습니다."}</p>}
  </div>
}
