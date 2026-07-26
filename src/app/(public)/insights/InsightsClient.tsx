"use client"

import { useState, useTransition, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import InsightCard from "@/components/InsightCard"
import { Search, X } from "lucide-react"
import type { Insight } from "@/types"

const CATEGORIES = [
  { label: "전체", slug: "" },
  { label: "브랜딩", slug: "브랜딩" },
  { label: "퍼포먼스 마케팅", slug: "퍼포먼스 마케팅" },
  { label: "SEO", slug: "SEO" },
  { label: "콘텐츠 마케팅", slug: "콘텐츠 마케팅" },
  { label: "소셜 미디어", slug: "소셜 미디어" },
  { label: "AI 마케팅", slug: "AI 마케팅" },
  { label: "CRM", slug: "CRM" },
  { label: "소비자 심리", slug: "소비자 심리" },
]

const PAGE_SIZE = 12

interface Props {
  allInsights: Insight[]
}

export default function InsightsClient({ allInsights }: Props) {
  // 카테고리는 URL 쿼리에서 읽는다 — 서버가 searchParams를 안 읽어 페이지가 캐시(ISR)되고,
  // 카테고리 전환은 서버 왕복 없이 클라이언트 필터로 즉시 반영된다.
  const searchParams = useSearchParams()
  const category = searchParams.get("category") ?? ""
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()

  // 카테고리 전환 시 "더 보기" 페이지 수를 처음으로 리셋
  useEffect(() => { setPage(1) }, [category])

  const filtered = allInsights.filter(insight => {
    if (category && insight.category !== category) return false
    if (!query) return true
    const q = query.toLowerCase()
    return (
      insight.hook?.toLowerCase().includes(q) ||
      insight.summary?.toLowerCase().includes(q) ||
      insight.article?.title?.toLowerCase().includes(q) ||
      insight.tags?.some((t: string) => t.toLowerCase().includes(q)) ||
      insight.category?.toLowerCase().includes(q)
    )
  })

  const shown = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = shown.length < filtered.length

  const featured = !category && !query ? shown[0] : null
  const rest = !category && !query ? shown.slice(1) : shown

  function handleSearch(val: string) {
    setQuery(val)
    setPage(1)
  }

  return (
    <>
      {/* Search + Category Filter */}
      <div className="mb-10 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="인사이트 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-full bg-background text-foreground focus:outline-none focus:border-ring transition-colors"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category — 모바일: 좌우 스크롤 / 데스크탑: 줄바꿈 */}
        {/* 바깥 div가 스크롤 영역, 안쪽 div가 실제 너비를 max-content로 강제 */}
        <div className="overflow-x-auto scrollbar-hide md:overflow-visible">
          <div className="flex gap-2 pb-0.5 w-max md:w-auto md:flex-wrap">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.slug ? `/insights?category=${cat.slug}` : "/insights"}
                className={`px-4 py-1.5 text-sm rounded-full border font-medium transition-all whitespace-nowrap ${
                  category === cat.slug || (!category && !cat.slug)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-ring hover:text-foreground"
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {query ? `"${query}"에 대한 결과가 없습니다.` : "아직 발행된 인사이트가 없습니다."}
        </div>
      ) : (
        <>
          {featured && (
            <div className="mb-8">
              <InsightCard insight={featured} size="large" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-10 text-center">
              <button
                onClick={() => startTransition(() => setPage(p => p + 1))}
                className="px-8 py-3 text-sm font-semibold border border-border rounded-full text-foreground hover:border-ring hover:bg-accent transition-all"
              >
                더 보기 ({filtered.length - shown.length}개 남음)
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
