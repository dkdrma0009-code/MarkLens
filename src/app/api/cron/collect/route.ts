import { NextResponse } from "next/server"
import { sendAdminAlert } from "@/lib/alert"

// Vercel Cron이 매일 UTC 00:00에 호출
// CRON_SECRET 환경변수로 인증
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  // 2) 분석 — 과거 n8n 단독 의존으로 분석이 멈췄던 사고 재발 방지.
  //    analyze-pending은 1회 5건 처리하므로, maxDuration 내 시간 예산 안에서 pending 큐가 빌 때까지 반복 호출한다.
  const ANALYZE_BUDGET_MS = 230_000 // 300s 한도 내 여유 확보
  const startedAt = Date.now()
  let analyzed = 0
  while (Date.now() - startedAt < ANALYZE_BUDGET_MS) {
    const ar = await fetch(`${base}/api/webhooks/analyze-pending?secret=${secret}`, { method: "POST" })
    const ad = await ar.json()
    if (!ar.ok) {
      await sendAdminAlert(
        "아티클 분석 cron 실패",
        `오류: ${ad.error ?? JSON.stringify(ad)}\n분석 누적: ${analyzed}건\n시각: ${new Date().toISOString()}`
      )
      break
    }
    analyzed += ad.analyzed ?? 0
    // 큐가 완전히 빌 때만 종료. 배치가 전부 reject(hook 없음)되면 analyzed=0이지만
    // 큐엔 아직 pending이 남아 있으므로, analyzed로 끊지 말고 "No pending" 신호로만 끊는다.
    // (poison 아티클 무한루프는 시간 예산이 차단)
    if (ad.message === "No pending articles") break
  }

  // 3) 파이프라인 적체 감지 — "에러 없이 조용히 멈춤"을 잡는 안전망.
  //    과거 분석 stall(9일)은 에러가 아니라 미실행이라 어떤 알림에도 안 걸렸다.
  //    드레인 후에도 48h 이상 묵은 pending이 많으면 분석이 밀리고 있다는 신호 → 알림.
  let staleBacklog = 0
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const sb = createAdminClient()
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { count } = await sb
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", cutoff)
    staleBacklog = count ?? 0
    if (staleBacklog > 20) {
      await sendAdminAlert(
        "분석 파이프라인 적체 경고",
        `48시간 이상 미분석 상태인 pending 아티클이 ${staleBacklog}건입니다.\n분석이 밀리거나 멈췄을 수 있습니다 (이번 실행 분석: ${analyzed}건).\n시각: ${new Date().toISOString()}`
      )
    }
  } catch { /* 헬스체크 실패는 본 작업에 영향 없음 */ }

  return NextResponse.json({ collect: data, analyzed, staleBacklog })
}
