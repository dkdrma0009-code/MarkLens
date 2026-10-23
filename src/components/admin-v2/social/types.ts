import type { Slide } from "@/lib/cardnews/types"

export interface CardnewsRow extends PublishStateFields {
  articleId: string; hook: string | null; title: string | null; category: string | null; createdAt: string
  cardAt: string | null; postedAt: string | null; reelsPostedAt: string | null; scheduledAt: string | null
  usePhoto: boolean; igPostId?: string | null; igStats?: { likes: number; reach: number; saved: number } | null
  slides?: Slide[] | null; caption?: string | null
}
// Per-channel publish state (migration 023); absent before it is applied.
export interface PublishStateFields {
  igPublishState?: string | null; igPublishClaimedAt?: string | null; igPublishError?: string | null
  threadsPublishState?: string | null; threadsPublishClaimedAt?: string | null; threadsPublishError?: string | null; threadsPostId?: string | null
}
export function publishStateFields(card?: Record<string, unknown> | null): PublishStateFields {
  const text = (key: string) => (typeof card?.[key] === "string" ? card[key] as string : null)
  return { igPublishState: text("ig_publish_state"), igPublishClaimedAt: text("ig_publish_claimed_at"), igPublishError: text("ig_publish_error"),
    threadsPublishState: text("threads_publish_state"), threadsPublishClaimedAt: text("threads_publish_claimed_at"), threadsPublishError: text("threads_publish_error"), threadsPostId: text("threads_post_id") }
}
export interface CurationRow {
  id: string; week_of: string; caption: string | null; posted_at: string | null; ig_post_id: string | null
  slides: { type: string; headline?: string | string[]; title?: string; summary?: string }[]
}
export function socialDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) + " KST" : "기록 없음"
}
export function rowStatus(row: CardnewsRow) {
  return row.postedAt ? "posted" : row.scheduledAt ? "scheduled" : row.cardAt ? "ready" : "todo"
}
