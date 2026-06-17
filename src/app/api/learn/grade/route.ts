import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { generateText } from "@/lib/ai/llm"

export async function POST(req: Request) {
  // AI 채점 비용 방지 — IP당 분당 30회 (퀴즈 문제당 1회 호출)
  const limited = checkRateLimit(req, { key: "learn-grade", limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { question, correctAnswer, userAnswer } = await req.json()

  const correct = String(correctAnswer).trim()
  const user = String(userAnswer).trim()

  // 1단계: 정확히 일치하거나 포함하면 바로 정답 처리
  if (
    correct.toLowerCase() === user.toLowerCase() ||
    correct.toLowerCase().includes(user.toLowerCase()) ||
    user.toLowerCase().includes(correct.toLowerCase())
  ) {
    return NextResponse.json({ result: "correct" })
  }

  // 2단계: AI 채점 (엄격하게)
  try {
    const text = await generateText({
      system: `채점자야. 아래 기준으로 엄격하게 채점해. 반드시 'correct' 또는 'incorrect' 중 하나만 반환해. 다른 말 절대 금지.

채점 기준:
- 정답이 영문 약자(ROAS, SEO 등)이면 반드시 해당 약자가 포함되어야 정답
- 정답이 특정 용어면 그 용어가 명확히 표현되어야 정답
- 의미가 완전히 같거나 동의어일 때만 정답
- 애매하거나 틀린 내용이 섞이면 오답`,
      prompt: `문제: ${question}\n정답: ${correct}\n사용자 답변: ${user}\n\n채점:`,
      maxTokens: 5,
    })

    const result = text.trim().toLowerCase().startsWith("correct") ? "correct" : "incorrect"
    return NextResponse.json({ result })
  } catch {
    // AI 채점 실패 시 오답 처리
    return NextResponse.json({ result: "incorrect" })
  }
}
