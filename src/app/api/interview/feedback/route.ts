import { geminiJson } from "@/lib/ai/gemini"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export const maxDuration = 60

const SYSTEM = `너는 친절하지만 솔직한 한국 마케팅 면접 코치야. 면접 질문과 지원자의 답변을 보고 즉시 피드백을 줘.
규칙:
- good: 답변에서 잘한 점 (1~2문장, 구체적으로. 잘한 게 없으면 억지로 칭찬하지 말고 시도 자체에서 찾기)
- improve: 아쉬운 점과 개선 방향 (2~3문장, 구체적으로)
- model_answer: 같은 질문에 대한 모범 답변 예시 (2~4문장, 그대로 말할 수 있는 완성형. 가짜 경력/수치 금지)
- star: 답변의 STAR 구조 충족 여부 — s(상황 제시), t(과제/문제 정의), a(본인의 행동), r(결과/배운 점) 각각 true/false. 경험·행동 질문이 아니어서 STAR가 무의미하면 null
- 답변이 너무 짧거나 성의 없으면 솔직하게 지적
- 전부 한국어, 마크다운 금지
JSON만 반환: {"good":"...","improve":"...","model_answer":"...","star":{"s":true,"t":false,"a":true,"r":false}}`

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "interview-feedback", limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const { question, answer, role } = await req.json()
  if (!question || !answer) {
    return NextResponse.json({ error: "question, answer 필수" }, { status: 400 })
  }

  const result = await geminiJson<{
    good: string; improve: string; model_answer: string
    star?: { s: boolean; t: boolean; a: boolean; r: boolean } | null
  }>(
    SYSTEM,
    `직무: ${role ?? "마케팅"}
면접 질문: ${question}
지원자 답변: ${String(answer).slice(0, 2000)}

JSON만 반환해.`,
    1000
  )

  if (!result?.improve) {
    return NextResponse.json({ error: "피드백 생성 실패" }, { status: 500 })
  }
  return NextResponse.json(result)
}
