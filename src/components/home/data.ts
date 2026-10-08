import { isHotlinkBlocked } from "@/lib/images"

export interface HomeInsight {
  id: string
  slug: string
  hook?: string | null
  summary?: string | null
  category: string
  is_featured: boolean
  created_at: string
  practical_applications?: string | null
  framework_analysis?: string | null
  portfolio_usage?: string | null
  article?: {
    title: string
    source_name: string
    image_url?: string | null
    fallback_image?: { url?: string } | null
    site_published_at?: string | null
  } | null
}

export function headline(insight: HomeInsight) {
  return insight.hook?.trim() || insight.article?.title?.trim() || ""
}

export function hasImage(insight: HomeInsight) {
  const original = insight.article?.image_url
  const fallback = insight.article?.fallback_image?.url
  return !!((original && !isHotlinkBlocked(original)) || (fallback && !isHotlinkBlocked(fallback)))
}

export function selectMainStory(recent: HomeInsight[], featured: HomeInsight[]) {
  const valid = (i: HomeInsight) => !!(i.slug && headline(i))
  return featured.find(valid) ?? recent.find(i => valid(i) && hasImage(i)) ?? recent.find(valid)
}

export function selectCollections(insights: HomeInsight[]) {
  const categories = [...new Set(insights.filter(i => i.category?.trim()).map(i => i.category))]
  return categories.slice(0, 3).map(category => ({
    category,
    cover: insights.find(i => i.category === category && hasImage(i)) ?? insights.find(i => i.category === category)!,
  }))
}

// 최신순을 유지하되 같은 카테고리의 반복보다 서로 다른 주제를 먼저 소개한다.
export function selectSignals(insights: HomeInsight[], limit = 4) {
  const seen = new Set<string>()
  const distinct = insights.filter(i => {
    if (seen.has(i.category)) return false
    seen.add(i.category)
    return true
  })
  const selected = distinct.slice(0, limit)
  return [...selected, ...insights.filter(i => !selected.some(s => s.id === i.id))].slice(0, limit)
}

// Repeated hooks and source titles belong to one editorial slot, even across records.
export function sameStory(a: HomeInsight, b: HomeInsight) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, "")
  const left = [headline(a), a.article?.title ?? ""].map(normalize).filter(Boolean)
  const right = [headline(b), b.article?.title ?? ""].map(normalize).filter(Boolean)
  return a.id === b.id || a.slug === b.slug || left.some(value => right.includes(value))
}

export function unusedStories(insights: HomeInsight[], used: HomeInsight[]) {
  return insights.filter((item, index) => !used.some(other => sameStory(item, other)) && !insights.slice(0, index).some(other => sameStory(item, other)))
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" })
}

export function dateInfo(insight: HomeInsight) {
  return {
    value: insight.article?.site_published_at || insight.created_at,
    label: insight.article?.site_published_at ? "발행" : "분석",
  }
}
