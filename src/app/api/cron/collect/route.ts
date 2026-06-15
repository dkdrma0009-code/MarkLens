import { NextResponse } from "next/server"

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

  const res = await fetch(`${base}/api/webhooks/collect?secret=${secret}`, {
    method: "POST",
  })
  const data = await res.json()

  // 공모전 일일 처리(만료 갱신 + RSS 수집)도 같은 크론에서 — 별도 cron 추가 없이
  let competitions: unknown = null
  try {
    const cRes = await fetch(`${base}/api/webhooks/competitions?secret=${secret}`, { method: "POST" })
    competitions = await cRes.json()
  } catch (e) {
    competitions = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({ articles: data, competitions })
}
