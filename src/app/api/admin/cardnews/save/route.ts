import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { validateCardnews } from "@/lib/cardnews/validate"
import { NextResponse } from "next/server"

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 어드민에서 수정한 카피 저장 — 글자수 초과는 warnings로 알려주되 저장은 허용 (수동 수정 자유도)
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId, slides, category, caption } = await req.json().catch(() => ({}))
  if (!articleId || !Array.isArray(slides)) {
    return NextResponse.json({ error: "articleId, slides required" }, { status: 400 })
  }

  const warnings = validateCardnews({ category: category ?? "", slides })

  const supabase = createAdminClient()
  const { error } = await supabase.from("cardnews").upsert({
    article_id: articleId, slides, category: category ?? null, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 캡션 별도 저장 — 컬럼 미생성 시 본체 저장은 유지
  if (typeof caption === "string") {
    const { error: capErr } = await supabase.from("cardnews").update({ caption }).eq("article_id", articleId)
    if (capErr) warnings.push(`캡션 저장 실패 (cardnews.caption 컬럼 확인): ${capErr.message}`)
  }

  return NextResponse.json({ ok: true, warnings })
}
