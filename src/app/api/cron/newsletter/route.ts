import { NextResponse } from "next/server"
import { sendAdminAlert } from "@/lib/alert"

export const maxDuration = 300

// 매주 월요일 07:30 KST 뉴스레터 자동 발행 (vercel.json crons)
// 기존 n8n "월요일 7:30" 워크플로를 Vercel 크론으로 이전.
// 흐름: 초안 생성(generate) → 발송(send). 두 단계를 한 요청으로 묶는다.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const secret = process.env.N8N_WEBHOOK_SECRET // generate/send가 받는 웹훅 시크릿 재사용

  // 중복 발송 방지 — Hobby 크론은 정시 보장이 안 돼 윈도우 내 2회 트리거될 수 있음.
  // 최근 20시간 내 이미 발송된 호가 있으면 이번 실행을 건너뛴다.
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const sb = createAdminClient()
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const { data: recentSent } = await sb
    .from("newsletter_issues")
    .select("issue_number, sent_at")
    .eq("status", "sent")
    .gte("sent_at", since)
    .limit(1)
  if (recentSent?.length) {
    return NextResponse.json({ skipped: true, reason: "최근 발송 이력 존재 (중복 방지)", lastSent: recentSent[0] })
  }

  // ① 초안 생성
  const genRes = await fetch(`${base}/api/newsletter/generate?secret=${secret}`, { method: "POST" })
  const gen = await genRes.json().catch(() => ({}))
  if (!genRes.ok || !gen.issue?.id) {
    const err = gen.error ?? "초안 생성 실패"
    await sendAdminAlert("뉴스레터 cron 실패 — 초안 생성", `오류: ${err}\n시각: ${new Date().toISOString()}`)
    return NextResponse.json({ step: "generate", error: err }, { status: 500 })
  }

  // ② 발송
  const sendRes = await fetch(`${base}/api/newsletter/send?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueId: gen.issue.id }),
  })
  const send = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) {
    const err = send.error ?? "발송 실패"
    await sendAdminAlert("뉴스레터 cron 실패 — 발송", `issueId: ${gen.issue.id}\n오류: ${err}\n시각: ${new Date().toISOString()}`)
    return NextResponse.json({ step: "send", issueId: gen.issue.id, error: err }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    issueNumber: gen.issue.issue_number,
    issueId: gen.issue.id,
    sentTo: send.sentTo,
    errors: send.errors,
  })
}
