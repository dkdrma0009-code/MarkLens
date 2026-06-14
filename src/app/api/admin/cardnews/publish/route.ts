import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { renderCardnewsBuffers } from "@/lib/cardnews/render-buffers"
import { publishCarousel } from "@/lib/instagram"
import { NextResponse } from "next/server"

export const maxDuration = 300

const BUCKET = "cardnews-ig"

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 카드뉴스를 인스타 캐러셀로 자동 발행
// body: { articleId }
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const articleId = body.articleId as string
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const rendered = await renderCardnewsBuffers(articleId)
  if (!rendered) return NextResponse.json({ error: "카드뉴스가 없습니다. 먼저 생성하세요." }, { status: 404 })

  const supabase = createAdminClient()

  // 공개 버킷에 6장 업로드 → 공개 URL 확보 (인스타가 가져갈 수 있게)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})
  const ts = Date.now()
  const imageUrls: string[] = []
  for (let i = 0; i < rendered.buffers.length; i++) {
    const path = `${articleId}/${ts}-${String(i + 1).padStart(2, "0")}.png`
    const { error } = await supabase.storage.from(BUCKET).upload(path, rendered.buffers[i], { contentType: "image/png", upsert: true })
    if (error) return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 })
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    // 인스타 발행은 JPEG만 받으므로 weserv로 jpg 변환한 공개 URL 사용
    imageUrls.push(`https://images.weserv.nl/?url=${encodeURIComponent(publicUrl)}&output=jpg`)
  }

  try {
    const postId = await publishCarousel(imageUrls, rendered.caption ?? "")
    // 발행 완료 기록 (posted_at 컬럼 없으면 에러는 무시)
    await supabase.from("cardnews").update({ posted_at: new Date().toISOString() }).eq("article_id", articleId)
    return NextResponse.json({ ok: true, postId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "발행 실패" }, { status: 500 })
  }
}
