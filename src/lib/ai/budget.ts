import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { clientId } from "@/lib/rate-limit"

/* Global AI budget (R-2). The in-memory limiter (rate-limit.ts) is per serverless instance, so it cannot cap the total
   number of paid AI calls. Each public AI request also takes one slot from two database counters (migration 024):
   this client's daily quota for the feature, and the service-wide daily quota. Check and increment are one SQL
   statement, so concurrent requests cannot overshoot.
   - Limits are initial values sized from the existing flows (an interview session ≈ 7 calls, a quiz ≈ 1 + 1 per
     answer, one Insight Lab evaluation per challenge) and are overridden with AI_DAILY_LIMITS, e.g.
     "chat=100,interview=60,learn=200,insight-lab=20,global=3000". Revisit with real usage data.
   - Before migration 024 is applied the counters do not exist: requests pass (logged), keeping today's behaviour.
     Any other database failure refuses the request (fail closed). */
export type AiFeature = "chat" | "interview" | "learn" | "insight-lab"
export const DEFAULT_AI_DAILY_LIMITS: Record<AiFeature | "global", number> = { chat: 100, interview: 60, learn: 200, "insight-lab": 20, global: 3000 }
const DAY_SECONDS = 86_400

export function aiDailyLimits(raw = process.env.AI_DAILY_LIMITS): Record<AiFeature | "global", number> {
  const limits = { ...DEFAULT_AI_DAILY_LIMITS }
  for (const part of (raw ?? "").split(",")) {
    const [name, value] = part.split("=").map(s => s.trim())
    const n = Number(value)
    if (name in limits && Number.isInteger(n) && n >= 0) limits[name as keyof typeof limits] = n
  }
  return limits
}

// Never store a raw address: a truncated hash is enough to tell clients apart for a day.
const clientKey = (req: Request, userId?: string | null) => userId ? `user:${userId}` : `ip:${createHash("sha256").update(clientId(req)).digest("hex").slice(0, 32)}`
const isMissingQuota = (error: { code?: string; message?: string }) => error.code === "PGRST202" || error.code === "42883" || /consume_ai_quota/.test(error.message ?? "")
let warnedMissing = false

/** null when the call may proceed; otherwise the response to return (429 over quota, 503 when the quota cannot be read). */
export async function checkAiBudget(req: Request, feature: AiFeature, userId?: string | null): Promise<NextResponse | null> {
  const limits = aiDailyLimits()
  const db = createAdminClient()
  for (const [scope, key, limit] of [[`feature:${feature}`, clientKey(req, userId), limits[feature]], ["global", "all", limits.global]] as const) {
    const { data, error } = await db.rpc("consume_ai_quota", { p_scope: scope, p_key: key, p_window_seconds: DAY_SECONDS, p_limit: limit })
    if (error) {
      if (isMissingQuota(error)) {
        if (!warnedMissing) { warnedMissing = true; console.warn("[ai-budget] consume_ai_quota missing (migration 024 not applied) — global AI quota inactive") }
        return null
      }
      console.error("[ai-budget] quota check failed:", error.code ?? error.message)
      return NextResponse.json({ error: "AI 기능을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해주세요." }, { status: 503 })
    }
    if (data !== true) {
      return NextResponse.json({ error: scope === "global" ? "오늘 AI 기능 사용량이 많아 잠시 쉬어갑니다. 내일 다시 이용해주세요." : "오늘 이 기능의 AI 사용 한도에 도달했습니다. 내일 다시 이용해주세요." }, { status: 429 })
    }
  }
  return null
}
