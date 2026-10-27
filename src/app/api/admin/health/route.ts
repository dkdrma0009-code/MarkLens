import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkInstagram } from "@/lib/instagram"
import { checkThreads } from "@/lib/threads"
import { checkGa4 } from "@/lib/ga4"
import { blockedReason, databaseIsolated, deployment, supabaseRef } from "@/lib/release/guard.mjs"
import { summarizeError } from "@/lib/ai/errors"
import { analysisStall } from "@/lib/analysis/health"
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
  return !!user && !!adminEmail && user.email?.trim().toLowerCase() === adminEmail
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

// Model metadata lookup: free (no generation, no tokens), so it can run on every health check. It tells a dead,
// deleted or restricted key apart from a working one; it cannot show a used-up quota or billing state.
async function checkGemini(): Promise<Check> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return { ok: false, detail: "미설정 (GEMINI_API_KEY)" }
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite", {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true, detail: "키 유효(모델 조회 성공) · 할당량·결제 상태는 이 점검으로 알 수 없음" }
    return { ok: false, detail: summarizeError(new Error(`Gemini ${res.status}: ${await res.text()}`)) }
  } catch (e) {
    return { ok: false, detail: summarizeError(e) }
  }
}

async function checkAnalysis(): Promise<Check> {
  try {
    const s = await analysisStall(createAdminClient())
    const latest = s.latestInsightAt ? new Date(s.latestInsightAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음"
    const detail = `마지막 분석 ${latest} · 48시간 새 분석 ${s.recentInsights}건 · 분석 가능한 대기 ${s.freshPending}건`
    return { ok: !s.stalled, detail: s.stalled ? `정체 — ${detail}` : detail }
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

  const [instagram, threads, ga4, brevo, supabase, gemini, analysis] = await Promise.all([
    checkInstagram(),
    checkThreads(),
    checkGa4(),
    checkBrevo(),
    checkSupabase(),
    checkGemini(),
    checkAnalysis(),
  ])
  const env = checkEnvPresence()

  const checks = { supabase, analysis, gemini, brevo, instagram, threads, ga4, env }
  const allOk = Object.values(checks).every(c => c.ok)
  // How this deployment is classified by the release guard — the first thing to read on a Preview (names only).
  const actions = ["database", "instagram", "threads", "email", "aws", "ai", "cron"] as const
  const release = { deployment: deployment(), supabaseRef: supabaseRef(), databaseIsolated: databaseIsolated(), blocked: actions.filter(a => blockedReason(a)) }

  return NextResponse.json(
    { ok: allOk, checkedAt: new Date().toISOString(), release, checks },
    { status: allOk ? 200 : 503 }
  )
}
