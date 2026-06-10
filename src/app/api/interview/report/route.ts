import { geminiJson } from "@/lib/ai/gemini"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export const maxDuration = 60

const SYSTEM = `너는 한국 마케팅 면접 코치야. 모의면접 전체 기록(질문+답변)을 보고 종합 평가를 줘.
규칙:
- score: 0~100 정수. 후하지 않게 현실적으로 (답변 성의/구체성/직무 이해도 기준)
- summary: 전체 총평 2~3문장
- strengths: 강점 2개 (각 1문장)
- improvements: 보완점 2개 (각 1문장, 구체적 개선 방향 포함)
- soundbite: 이 지원자가 다음 면접에서 그대로 쓸 수 있는 '면접 한 마디' 1개 (1~2문장, 답변 내용을 다듬어서)
- 전부 한국어, 마크다운 금지
JSON만 반환: {"score":70,"summary":"...","strengths":["...","..."],"improvements":["...","..."],"soundbite":"..."}`

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "interview-report", limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const { role, qa } = await req.json()
  if (!Array.isArray(qa) || !qa.length) {
    return NextResponse.json({ error: "qa 필수" }, { status: 400 })
  }

  // question/answer가 모두 있는 항목만 사용 — undefined가 프롬프트에 섞이는 것 방지
  const validQa = qa.filter(
    (x): x is { question: string; answer: string } =>
      !!x && typeof x.question === "string" && x.question.trim() !== "" && x.answer != null
  )
  if (!validQa.length) {
    return NextResponse.json({ error: "유효한 면접 기록이 없습니다" }, { status: 400 })
  }

  const transcript = validQa
    .map((x, i) => `Q${i + 1}. ${x.question}\nA${i + 1}. ${String(x.answer).slice(0, 1500)}`)
    .join("\n\n")

  const result = await geminiJson<{
    score: number; summary: string; strengths: string[]; improvements: string[]; soundbite: string
  }>(
    SYSTEM,
    `직무: ${role ?? "마케팅"}\n\n[면접 기록]\n${transcript}\n\nJSON만 반환해.`,
    1200
  )

  if (!result?.summary) {
    return NextResponse.json({ error: "리포트 생성 실패" }, { status: 500 })
  }
  return NextResponse.json(result)
}
