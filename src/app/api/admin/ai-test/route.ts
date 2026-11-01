import { createHash, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdminEmail } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { blockedReason } from "@/lib/release/guard.mjs"
import { generateText } from "@/lib/ai/llm"
import { summarizeError } from "@/lib/ai/errors"
import { runManualAI } from "@/lib/ai/manual-context"

const notice = "유료 AI 호출이 발생할 수 있습니다. 샘플 결과만 반환하며 기사·문제·뉴스레터를 저장하거나 발행하지 않습니다."
const input = z.object({
  feature: z.enum(["article", "interview", "quiz", "newsletter", "cardnews"]),
  sample: z.string().trim().min(10).max(2000),
  acceptCost: z.literal(true),
}).strict()
const tasks = {
  article: "제공된 사실만으로 기사 분석 요약 샘플을 작성하세요.",
  interview: "제공된 내용으로 마케팅 면접 질문 한 개를 작성하세요.",
  quiz: "제공된 내용으로 정답과 해설을 포함한 퀴즈 한 개를 작성하세요.",
  newsletter: "제공된 사실만으로 뉴스레터 초안 샘플을 작성하세요.",
  cardnews: "제공된 사실만으로 카드뉴스 표지 문구 샘플을 작성하세요.",
}

export async function GET() {
  if (!await getAdminEmail()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ notice, dailyLimit: 5, maxProviderRequests: 1, maxOutputTokens: 1000, enabled: process.env.AI_MANUAL_TEST_ENABLED === "on" })
}

export async function POST(req: Request) {
  const actor = await getAdminEmail()
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const stopped = blockedReason("ai")
  if (stopped || process.env.AI_MANUAL_TEST_ENABLED !== "on") {
    return NextResponse.json({ error: stopped ?? "Manual AI tests are disabled" }, { status: 503 })
  }
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "유효한 샘플과 비용 발생 동의(acceptCost: true)가 필요합니다.", notice }, { status: 400 })
  const actorId = createHash("sha256").update(actor).digest("hex").slice(0, 16)
  const { data, error } = await createAdminClient().rpc("consume_ai_quota", {
    p_scope: "manual-ai", p_key: "all-admins", p_window_seconds: 86400, p_limit: 5,
  })
  if (error || data !== true) return NextResponse.json({ error: error ? "AI quota unavailable" : "Daily manual AI limit reached" }, { status: error ? 503 : 429 })
  const id = randomUUID()
  const started = Date.now()
  try {
    const { result, calls } = await runManualAI(() => generateText({
      system: `${tasks[parsed.data.feature]} 한국어로 작성하고 입력에 없는 사실은 만들지 마세요.`,
      prompt: parsed.data.sample, maxTokens: 1000,
    }))
    console.info("[manual-ai]", JSON.stringify({ id, actorId, feature: parsed.data.feature, status: "success", calls, outputCharacters: result.length, elapsedMs: Date.now() - started, tokenUsage: "not_recorded" }))
    return NextResponse.json({ id, result, calls, persisted: false, tokenUsage: "not_recorded" })
  } catch (err) {
    const failure = summarizeError(err, 200)
    console.warn("[manual-ai]", JSON.stringify({ id, actorId, feature: parsed.data.feature, status: "failed", error: failure, elapsedMs: Date.now() - started }))
    return NextResponse.json({ id, error: failure }, { status: 502 })
  }
}
