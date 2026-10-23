import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && !!adminEmail && user.email?.trim().toLowerCase() === adminEmail
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
  // The manual mark keeps the Instagram publish state in step (migration 023): marked → published, unmarked → not
  // published (publishable again). Never while a publish is in flight or awaiting review.
  const { data, error } = await supabase.from("cardnews")
    .update({ posted_at: postedAt, ig_publish_state: posted ? "published" : null, ig_publish_claimed_at: null, ig_publish_error: null })
    .eq("article_id", articleId)
    .or("ig_publish_state.is.null,ig_publish_state.eq.published,ig_publish_state.eq.failed")
    .select("article_id")

  if (error) {
    const hint = error.message.includes("posted_at")
      ? "Supabase SQL Editor에서 실행 필요: alter table cardnews add column if not exists posted_at timestamptz;"
      : error.message
    return NextResponse.json({ error: hint }, { status: 500 })
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Instagram 발행이 진행 중이거나 확인 필요 상태라 표시를 바꿀 수 없습니다. 먼저 확인 필요 상태를 처리하세요." }, { status: 409 })
  }

  return NextResponse.json({ ok: true, postedAt })
}
