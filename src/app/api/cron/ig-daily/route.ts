import { createAdminClient } from "@/lib/supabase/admin"
import { refreshIgToken } from "@/lib/instagram"
import { publishCardnews } from "@/lib/cardnews/publish"
import { NextResponse } from "next/server"

export const maxDuration = 300

// 매일: ① IG 토큰 갱신(만료 방지) ② 자동발행 ON이면 미발행 카드뉴스 1건 발행
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result: Record<string, unknown> = {}

  // ① 토큰 갱신 (실패해도 발행은 시도)
  try {
    result.tokenRefreshedDays = await refreshIgToken()
  } catch (e) {
    result.tokenRefreshError = e instanceof Error ? e.message : String(e)
  }

  const supabase = createAdminClient()

  // ② 자동발행 스위치 확인 (app_config.ig_auto_publish === "on")
  const { data: flag } = await supabase.from("app_config").select("value").eq("key", "ig_auto_publish").single()
  if (flag?.value !== "on") {
    return NextResponse.json({ ...result, autoPublish: "off" })
  }

  // 미발행 카드뉴스 중 가장 오래된 1건
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
