// 자동 공개(09:00 사이트, /api/cron/collect)와 자동 게시(08:00 SNS, /api/cron/ig-daily)의 대상 선정 — 2026-10-25 운영자 원칙.
//   · 원문 발표일(articles.published_at, 없으면 수집일 articles.created_at) 기준 최근 7일 이내만. 오늘 분석했다고 최신이 아니다.
//   · 필수 분석 정보(제목 훅·요약·핵심 사실·왜 중요한가·카테고리)가 빠진 글은 내보내지 않는다.
//   · 이미 공개된 글과 같은 제목, 같은 날 후보끼리 같은 제목은 하나만. 카드뉴스가 이미 SNS에 올라간 글도 제외.
//   · 기준을 통과한 글이 없으면 그날은 내보내지 않는다.
// 운영자가 따로 승인해 예약한 카드뉴스(cardnews.scheduled_at)는 이 선정과 별개로 ig-daily ⑤가 게시한다.
export const FRESH_DAYS = 7

export type Candidate = {
  article_id: string; slug: string; hook: string | null; summary: string | null; key_takeaways: string[] | null
  why_it_matters: string | null; category: string | null; created_at: string
  article: { status: string; published_at: string | null; created_at: string | null } | null
}
export type Selection = { eligible: Candidate[]; skipped: { article_id: string; reason: string }[] }

const SELECT = "article_id, slug, hook, summary, key_takeaways, why_it_matters, category, created_at, article:articles!inner(status, published_at, created_at)"
const normalize = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

/** 원문 발표일. 없으면 수집일. */
export const sourceDate = (c: Candidate) => c.article?.published_at ?? c.article?.created_at ?? null

/** The same source-date window as a PostgREST `or` filter on articles, so the paid AI analysis
 *  (/api/webhooks/analyze-pending) skips pending articles that could never be published. */
export function freshSourceFilter(now = new Date()) {
  const cutoff = new Date(now.getTime() - FRESH_DAYS * 86_400_000).toISOString()
  return `published_at.gte."${cutoff}",and(published_at.is.null,created_at.gte."${cutoff}")`
}

export function missingAnalysis(c: Candidate): string[] {
  const missing: string[] = []
  if (!normalize(c.hook)) missing.push("hook")
  if (!normalize(c.summary)) missing.push("summary")
  if (!c.key_takeaways?.some(t => normalize(t))) missing.push("key_takeaways")
  if (!normalize(c.why_it_matters)) missing.push("why_it_matters")
  if (!normalize(c.category)) missing.push("category")
  return missing
}

/** Pure selection over ready rows: fresh, complete, not a repeat of a published or earlier candidate title. Newest source first. */
export function selectFresh(rows: Candidate[], publishedHooks: Set<string>, now = new Date(), postedArticles = new Set<string>()): Selection {
  const cutoff = now.getTime() - FRESH_DAYS * 86_400_000
  const skipped: Selection["skipped"] = []
  const seen = new Set([...publishedHooks].map(normalize))
  const ordered = [...rows].sort((a, b) => (sourceDate(b) ?? "").localeCompare(sourceDate(a) ?? ""))
  const eligible: Candidate[] = []
  for (const c of ordered) {
    const date = sourceDate(c)
    if (c.article?.status !== "ready") { skipped.push({ article_id: c.article_id, reason: `status ${c.article?.status}` }); continue }
    if (!date || Date.parse(date) < cutoff) { skipped.push({ article_id: c.article_id, reason: `source older than ${FRESH_DAYS} days (${date?.slice(0, 10) ?? "no date"})` }); continue }
    const missing = missingAnalysis(c)
    if (missing.length) { skipped.push({ article_id: c.article_id, reason: `missing ${missing.join(", ")}` }); continue }
    const hook = normalize(c.hook)
    if (seen.has(hook)) { skipped.push({ article_id: c.article_id, reason: "duplicate title" }); continue }
    if (postedArticles.has(c.article_id)) { skipped.push({ article_id: c.article_id, reason: "card news already posted" }); continue }
    seen.add(hook)
    eligible.push(c)
  }
  return { eligible, skipped }
}

type Db = { from(table: string): any } // eslint-disable-line @typescript-eslint/no-explicit-any -- supabase-js query builder

/** Ready rows analysed within the window (an article first published in the last 7 days cannot have been analysed
 *  earlier), then the source-date, completeness and duplicate rules. */
export async function freshReadyCandidates(db: Db, now = new Date(), limit = 50): Promise<Selection> {
  const cutoff = new Date(now.getTime() - FRESH_DAYS * 86_400_000).toISOString()
  const { data, error } = await db.from("insights").select(SELECT).eq("article.status", "ready").gte("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(limit)
  if (error) throw new Error(`ready candidates: ${error.message}`)
  const rows = (data ?? []) as Candidate[]
  const hooks = [...new Set(rows.map(r => r.hook).filter((h): h is string => !!h))]
  const published: string[] = []
  for (let i = 0; i < hooks.length; i += 10) { // titles are long Korean text: keep each request URL short
    const res = await db.from("insights").select("hook, article:articles!inner(status)").eq("article.status", "published").in("hook", hooks.slice(i, i + 10))
    if (res.error) throw new Error(`published titles: ${res.error.message}`)
    published.push(...(res.data ?? []).map((r: { hook: string | null }) => r.hook ?? ""))
  }
  const ids = rows.map(r => r.article_id)
  let posted: string[] = []
  if (ids.length) {
    const res = await db.from("cardnews").select("article_id").in("article_id", ids).or("posted_at.not.is.null,threads_posted_at.not.is.null")
    if (res.error) throw new Error(`posted card news: ${res.error.message}`)
    posted = (res.data ?? []).map((r: { article_id: string }) => r.article_id)
  }
  return selectFresh(rows, new Set(published), now, new Set(posted))
}
