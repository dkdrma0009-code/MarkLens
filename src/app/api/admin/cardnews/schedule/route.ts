import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

// POST { articleId, scheduledAt: "YYYY-MM-DD" | null } — 예약 설정/해제
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId, scheduledAt } = await req.json().catch(() => ({}))
  if (!articleId) return NextResponse.json({ error: "articleId 필요" }, { status: 400 })

  // scheduledAt이 날짜 문자열이면 당일 KST 08:00 (UTC 23:00 전날) 기준으로 설정
  const value = scheduledAt ? new Date(`${scheduledAt}T23:00:00.000Z`).toISOString() : null

  const sb = createAdminClient()
  const { error } = await sb.from("cardnews").update({ scheduled_at: value }).eq("article_id", articleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, scheduledAt: value })
}
