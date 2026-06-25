import { NextResponse } from "next/server"
import { sendAdminAlert } from "@/lib/alert"

export const maxDuration = 300

// 매주: 퀴즈 풀(quiz_questions)을 최신 발행 인사이트 기반으로 재생성.
// learn/seed는 원래 n8n/어드민 트리거였는데, n8n 정지 시 풀이 갱신을 멈춘다(분석 stall과 동일 위험).
// Vercel 크론으로 보강 — cron/collect가 분석을 직접 돌리는 것과 같은 패턴.
// learn/generate에 AI 폴백이 있어 풀이 stale해도 기능은 동작하지만, 풀이 신선하면 응답이 빠르고 비용↓.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "N8N_WEBHOOK_SECRET not configured" }, { status: 500 })

  // replace:true → 새 문제 적재 성공 후 이전 문제 제거 (주간 갱신)
  const res = await fetch(`${base}/api/learn/seed?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ perCombo: 20, replace: true }),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    await sendAdminAlert(
      "퀴즈 풀 시드 cron 실패",
      `오류: ${data.error ?? JSON.stringify(data)}\n시각: ${new Date().toISOString()}`
    )
    return NextResponse.json({ step: "seed", error: data.error ?? "seed failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}
