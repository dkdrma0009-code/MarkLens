import { createClient } from "@/lib/supabase/server"
import { computePriority, daysUntilDeadline } from "@/lib/competitions/priority"
import { NextResponse } from "next/server"
import type { Competition } from "@/types"

// 공개 GET API (스펙 §6) — published 공모전을 마감 임박순으로. 뉴스레터·외부 위젯 활용.
// RLS(published만 공개)가 적용되는 anon 클라이언트 사용.
// ?limit=20 (기본 50, 최대 100) / ?upcomingOnly=1 (마감 안 지난 것만)
export const revalidate = 1800

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100)
  const upcomingOnly = searchParams.get("upcomingOnly") === "1"

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from("competitions")
    .select("id, title, organizer, source_url, category, deadline, prize, job_fit, difficulty, thumbnail_url")
    .eq("status", "published")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(limit)
  if (upcomingOnly) query = query.or(`deadline.gte.${today},deadline.is.null`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 우선순위·D-day는 동적 계산값을 응답에 포함 (저장 안 하는 정책)
  const items = (data ?? []).map((c) => {
    const comp = c as Competition
    return {
      ...comp,
      priority: computePriority(comp.deadline, comp.difficulty),
      daysLeft: daysUntilDeadline(comp.deadline),
    }
  })

  return NextResponse.json({ count: items.length, competitions: items })
}
