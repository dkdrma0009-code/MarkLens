// 개인정보 보관 기준(2026-10-25 운영자 확정)과 그 기준을 지키는 자동 정리. 기간은 이 한 곳에만 둔다 — 처리방침 문구
// (src/lib/legal/privacy.ts), 매일 도는 정리(/api/cron/privacy-purge), 운영자 SQL(scripts/release/privacy-deletion.sql)이
// 모두 이 값과 같아야 한다(tests/privacy-retention.test.mjs).
//   구독 해지        → 해지하는 순간 구독 정보와 발송 기록 삭제(/api/unsubscribe)
//   이메일 확인 미완료 → 7일
//   뉴스레터 발송·열람·클릭 기록 → 90일(구독자가 아닌 주소의 기록은 바로)
//   AI 사용량 기록   → 90일
//   의견(피드백)     → 접수 후 6개월(183일). 의견은 접수 즉시 운영자에게 메일로 전달돼 처리되므로 접수 시점을 기준으로 삼는다.
//   Insight Lab 회원 → 탈퇴(계정 삭제) 시 기록이 함께 삭제(ON DELETE CASCADE) — 기간 정리 대상 아님
export const RETENTION_DAYS = { unconfirmedSubscriber: 7, newsletterEvents: 90, aiUsage: 90, feedback: 183 } as const

type Result = { error: { message?: string; code?: string } | null; count?: number | null }
type Query = PromiseLike<Result> & {
  eq(c: string, v: unknown): Query; is(c: string, v: null): Query; lt(c: string, v: string): Query; in(c: string, v: string[]): Query
}
export type PurgeDb = { from(table: string): { delete(o: { count: "exact" }): Query; select(c: string): PromiseLike<{ data: Record<string, string | null>[] | null; error: Result["error"] }> } }

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
// ai_usage exists only from migration 024 on; until then there is nothing to purge there.
const missingTable = (e: Result["error"]) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message ?? ""))

/** Deletes every record past its retention period. Returns deleted counts per rule; throws on any other error. */
export async function purgeExpiredPersonalData(db: PurgeDb, now = new Date()): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  const run = async (name: string, q: Query, optional = false) => {
    const { error, count } = await q
    if (error && !(optional && missingTable(error))) throw new Error(`${name}: ${error.message ?? error.code}`)
    counts[name] = count ?? 0
  }
  // Legacy rows: before immediate deletion on unsubscribe, an unsubscribe only changed the status.
  await run("unsubscribed subscribers", db.from("subscribers").delete({ count: "exact" }).eq("status", "unsubscribed"))
  await run("unconfirmed subscribers", db.from("subscribers").delete({ count: "exact" }).eq("status", "pending").is("confirmed_at", null)
    .lt("subscribed_at", daysAgo(now, RETENTION_DAYS.unconfirmedSubscriber)))
  await run("old newsletter events", db.from("newsletter_events").delete({ count: "exact" }).lt("created_at", daysAgo(now, RETENTION_DAYS.newsletterEvents)))
  // Events of addresses that are no longer subscribers (a late open/click webhook after an unsubscribe).
  const subs = await db.from("subscribers").select("email"), events = await db.from("newsletter_events").select("email")
  if (subs.error || events.error) throw new Error(`newsletter events of non-subscribers: ${(subs.error ?? events.error)?.message}`)
  const subscribed = new Set((subs.data ?? []).map(r => (r.email ?? "").toLowerCase()))
  const orphans = [...new Set((events.data ?? []).map(r => r.email ?? "").filter(e => e && !subscribed.has(e.toLowerCase())))]
  counts["newsletter events of non-subscribers"] = 0
  for (let i = 0; i < orphans.length; i += 100) {
    const { error, count } = await db.from("newsletter_events").delete({ count: "exact" }).in("email", orphans.slice(i, i + 100))
    if (error) throw new Error(`newsletter events of non-subscribers: ${error.message}`)
    counts["newsletter events of non-subscribers"] += count ?? 0
  }
  await run("old AI usage", db.from("ai_usage").delete({ count: "exact" }).lt("window_start", daysAgo(now, RETENTION_DAYS.aiUsage)), true)
  await run("old feedback", db.from("feedback").delete({ count: "exact" }).lt("created_at", daysAgo(now, RETENTION_DAYS.feedback)))
  return counts
}
