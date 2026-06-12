import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 인스타 업로드 완료 표시 토글 — posted=true면 지금 시각, false면 해제
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId, posted } = await req.json().catch(() => ({}))
  if (!articleId || typeof posted !== "boolean") {
    return NextResponse.json({ error: "articleId, posted required" }, { status: 400 })
  }

  const postedAt = posted ? new Date().toISOString() : null
  const supabase = createAdminClient()
  const { error } = await supabase.from("cardnews").update({ posted_at: postedAt }).eq("article_id", articleId)

  if (error) {
    const hint = error.message.includes("posted_at")
      ? "Supabase SQL Editor에서 실행 필요: alter table cardnews add column if not exists posted_at timestamptz;"
      : error.message
    return NextResponse.json({ error: hint }, { status: 500 })
  }

  return NextResponse.json({ ok: true, postedAt })
}
