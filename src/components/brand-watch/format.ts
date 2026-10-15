import type { PublicDate } from "@/lib/brand-watch/public/types"

export const MOVEMENT_TYPE_LABELS: Record<string, string> = { campaign: "캠페인", creator: "크리에이터", partnership: "파트너십", product: "제품", promotion: "프로모션", platform: "플랫폼", brand: "브랜드" }
export const PROVIDER_TYPE_LABELS: Record<string, string> = { official_newsroom: "공식 뉴스룸", official_blog: "공식 블로그", industry_media: "업계 매체", business_media: "경제 매체", official_social: "공식 소셜", other_media: "매체" }

const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
// "2026-10-08" or an ISO timestamp → "2026.10.08" (timestamps in Korea time).
export function formatDay(value: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kst.format(new Date(value))
  return day.replaceAll("-", ".")
}
export function formatPublicDate(date: PublicDate): string {
  const day = formatDay(date.date)
  return date.precision === "year" ? day.slice(0, 4) : date.precision === "month" ? day.slice(0, 7) : day
}
export const DATE_BASIS_LABELS: Record<PublicDate["basis"], string> = { event: "", reported: "보도일", observed: "확인일" }
export const isoDay = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kst.format(new Date(value)))
// Keeps a middle dot glued to its neighbours (U+2060 word joiners) so "장보기·쇼핑" never wraps with "·" opening a
// line. Rendering only: the visible text is unchanged.
export const keepDots = (text: string) => text.replace(/(\S)·(?=\S)/g, "$1\u2060·\u2060")
