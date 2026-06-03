import { generateText } from "@/lib/ai/llm"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const system = `당신은 MarkLens의 마케팅 큐레이터입니다. 독자가 인사이트를 더 잘 이해하고 실무에 활용할 수 있도록 대화 상대가 되어줍니다.

말투:
- 친근하고 자연스럽게, 마치 선배 마케터가 커피 마시며 얘기하듯이
- 2~3문장으로 짧게, 핵심 하나만 짚기
- 딱딱한 격식체 금지, 하지만 반말도 금지 — 편안한 존댓말
- 마크다운 기호(**, *, #) 사용 금지
${context ? `\n지금 독자가 읽고 있는 인사이트:\n${context}` : ""}`

    // 대화 히스토리를 하나의 프롬프트로 조합
    const prompt = messages
      .map((m: { role: string; content: string }) =>
        m.role === "user" ? `사용자: ${m.content}` : `어시스턴트: ${m.content}`
      )
      .join("\n") + "\n어시스턴트:"

    const reply = await generateText({ system, prompt, maxTokens: 600 })
    return NextResponse.json({ reply })
  } catch (err) {
    console.error("chat error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "AI 서비스에 일시적인 문제가 발생했습니다." }, { status: 503 })
  }
}
