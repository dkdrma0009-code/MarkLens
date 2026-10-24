import { createPublicClient } from "@/lib/supabase/server"
import { PUBLIC_INSIGHT_CARD_SELECT, type PublicInsightCard } from "@/lib/insights/public-select"

// 관련 글 후보 풀 — 최신 발행 인사이트 61개(카드 필드). 모든 상세가 같은 후보를 쓰므로 상세를 렌더할 때마다
// 60행을 다시 받지 않고 서버 프로세스 메모리에 잠깐(10분) 둔다. 빌드 때 상세 수백 개, ISR 재생성마다 반복되던
// 조회가 프로세스당 한 번이 된다. 최신 61개에서 자기 자신을 빼고 앞 60개를 쓰면 기존
// `.neq("id", id).limit(60)`과 같은 후보·순서다.
//
// Next 데이터 캐시(unstable_cache)는 쓰지 않는다: 그 revalidate 와 태그가 이 데이터를 쓴 상세 페이지에 옮겨붙어
// 상세 재생성 주기가 짧아지고(24h → 6h), 태그 무효화 한 번에 상세 전체가 만료돼 ISR Writes 가 폭증한다.
// 대가: 발행·삭제가 후보에 반영되기까지 최대 10분. 상세의 관련 글은 원래 그 상세가 재생성될 때(최대 24h)만 바뀐다.
export const RELATED_POOL_SIZE = 60
export const RELATED_POOL_TTL_MS = 10 * 60 * 1000

async function loadPool(): Promise<PublicInsightCard[]> {
  const { data, error } = await createPublicClient()
    .from("insights")
    .select(PUBLIC_INSIGHT_CARD_SELECT)
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(RELATED_POOL_SIZE + 1).returns<PublicInsightCard[]>()
  if (error) throw new Error(`related pool: ${error.message}`)
  return data ?? []
}

// 동시에 렌더되는 상세는 진행 중인 조회 하나를 함께 기다린다. `next build` 동안은 데이터가 바뀌지 않으므로
// 워커 프로세스 안에서 한 번만 읽는다. 실패는 기억하지 않는다(다음 렌더가 다시 읽는다).
// project: Preview(별도 DB)와 Production 후보가 섞이지 않도록 DB 주소가 바뀌면 다시 읽는다.
let memo: { project: string; at: number; pool: Promise<PublicInsightCard[]> } | null = null

function readPool(project: string) {
  const building = process.env.NEXT_PHASE === "phase-production-build"
  if (memo && memo.project === project && (building || Date.now() - memo.at < RELATED_POOL_TTL_MS)) return memo.pool
  const entry = { project, at: Date.now(), pool: loadPool() }
  memo = entry
  entry.pool.catch(() => { if (memo === entry) memo = null })
  return entry.pool
}

export async function relatedCandidates(excludeId: string): Promise<PublicInsightCard[]> {
  try {
    const pool = await readPool(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    return pool.filter((c) => c.id !== excludeId).slice(0, RELATED_POOL_SIZE)
  } catch {
    return [] // 기존과 같다: 조회 실패면 관련 글 없이 렌더(빈 상태 문구)
  }
}
