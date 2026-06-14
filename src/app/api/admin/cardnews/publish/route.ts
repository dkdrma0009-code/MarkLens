import { createClient } from "@/lib/supabase/server"
import { publishCardnews } from "@/lib/cardnews/publish"
import { NextResponse } from "next/server"

export const maxDuration = 300

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 카드뉴스를 인스타 캐러셀로 발행 (어드민 버튼)
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const articleId = body.articleId as string
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  try {
    const postId = await publishCardnews(articleId)
    return NextResponse.json({ ok: true, postId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "발행 실패" }, { status: 500 })
  }
}
