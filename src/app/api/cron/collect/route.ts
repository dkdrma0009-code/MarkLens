import { NextResponse } from "next/server"
import { sendAdminAlert } from "@/lib/alert"
import { summarizeError } from "@/lib/ai/errors"
import { runOnboardingDrip } from "@/lib/newsletter/onboarding"
import { blockedReason } from "@/lib/release/guard.mjs"

// Vercel Cron이 매일 UTC 00:00에 호출
// CRON_SECRET 환경변수로 인증
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const blocked = blockedReason("cron") // Preview never runs production jobs (collect, publish, mail)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "N8N_WEBHOOK_SECRET not configured" }, { status: 500 })

  // 1) 수집
  const res = await fetch(`${base}/api/webhooks/collect?secret=${secret}`, {
    method: "POST",
  })
  const data = await res.json()

  if (!res.ok) {
    await sendAdminAlert(
      "아티클 수집 cron 실패",
      `오류: ${data.error ?? JSON.stringify(data)}\n시각: ${new Date().toISOString()}`
    )
  }

  // 1.5) 온보딩 드립 — 신규 구독자에게 단계별 활성화 메일 발송 (별도 크론 슬롯 안 늘리려 여기 통합).
  //      빠르고(이메일 몇 통) 중요하므로 긴 분석 루프 앞에서 먼저 실행. 컬럼 없으면 no-op.
  let drip = { sent: 0 }
  try { drip = await runOnboardingDrip() } catch { /* 드립 실패는 수집·분석에 영향 없음 */ }

  // 2) 분석 — 신규 우선(최신) + 백로그 소량(오래된). FIFO 폐기: 그날 수집분이 그날 분석되게 하고,
  //    오래된 백로그도 소량은 계속 소진해 동결을 막는다. article당 2패스(생성+refine)로 무거워
  //    150s 예산 안에서 배치(3건/호출)를 목표치까지 반복 호출한다. (마지막 호출도 300s 내)
  const ANALYZE_BUDGET_MS = 150_000
  const NEW_TARGET = 12       // 최신(그날 수집분) 우선 분석 목표
  const BACKLOG_TARGET = 3    // 남은 pending 소량 소진(원문 7일 이내만 — analyze-pending이 거른다)
  const startedAt = Date.now()
  const budgetLeft = () => Date.now() - startedAt < ANALYZE_BUDGET_MS

  // analyze-pending returns 502 when every attempt failed (an outage), 200 with `failed` > 0 for a partial run, and
  // "No pending articles" when there is nothing to do. Articles tried in this run are excluded from later calls, so
  // one failing batch cannot be retried over and over while the rest of the queue waits.
  const tried = new Set<string>()
  const analysis = { attempted: 0, analyzed: 0, rejected: 0, failed: 0, outage: false, errors: [] as string[] }

  async function analyzeBatch(order: "desc" | "asc") {
    const exclude = tried.size ? `&exclude=${[...tried].join(",")}` : ""
    const ar = await fetch(`${base}/api/webhooks/analyze-pending?secret=${secret}&order=${order}${exclude}`, { method: "POST" })
    const ad = await ar.json().catch(() => ({}))
    for (const id of ad.ids ?? []) tried.add(id)
    analysis.attempted += ad.attempted ?? 0
    analysis.analyzed += ad.analyzed ?? 0
    analysis.rejected += ad.rejected ?? 0
    analysis.failed += ad.failed ?? 0
    for (const e of ad.errors ?? []) if (analysis.errors.length < 6) analysis.errors.push(e)
    if (ar.status === 502) { analysis.outage = true; return { n: 0, stop: true } } // alerted once, after the loops
    if (!ar.ok) {
      await sendAdminAlert(
        "아티클 분석 cron 실패",
        `오류: ${summarizeError(ad.error ?? JSON.stringify(ad))}\n시각: ${new Date().toISOString()}`
      )
      return { n: 0, stop: true }
    }
    return { n: ad.analyzed ?? 0, stop: ad.message === "No pending articles" }
  }

  let analyzedNew = 0
  while (analyzedNew < NEW_TARGET && budgetLeft()) {
    const r = await analyzeBatch("desc")           // 최신 우선
    analyzedNew += r.n
    if (r.stop) break
  }
  let analyzedBacklog = 0
  while (!analysis.outage && analyzedBacklog < BACKLOG_TARGET && budgetLeft()) {
    const r = await analyzeBatch("asc")            // 오래된 백로그 소량
    analyzedBacklog += r.n
    if (r.stop) break
  }
  const analyzed = analyzedNew + analyzedBacklog

  if (analysis.failed > 0 && analysis.analyzed + analysis.rejected === 0) {
    await sendAdminAlert(
      "기사 분석 실패 — 이번 실행 분석 0건",
      `분석을 시도한 ${analysis.attempted}건이 모두 실패했습니다. 자동 공개·SNS 게시 대상이 생기지 않습니다.\n` +
      `오류(요약):\n${analysis.errors.map(e => `- ${e}`).join("\n")}\n시각: ${new Date().toISOString()}`
    )
  } else if (analysis.failed > 0) {
    console.warn("[collect] 기사 분석 일부 실패", JSON.stringify(analysis))
  }

  // 2.5) 사이트 공개 — 방금 분석된 신규 ready 를 그날 published 로 전환(IG 발행과 분리).
  //      · 카드뉴스/ig-daily/큐레이션/릴스는 절대 안 건드림 — 사이트 status 만 바꾼다.
  //      · 대상 = 08:00 SNS 드립과 같은 기준(@/lib/content/auto-publish): 원문 발표일 7일 이내,
  //        필수 분석 정보 있음, 이미 공개된 글·SNS 게시된 글과 중복 아님. 오늘 분석했어도 원문이 오래되면 제외.
  //        통과한 글이 없으면 그날은 공개하지 않는다.
  //      · site_published_at 세팅 → "사이트공개=정상, IG는 선별" 상태 명시(유령 오해 방지).
  //      · 게이트 app_config.site_publish_auto='on' 일 때만(검토 후 수동 on). 미설정=off.
  let sitePublished = 0
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const sb = createAdminClient()
    const { data: gate } = await sb.from("app_config").select("value").eq("key", "site_publish_auto").single()
    if (gate?.value === "on") {
      const { freshReadyCandidates } = await import("@/lib/content/auto-publish")
      const fresh = (await freshReadyCandidates(sb)).eligible // 안전캡 50 — 정상적으론 하루 ~15건
      const ids = fresh.map((f) => f.article_id).filter(Boolean)
      if (ids.length > 0) {
        const now = new Date().toISOString()
        await sb.from("articles").update({ status: "published", site_published_at: now }).in("id", ids)
        try {
          const { revalidatePublicContent } = await import("@/lib/revalidate")
          // 이번 실행에서 공개한 글의 상세만 + 홈·목록 (0건이면 이 블록 자체를 타지 않음)
          revalidatePublicContent({ slugs: fresh.map((f) => f.slug) })
        } catch { /* 무효화 실패는 공개에 영향 없음 */ }
        sitePublished = ids.length
      }
    }
  } catch { /* 사이트 공개 실패는 수집·분석에 영향 없음 */ }

  // 2.6) 폴백 이미지 — 이미지 없거나 차단(musebyclios 등)된 published 아티클에 Unsplash 사진 채움
  //      (그리드 보라 그라디언트 방지). 게이트 무관, best-effort, 배치(Unsplash rate limit).
  let fallbackFilled = 0
  try {
    const { backfillFallbackImages } = await import("@/lib/fallback-image")
    fallbackFilled = (await backfillFallbackImages(10)).filled
  } catch { /* 폴백 실패는 수집·분석에 영향 없음 */ }

  // 3) 파이프라인 적체 감지 — "에러 없이 조용히 멈춤"을 잡는 안전망.
  //    과거 분석 stall(9일)은 에러가 아니라 미실행이라 어떤 알림에도 안 걸렸다.
  //    드레인 후에도 48h 이상 묵은 pending이 많으면 분석이 밀리고 있다는 신호 → 알림.
  let staleBacklog = 0
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const sb = createAdminClient()
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    // Only articles that can still be analysed (source within 7 days); older pending rows are never analysed and
    // would otherwise keep this alert firing every day.
    const { freshSourceFilter } = await import("@/lib/content/auto-publish")
    const { count } = await sb
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .or(freshSourceFilter())
    staleBacklog = count ?? 0
    if (staleBacklog > 20) {
      await sendAdminAlert(
        "분석 파이프라인 적체 경고",
        `48시간 이상 미분석 상태인 pending 아티클이 ${staleBacklog}건입니다.\n분석이 밀리거나 멈췄을 수 있습니다 (이번 실행 분석: ${analyzed}건).\n시각: ${new Date().toISOString()}`
      )
    }
  } catch { /* 헬스체크 실패는 본 작업에 영향 없음 */ }

  return NextResponse.json({ collect: data, analyzed, analyzedNew, analyzedBacklog, analysis, sitePublished, fallbackFilled, staleBacklog, dripSent: drip.sent })
}
