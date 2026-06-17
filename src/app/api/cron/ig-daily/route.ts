import { createAdminClient } from "@/lib/supabase/admin"
import { refreshIgToken } from "@/lib/instagram"
import { refreshThreadsToken } from "@/lib/threads"
import { publishCardnews } from "@/lib/cardnews/publish"
import { sendAdminAlert } from "@/lib/alert"
import { NextResponse } from "next/server"

export const maxDuration = 300

// 매일: ① IG/Threads 토큰 갱신(만료 방지) ② 자동발행 ON이면 미발행 카드뉴스 1건 발행
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result: Record<string, unknown> = {}

  // ① IG 토큰 갱신 (실패해도 진행)
  try {
    result.igTokenDays = await refreshIgToken()
  } catch (e) {
    result.igTokenError = e instanceof Error ? e.message : String(e)
  }

  // ② Threads 토큰 갱신 (실패해도 진행)
  try {
    result.threadsTokenDays = await refreshThreadsToken()
  } catch (e) {
    result.threadsTokenError = e instanceof Error ? e.message : String(e)
  }

  // 두 토큰 모두 실패하면 알림 (둘 중 하나 실패는 일시적 오류로 허용)
  if (result.igTokenError && result.threadsTokenError) {
    await sendAdminAlert(
      "IG/Threads 토큰 갱신 전체 실패",
      `IG 오류: ${result.igTokenError}\nThreads 오류: ${result.threadsTokenError}\n시각: ${new Date().toISOString()}`
    )
  }

  const supabase = createAdminClient()

  // ③ 팔로워 수 스냅샷 기록 (실패해도 진행)
  try {
    const igToken = process.env.IG_ACCESS_TOKEN
    const igUserId = process.env.IG_USER_ID
    if (igToken && igUserId) {
      const igRes = await fetch(`https://graph.instagram.com/v21.0/${igUserId}?fields=followers_count&access_token=${igToken}`)
      const igData = await igRes.json() as { followers_count?: number }
      if (igData.followers_count !== undefined) {
        await supabase.from("follower_snapshots").insert({ platform: "instagram", followers: igData.followers_count })
        result.igFollowers = igData.followers_count
      }
    }
  } catch { /* 실패 무시 */ }

  try {
    const thToken = process.env.THREADS_ACCESS_TOKEN
    const thUserId = process.env.THREADS_USER_ID
    if (thToken && thUserId) {
      const thRes = await fetch(`https://graph.threads.net/v1.0/${thUserId}/threads_insights?metric=followers_count&access_token=${thToken}`)
      const thData = await thRes.json() as { data?: { total_value?: { value?: number } }[] }
      const followers = thData.data?.[0]?.total_value?.value
      if (followers !== undefined) {
        await supabase.from("follower_snapshots").insert({ platform: "threads", followers })
        result.threadsFollowers = followers
      }
    }
  } catch { /* 실패 무시 */ }

  // ⑤ 예약 발행 — scheduled_at <= now AND posted_at IS NULL 인 카드뉴스 발행
  const { data: scheduled } = await supabase
    .from("cardnews")
    .select("article_id")
    .lte("scheduled_at", new Date().toISOString())
    .is("posted_at", null)
  for (const item of scheduled ?? []) {
    try {
      await publishCardnews(item.article_id)
      result.scheduledPublished = (result.scheduledPublished as number ?? 0) + 1
    } catch (e) {
      result.scheduledError = e instanceof Error ? e.message : String(e)
    }
  }

  // ⑥ 자동 파이프라인 스위치 확인 (app_config.ig_auto_publish === "on")
  const { data: flag } = await supabase.from("app_config").select("value").eq("key", "ig_auto_publish").single()
  if (flag?.value !== "on") {
    return NextResponse.json({ ...result, autoPublish: "off" })
  }

  // ③ 자동 생성: 발행 인사이트 중 카드뉴스 없는 것 최대 3건 생성 (큐 채우기)
  const { data: pubIns } = await supabase
    .from("insights")
    .select("article_id, created_at, article:articles!inner(status)")
    .eq("article.status", "published")
    .order("created_at", { ascending: false })
    .limit(100)
  const { data: existing } = await supabase.from("cardnews").select("article_id")
  const have = new Set((existing ?? []).map(c => c.article_id))
  const toGen = (pubIns ?? []).filter(i => !have.has(i.article_id)).slice(0, 3)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  let generated = 0
  for (const ins of toGen) {
    try {
      const r = await fetch(`${base}/api/admin/cardnews/generate?secret=${process.env.N8N_WEBHOOK_SECRET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: ins.article_id }),
      })
      if (r.ok) generated++
    } catch { /* 개별 실패 무시 */ }
  }
  result.generated = generated

  // ④ 미발행 카드뉴스 중 가장 오래된 1건 발행
  const { data: next } = await supabase
    .from("cardnews")
    .select("article_id")
    .is("posted_at", null)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!next) return NextResponse.json({ ...result, autoPublish: "on", published: "없음(모두 발행됨)" })

  try {
    const postId = await publishCardnews(next.article_id)
    return NextResponse.json({ ...result, autoPublish: "on", publishedArticleId: next.article_id, postId })
  } catch (e) {
    return NextResponse.json({ ...result, autoPublish: "on", publishError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
