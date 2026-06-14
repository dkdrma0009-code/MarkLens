import { NextResponse } from "next/server"

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

  // ① 초안 생성
  const genRes = await fetch(`${base}/api/newsletter/generate?secret=${secret}`, { method: "POST" })
  const gen = await genRes.json().catch(() => ({}))
  if (!genRes.ok || !gen.issue?.id) {
    return NextResponse.json({ step: "generate", error: gen.error ?? "초안 생성 실패" }, { status: 500 })
  }

  // ② 발송
  const sendRes = await fetch(`${base}/api/newsletter/send?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueId: gen.issue.id }),
  })
  const send = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) {
    return NextResponse.json({ step: "send", issueId: gen.issue.id, error: send.error ?? "발송 실패" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    issueNumber: gen.issue.issue_number,
    issueId: gen.issue.id,
    sentTo: send.sentTo,
    errors: send.errors,
  })
}
