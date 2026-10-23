// 관련 인사이트 랭킹 — 같은 카테고리만 보는 대신 태그·키워드 겹침으로 관련도를 매긴다.
// 점수 = 겹침×2 + 같은 카테고리 보너스 1. 점수 0(아무것도 겹치지 않음)은 관련 글이 아니므로 추천하지 않는다.
// 동점은 후보 순서(쿼리의 최신순)를 그대로 둔다(안정 정렬).
type Tagged = { tags?: unknown; keywords?: unknown; category?: string | null }

const words = (item: Tagged) =>
  [...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.keywords) ? item.keywords : [])].map((s) => String(s).toLowerCase())

export function rankRelated<T extends Tagged>(insight: Tagged, pool: T[], limit = 3): T[] {
  const mine = new Set(words(insight))
  return pool
    .map((c) => ({ c, score: words(c).filter((t) => mine.has(t)).length * 2 + (c.category === insight.category ? 1 : 0) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.c)
}
