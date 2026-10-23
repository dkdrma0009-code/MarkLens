import { createClient } from "@/lib/supabase/server"
import { publishCardnews, readCardnewsPublishState, retryThreadsPublish } from "@/lib/cardnews/publish"
import { publishStateFields } from "@/components/admin-v2/social/types"
import { NextResponse } from "next/server"

export const maxDuration = 300

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && !!adminEmail && user.email?.trim().toLowerCase() === adminEmail
}

// 카드뉴스를 인스타 캐러셀로 발행 (어드민 버튼). channel: "threads" 는 Threads 실패분 수동 재시도.
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const articleId = body.articleId as string
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  // Both outcomes carry the per-channel state the request left behind (published / failed / needs_review).
  const state = async () => publishStateFields(await readCardnewsPublishState(articleId).catch(() => null))
  try {
    const postId = body.channel === "threads" ? await retryThreadsPublish(articleId) : await publishCardnews(articleId)
    return NextResponse.json({ ok: true, postId, state: await state() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "발행 실패", state: await state() }, { status: 500 })
  }
}
