import { refreshIgToken } from "@/lib/instagram"
import { NextResponse } from "next/server"

// Vercel Cron이 매일 호출 — IG 장수명 토큰을 갱신해 app_config에 저장(만료 방지)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const expiresInDays = await refreshIgToken()
    return NextResponse.json({ ok: true, expiresInDays })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "갱신 실패" }, { status: 500 })
  }
}
