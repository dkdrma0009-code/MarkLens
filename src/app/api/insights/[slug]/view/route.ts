import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  // 조회수 집계 — 여러 글을 빠르게 넘겨봐도 안 막히도록 느슨하게, IP당 분당 60회
  const limited = checkRateLimit(req, { key: "view", limit: 60, windowMs: 60_000 })
  if (limited) return NextResponse.json({ ok: true }) // 막혀도 429 아닌 200 — 클라이언트 오류 방지
  // admin client: RLS 우회 — anon UPDATE 권한 없이도 view_count 집계 가능
  const supabase = createAdminClient()
  const { data } = await supabase.from("insights").select("id, view_count").eq("slug", decodeURIComponent(slug)).single()
  if (data) {
    await supabase.from("insights").update({ view_count: (data.view_count || 0) + 1 }).eq("id", data.id)
  }
  return NextResponse.json({ ok: true })
}
