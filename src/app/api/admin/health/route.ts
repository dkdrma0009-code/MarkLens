import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkInstagram } from "@/lib/instagram"
import { checkThreads } from "@/lib/threads"
import { checkGa4 } from "@/lib/ga4"
import { NextResponse } from "next/server"

export const maxDuration = 60

// 외부 연동 헬스체크 — 각 모듈이 실제 발행/조회에 쓰는 토큰 경로·엔드포인트를 그대로 호출한다.
// 별도 검증 코드를 짜지 않는 것이 핵심: 검증이 프로덕션 코드 경로를 100% 따라가야 오진이 없다.
async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

type Check = { ok: boolean; detail: string }

async function checkBrevo(): Promise<Check> {
  if (!process.env.BREVO_API_KEY) return { ok: false, detail: "미설정 (BREVO_API_KEY)" }
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": process.env.BREVO_API_KEY },
    })
    const j = (await res.json()) as { email?: string; message?: string }
    if (!res.ok) return { ok: false, detail: j.message ?? "응답 오류" }
    return { ok: true, detail: j.email ?? "OK" }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

async function checkSupabase(): Promise<Check> {
  try {
    const sb = createAdminClient()
    const { count, error } = await sb
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
    if (error) return { ok: false, detail: error.message }
    return { ok: true, detail: `구독자 ${count ?? 0}명(active)` }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

// 키 존재만 확인하는 항목 (실제 호출은 비용/부작용이 있어 생략하는 것들)
function checkEnvPresence(): Check {
  const required = [
    "GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "N8N_WEBHOOK_SECRET",
    "CRON_SECRET", "ADMIN_EMAIL", "NEXT_PUBLIC_SITE_URL",
  ]
  const missing = required.filter(k => !process.env[k])
  return missing.length
    ? { ok: false, detail: `누락: ${missing.join(", ")}` }
    : { ok: true, detail: `필수 ${required.length}개 모두 설정` }
}

export async function GET(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [instagram, threads, ga4, brevo, supabase] = await Promise.all([
    checkInstagram(),
    checkThreads(),
    checkGa4(),
    checkBrevo(),
    checkSupabase(),
  ])
  const env = checkEnvPresence()

  const checks = { supabase, brevo, instagram, threads, ga4, env }
  const allOk = Object.values(checks).every(c => c.ok)

  return NextResponse.json(
    { ok: allOk, checkedAt: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 }
  )
}
