import type { Slide } from "@/lib/cardnews/types"

export interface CardnewsRow {
  articleId: string; hook: string | null; title: string | null; category: string | null; createdAt: string
  cardAt: string | null; postedAt: string | null; reelsPostedAt: string | null; scheduledAt: string | null
  usePhoto: boolean; igPostId?: string | null; igStats?: { likes: number; reach: number; saved: number } | null
  slides?: Slide[] | null; caption?: string | null
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
