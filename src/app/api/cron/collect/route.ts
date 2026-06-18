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

  return NextResponse.json({ articles: data })
}
