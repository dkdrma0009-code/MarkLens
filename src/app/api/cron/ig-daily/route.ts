import { createAdminClient } from "@/lib/supabase/admin"
import { refreshIgToken, getMediaInsight } from "@/lib/instagram"
import { refreshThreadsToken } from "@/lib/threads"
import { publishCardnews } from "@/lib/cardnews/publish"
import { revalidatePublicContent } from "@/lib/revalidate"
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

  // ⑤-b 성과 스냅샷 — 최근 14일 발행 게시물 지표를 content_metrics 에 적재(피드백 루프).
  // 위치: 발행 로직(⑤·⑥) 사이가 아니라 ⑥ 자동발행 분기 "앞"에 둔다. ⑥ 은 off/대기없음 시
  //   early return 하므로, 뒤에 두면 그 날들엔 스냅샷이 건너뛰어 "매일 적재"가 깨진다.
  // 안전: 전체를 try/catch 로 감싸고 개별 게시물 실패도 무시 → 스냅샷 실패가 발행에 영향 0.
  // 범위: cardnews·curations·instagram. (릴스는 발행 경로 생기면 추가.)
  // content_id 는 cardnews.article_id (id 컬럼 없음) / curations.id.
  try {
    const since = new Date(Date.now() - 14 * 864e5).toISOString()
    const { data: recent } = await supabase
      .from("cardnews")
      .select("article_id, ig_post_id, posted_at")
      .not("ig_post_id", "is", null)
      .gte("posted_at", since)

    // 현재 팔로워 — ③에서 방금 기록한 값 우선, 없으면 최신 스냅샷에서
    let followers: number | null = typeof result.igFollowers === "number" ? result.igFollowers : null
    if (followers == null) {
      const { data: snap } = await supabase
        .from("follower_snapshots").select("followers").eq("platform", "instagram")
        .order("recorded_at", { ascending: false }).limit(1).maybeSingle()
      followers = snap?.followers ?? null
    }

    // 게시물 1건 upsert (cardnews·curation 공용)
    const upsertMetric = async (contentType: string, contentId: string, igPostId: string, postedAt: string | null): Promise<boolean> => {
      const m = await getMediaInsight(igPostId)
      if (!m) return false // 게시물 삭제/지표 미지원 → 스킵
      const { error } = await supabase.from("content_metrics").upsert({
        content_type: contentType, content_id: contentId, ig_post_id: igPostId, platform: "instagram",
        reach: m.reach, likes: m.likes, saved: m.saved, shares: m.shares, comments: m.comments,
        followers_at_time: followers, posted_at: postedAt, recorded_at: new Date().toISOString(),
      }, { onConflict: "ig_post_id,platform" })
      return !error
    }

    let snapped = 0
    for (const c of recent ?? []) {
      try { if (await upsertMetric("cardnews", c.article_id, c.ig_post_id as string, c.posted_at)) snapped++ }
      catch { /* 개별 게시물 실패는 무시하고 다음으로 */ }
    }
    result.metricsSnapshot = snapped

    // 큐레이션도 동일하게(발행 경로 생김). content_id = curations.id.
    const { data: recentCur } = await supabase
      .from("curations")
      .select("id, ig_post_id, posted_at")
      .not("ig_post_id", "is", null)
      .gte("posted_at", since)
    let snappedCur = 0
    for (const c of recentCur ?? []) {
      try { if (await upsertMetric("curation", c.id, c.ig_post_id as string, c.posted_at)) snappedCur++ }
      catch { /* 개별 실패 무시 */ }
    }
    result.metricsSnapshotCuration = snappedCur
  } catch (e) {
    result.metricsSnapshotError = e instanceof Error ? e.message : String(e)
  }

  // ⑥ 통일 드립 스위치 (app_config.ig_auto_publish === "on")
  const { data: flag } = await supabase.from("app_config").select("value").eq("key", "ig_auto_publish").single()
  if (flag?.value !== "on") {
    return NextResponse.json({ ...result, autoPublish: "off" })
  }

  // 하루 1건 통일 드립: ready 인사이트 1개 → 사이트 공개 + 카드뉴스 생성 + IG/Threads 동시 발행.
  // ready = analyze 완료·검수 대기(사이트 미노출) 상태. 오래된 것부터 릴리스(FIFO — 백로그 소진).
  // ── [진단 로깅] 발행 멈춤 원인 추적용. 발행 로직은 그대로, console.log/타이밍만 추가. ──
  const dripStart = Date.now()
  const { data: readyRows } = await supabase
    .from("insights")
    .select("article_id, hook, summary, created_at, article:articles!inner(status)")
    .eq("article.status", "ready")
    .order("created_at", { ascending: true })
    .limit(5)
  console.log("[drip] readyRows=", readyRows?.length ?? 0,
    (readyRows ?? []).map(r => ({ art: r.article_id?.slice(0, 8), hook: !!r.hook, summary: !!r.summary, created: r.created_at?.slice(0, 10) })))
  const pick = (readyRows ?? []).find(r => r.hook && r.summary)
  if (!pick) {
    console.log("[drip] pick 없음 → '대기 중인 ready 인사이트 없음' 반환")
    return NextResponse.json({ ...result, autoPublish: "on", drip: "대기 중인 ready 인사이트 없음" })
  }
  console.log(`[drip] pick=${pick.article_id?.slice(0, 8)} hook="${(pick.hook ?? "").slice(0, 30)}"`)
  const articleId = pick.article_id
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"

  // 1) 사이트 공개 (ready → published) + ISR 캐시 무효화
  const t1 = Date.now()
  console.log("[drip] step1 시작: article → published")
  await supabase.from("articles").update({ status: "published" }).eq("id", articleId)
  try { revalidatePublicContent() } catch { /* 무효화 실패는 발행에 영향 없음 */ }
  console.log(`[drip] step1 완료 (${Date.now() - t1}ms)`)

  // 2) 카드뉴스 생성 (발행 전 반드시 존재해야 함 — 이미 있으면 재생성/갱신)
  const t2 = Date.now()
  console.log("[drip] step2 시작: cardnews generate 호출")
  try {
    const genRes = await fetch(`${base}/api/admin/cardnews/generate?secret=${process.env.N8N_WEBHOOK_SECRET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }),
    })
    result.cardnewsGenStatus = genRes.status
    console.log(`[drip] step2 응답 status=${genRes.status} ok=${genRes.ok} (${Date.now() - t2}ms)`)
    if (!genRes.ok) {
      const body = (await genRes.text().catch(() => "")).slice(0, 300)
      result.cardnewsGenBody = body
      console.log("[drip] step2 응답 본문(앞300):", body)
    }
  } catch (e) {
    result.cardnewsGenError = e instanceof Error ? e.message : String(e)
    console.log(`[drip] step2 예외 (${Date.now() - t2}ms): ${result.cardnewsGenError}`)
  }

  // 2.5) 가드 — step2 가 실제로 cardnews 를 만들었는지 확인한다. 없으면 발행(step3)을 시도하지
  //      않고 명확히 반환한다. publishCardnews 는 cardnews 가 없으면 "카드뉴스가 없습니다"로
  //      던지는데(로그의 그 에러), 그걸 크래시로 만들지 않고 원인(step2 status)을 응답에 노출한다.
  //      발행 로직(step3)은 그대로 두고, "cardnews 존재"라는 전제만 앞에서 보장한다.
  const { data: cardCheck } = await supabase.from("cardnews").select("slides").eq("article_id", articleId).single()
  if (!cardCheck?.slides) {
    console.log(`[drip] step2 후 cardnews 없음 → 발행 스킵 (step2 status=${result.cardnewsGenStatus ?? "?"})`)
    return NextResponse.json({
      ...result, autoPublish: "on",
      drip: { articleId, sitePublished: true, cardnewsMissing: true, reason: "step2(cardnews 생성)가 실패해 발행 전제(cardnews)가 없습니다" },
    }, { status: 500 })
  }
  console.log(`[drip] cardnews 확인됨 (slides ${cardCheck.slides.length}장) → 발행 진행`)

  // 3) IG + Threads 동시 발행 (publishCardnews가 둘 다 처리)
  const t3 = Date.now()
  console.log("[drip] step3 시작: publishCardnews 호출")
  try {
    const postId = await publishCardnews(articleId)
    console.log(`[drip] step3 성공 postId=${postId} (step3 ${Date.now() - t3}ms · 드립 총 ${Date.now() - dripStart}ms)`)
    return NextResponse.json({ ...result, autoPublish: "on", drip: { articleId, hook: pick.hook, sitePublished: true, postId } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`[drip] step3 실패 (step3 ${Date.now() - t3}ms · 드립 총 ${Date.now() - dripStart}ms): ${msg}`)
    if (e instanceof Error && e.stack) console.log("[drip] step3 스택(앞500):", e.stack.slice(0, 500))
    return NextResponse.json({ ...result, autoPublish: "on", drip: { articleId, sitePublished: true, publishError: msg } }, { status: 500 })
  }
}
