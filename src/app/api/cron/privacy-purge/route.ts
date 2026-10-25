import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { purgeExpiredPersonalData, type PurgeDb } from "@/lib/privacy/retention"
import { sendAdminAlert } from "@/lib/alert"
import { blockedReason } from "@/lib/release/guard.mjs"

// 매일: 보관 기간이 지난 개인정보 삭제(src/lib/privacy/retention.ts). 운영자는 매월 1회 이 결과를 확인한다
// (docs/release/privacy-operations.md). 실패하면 운영자에게 알린다 — 삭제가 멈춘 채 지나가지 않게.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const blocked = blockedReason("cron") // Preview never runs production jobs (collect, publish, mail)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 })

  try {
    const deleted = await purgeExpiredPersonalData(createAdminClient() as unknown as PurgeDb)
    console.log("[privacy-purge]", JSON.stringify(deleted))
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[privacy-purge] failed:", message)
    await sendAdminAlert("개인정보 자동 정리 실패", `보관 기간이 지난 기록을 지우지 못했습니다.\n${message}\n시각: ${new Date().toISOString()}`).catch(() => {})
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
