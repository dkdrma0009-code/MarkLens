"use client"

import { useState, useTransition } from "react"
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
  category?: string
  allInsights: Insight[]
}

export default function InsightsClient({ category, allInsights }: Props) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()

  const filtered = allInsights.filter(insight => {
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="인사이트 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug ? `/insights?category=${cat.slug}` : "/insights"}
              className={`px-4 py-1.5 text-sm rounded-full border font-medium transition-all whitespace-nowrap ${
                category === cat.slug || (!category && !cat.slug)
                  ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
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
                className="px-8 py-3 text-sm font-semibold border border-gray-200 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
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
