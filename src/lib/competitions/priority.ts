import type { CompetitionPriority } from "@/types"

// 마감일 + 준비 난이도로 우선순위 동적 계산 (스펙 §4).
// 저장하지 않고 조회 시점에 계산 — 마감일은 매일 가까워지므로 정적 저장 시 부정확.
//
// red(긴급)    : 마감 7일 이내 + 난이도 중/상
// orange(주의) : 마감 14일 이내, 또는 마감 7일 이내 + 난이도 하
// yellow(여유) : 마감 30일 이내 / 마감일 없음·미정
// green(충분)  : 마감 30일 초과
export function computePriority(
  deadline?: string | null,
  difficulty?: string | null
): CompetitionPriority {
  if (!deadline) return "yellow"
  const days = daysUntilDeadline(deadline)
  if (days === null) return "yellow"
  if (days < 0) return "green" // 만료분은 status=expired로 거르므로 여기 도달 시 폴백
  const hard = difficulty === "중" || difficulty === "상"
  if (days <= 7) return hard ? "red" : "orange"
  if (days <= 14) return "orange"
  if (days <= 30) return "yellow"
  return "green"
}

// 마감까지 남은 일수 (자정 기준). 파싱 불가/없음 → null
export function daysUntilDeadline(deadline?: string | null): number | null {
  if (!deadline) return null
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((a - b) / 86_400_000)
}

// D-day 라벨: "D-7" / "D-DAY" / "마감" / "상시"
export function ddayLabel(deadline?: string | null): string {
  const days = daysUntilDeadline(deadline)
  if (days === null) return "상시"
  if (days < 0) return "마감"
  if (days === 0) return "D-DAY"
  return `D-${days}`
}
