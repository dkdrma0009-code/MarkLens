import { generateText } from "@/lib/ai/llm"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const system = `당신은 MarkLens의 AI 어시스턴트입니다. 마케팅 인사이트에 대해 독자의 질문에 답합니다.

규칙:
- 한국어로 대화합니다
- 짧고 명확하게, 실무에 바로 쓸 수 있게 답합니다
- 모르면 솔직하게 모른다고 합니다
- 마크다운 사용 금지
${context ? `\n[현재 인사이트 내용]\n${context}` : ""}`

    // 대화 히스토리를 하나의 프롬프트로 조합
    const prompt = messages
      .map((m: { role: string; content: string }) =>
        m.role === "user" ? `사용자: ${m.content}` : `어시스턴트: ${m.content}`
      )
      .join("\n") + "\n어시스턴트:"

    const reply = await generateText({ system, prompt, maxTokens: 600 })
    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error("chat error:", err.message)
    return NextResponse.json({ error: "AI 서비스에 일시적인 문제가 발생했습니다." }, { status: 503 })
  }
}
