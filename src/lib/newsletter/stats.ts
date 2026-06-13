import { createAdminClient } from "@/lib/supabase/admin"

export interface IssueStat {
  id: string
  issueNumber: number
  title: string
  sentAt: string | null
  delivered: number
  opens: number
  clicks: number
  openRate: number
  clickRate: number
}

// 최근 발송 이슈의 오픈율/클릭율 (newsletter_events 기반, 고유 이메일 단위)
// 반환: 통계 배열 / [] (발송 이슈 없음) / null (events 테이블 미생성 등 — 설정 안내용)
export async function getNewsletterStats(): Promise<IssueStat[] | null> {
  const sb = createAdminClient()
  const { data: issues } = await sb
    .from("newsletter_issues")
    .select("id, issue_number, title, sent_at")
    .eq("status", "sent")
    .order("issue_number", { ascending: false })
    .limit(8)
  if (!issues?.length) return []

  const ids = issues.map(i => i.id)
  const { data: events, error } = await sb
    .from("newsletter_events")
    .select("issue_id, email, event")
    .in("issue_id", ids)
  if (error) return null // 테이블 미생성

  const agg = new Map<string, { delivered: Set<string>; opens: Set<string>; clicks: Set<string> }>()
  for (const id of ids) agg.set(id, { delivered: new Set(), opens: new Set(), clicks: new Set() })
  for (const e of events ?? []) {
    const m = agg.get(e.issue_id as string)
    if (!m) continue
    const ev = String(e.event)
    const mail = String(e.email)
    if (ev === "delivered") m.delivered.add(mail)
    else if (ev === "opened" || ev === "unique_opened") m.opens.add(mail)
    else if (ev === "click" || ev === "clicks") m.clicks.add(mail)
  }

  return issues.map(i => {
    const m = agg.get(i.id)!
    const denom = m.delivered.size || m.opens.size // delivered 없으면 오픈 기준 폴백
    return {
      id: i.id,
      issueNumber: i.issue_number,
      title: i.title,
      sentAt: i.sent_at,
      delivered: m.delivered.size,
      opens: m.opens.size,
      clicks: m.clicks.size,
      openRate: denom ? Math.round((m.opens.size / denom) * 100) : 0,
      clickRate: denom ? Math.round((m.clicks.size / denom) * 100) : 0,
    }
  })
}
