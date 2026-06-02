import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages, context } = await req.json()
  if (!messages || !context) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `당신은 MarkLens의 AI 어시스턴트입니다. 아래 마케팅 인사이트에 대해 독자의 질문에 답합니다.

규칙:
- 한국어로 대화합니다
- 인사이트 내용을 기반으로 답변합니다
- 짧고 명확하게, 실무에 바로 쓸 수 있게 답합니다
- 모르면 솔직하게 모른다고 합니다
- 마크다운 사용 금지

---
[인사이트 내용]
${context}`

  const res = await claude.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
  })

  const text = res.content[0].type === "text" ? res.content[0].text : ""
  return NextResponse.json({ reply: text })
}
