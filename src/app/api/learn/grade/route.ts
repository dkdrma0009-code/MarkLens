import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { checkAiBudget } from "@/lib/ai/budget"
import { generateText } from "@/lib/ai/llm"

// Short answers are keywords ("SEO", "검색엔진 최적화(SEO)"); the caps keep a forged request from turning one quota slot
// into a huge prompt and are far above any real answer.
const MAX = { question: 1000, correctAnswer: 300, userAnswer: 500 }
const text = (v: unknown) => typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""
const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "")
const meaningful = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "")
// "검색엔진 최적화(SEO)" is answered correctly by either name; split on the separators the quiz prompt produces.
const aliases = (correct: string) => correct.split(/[()（）[\]/,·]|또는/).map(compact).filter(a => meaningful(a).length >= 2)

// "correct" / "incorrect" when the answer can be decided without AI; null when only a grader can tell.
function gradeWithoutAI(correctAnswer: string, userAnswer: string): "correct" | "incorrect" | null {
  const correct = compact(correctAnswer), user = compact(userAnswer)
  if (user === correct || aliases(correctAnswer).includes(user)) return "correct"
  if (meaningful(user).length < 2) return "incorrect" // one letter or only symbols is never the full answer
  if (user.includes(correct)) return "correct" // the whole answer, with more words around it
  return null // a fragment of the answer ("광고비" for "광고비 대비 매출") or a paraphrase
}

export async function POST(req: Request) {
  // AI 채점 비용 방지 — IP당 분당 30회 (퀴즈 문제당 1회 호출)
  const limited = checkRateLimit(req, { key: "learn-grade", limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const body = await req.json().catch(() => null)
  const question = text(body?.question), correct = text(body?.correctAnswer), user = text(body?.userAnswer)
  if (!question || !correct || !user) {
    return NextResponse.json({ error: "question, correctAnswer, userAnswer는 필수입니다.", code: "invalid_input" }, { status: 400 })
  }
  if (question.length > MAX.question || correct.length > MAX.correctAnswer || user.length > MAX.userAnswer) {
    return NextResponse.json({ error: `답변은 ${MAX.userAnswer}자 이하로 입력해주세요.`, code: "invalid_input" }, { status: 400 })
  }

  // 1단계: AI 없이 판정할 수 있는 답변
  const decided = gradeWithoutAI(correct, user)
  if (decided) return NextResponse.json({ result: decided })

  // 2단계: AI 채점 (엄격하게) — 일일 AI 한도 안에서만. 한도·중지 응답(code ai_paused / ai_quota / ai_unavailable)은
  // 그대로 돌려줘서 클라이언트가 오답이 아닌 "채점 불가"로 표시한다.
  const overBudget = await checkAiBudget(req, "learn")
  if (overBudget) return overBudget
  try {
    const verdict = (await generateText({
      system: `채점자야. 아래 기준으로 엄격하게 채점해. 반드시 'correct' 또는 'incorrect' 중 하나만 반환해. 다른 말 절대 금지.

채점 기준:
- 정답이 영문 약자(ROAS, SEO 등)이면 반드시 해당 약자가 포함되어야 정답
- 정답이 특정 용어면 그 용어가 명확히 표현되어야 정답
- 의미가 완전히 같거나 동의어일 때만 정답
- 애매하거나 틀린 내용이 섞이면 오답`,
      prompt: `문제: ${question}\n정답: ${correct}\n사용자 답변: ${user}\n\n채점:`,
      maxTokens: 5,
    })).trim().toLowerCase()
    if (verdict.startsWith("incorrect")) return NextResponse.json({ result: "incorrect" })
    if (verdict.startsWith("correct")) return NextResponse.json({ result: "correct" })
    throw new Error("unrecognised verdict")
  } catch {
    // A failed or unreadable grading is not the learner's wrong answer.
    return NextResponse.json({ error: "지금은 채점할 수 없습니다. 이 문제는 점수에서 제외됩니다.", code: "ai_unavailable" }, { status: 503 })
  }
}
