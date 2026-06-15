import { createAdminClient } from "@/lib/supabase/admin"
import type { Competition } from "@/types"

// 뉴스레터·카드뉴스 연계용 데이터 제공 함수 (스펙 §9 — 로직 삽입은 2차, 데이터만).
// "이번 주 마감 임박 공모전 N선" 섹션을 뉴스레터 generate나 카드뉴스 훅에서 호출해 쓸 수 있다.
//
// 사용 예 (2차):
//   const picks = await getUpcomingCompetitions(3)
//   → 뉴스레터 섹션 "마감 임박 공모전 3선" 또는 카드뉴스 "마감 임박" 소재로 전달
export async function getUpcomingCompetitions(limit = 3): Promise<Competition[]> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // 게시됨 + 마감 안 지남(상시 제외 — '임박'이 핵심) + 임박순
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .eq("status", "published")
    .gte("deadline", today)
    .order("deadline", { ascending: true })
    .limit(limit)

  return (data ?? []) as Competition[]
}

// 뉴스레터 본문에 끼울 한 줄 요약 텍스트 (선택 — 텍스트 섹션용)
export function formatCompetitionDigest(items: Competition[]): string {
  if (!items.length) return ""
  return items
    .map(c => {
      const d = c.deadline ? `~${c.deadline.slice(5).replace("-", "/")}` : "상시"
      return `· ${c.title} (${c.organizer ?? "주최 미상"}, 마감 ${d})`
    })
    .join("\n")
}
