import { createAdminClient } from "@/lib/supabase/admin"
import { geminiJson } from "@/lib/ai/gemini"
import { buildTrendDigest } from "@/lib/ai/quiz"
import { checkRateLimit } from "@/lib/rate-limit"
import { checkAiBudget } from "@/lib/ai/budget"
import { fallbackQuestions } from "@/lib/interview/fallback-questions"
import { NextResponse } from "next/server"

export const maxDuration = 60

interface Question {
  question: string
  kind: "trend" | "role" | "behavioral"
}

const SYSTEM = `너는 한국 기업의 마케팅 직무 면접관이야. 취준생·주니어 대상의 실제 면접에서 나올 법한 질문을 한국어로 만들어.
규칙:
- 질문은 한 문장씩, 자연스러운 구어체 존댓말
- trend 질문은 주어진 인사이트의 실제 트렌드/사례를 인용해서 의견을 묻는 형태 ("최근 ~했는데, 어떻게 보시나요?")
- role 질문은 해당 직무의 실무 역량을 검증하는 형태
- behavioral 질문은 경험/태도를 묻는 형태 (STAR로 답할 수 있는)
- 마크다운 금지
JSON만 반환: {"questions":[{"question":"...","kind":"trend"},{"question":"...","kind":"role"},{"question":"...","kind":"behavioral"}]}`

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "interview-questions", limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const { role: rawRole, count } = await req.json()
  const role = String(rawRole ?? "마케팅").slice(0, 100) // 프롬프트 주입 페이로드 상한
  const n = Math.min(Math.max(Number(count) || 5, 3), 7)

  // Published insights only: an interview must not quote an unpublished draft.
  let insights: { hook: string | null; summary: string | null; why_it_matters: string | null }[] = []
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("insights")
      .select("hook, summary, why_it_matters, article:articles!inner(status)")
      .eq("article.status", "published")
      .order("created_at", { ascending: false })
      .limit(8)
    insights = data ?? []
  } catch { /* the fixed question bank still works */ }
  // No AI call: the interview still starts when the AI budget is used up or generation fails.
  const fallback = (reason: "budget" | "ai") =>
    NextResponse.json({ questions: fallbackQuestions(role, n, insights.map(i => i.hook ?? "")), fallback: reason })

  const overBudget = await checkAiBudget(req, "interview") // global daily AI quota (migration 024)
  if (overBudget) return fallback("budget")

  const digest = insights.length ? buildTrendDigest(insights) : ""

  const result = await geminiJson<{ questions: Question[] }>(
    SYSTEM,
    `${role} 직무 면접 질문 ${n}개를 만들어줘.
구성: trend ${Math.ceil(n / 2)}개 (아래 인사이트 기반), 나머지는 role/behavioral 섞어서.
${digest ? `\n[이번 주 인사이트]\n${digest}\n` : ""}
JSON만 반환해.`,
    1500
  )

  if (!result?.questions?.length) return fallback("ai")
  return NextResponse.json({ questions: result.questions.slice(0, n) })
}
