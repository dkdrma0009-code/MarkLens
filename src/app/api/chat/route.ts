import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

async function callGemini(messages: { role: string; content: string }[], system: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

export async function POST(req: Request) {
  const { messages, context } = await req.json()

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 })
  }

  const systemPrompt = `당신은 MarkLens의 AI 어시스턴트입니다. 마케팅 인사이트에 대해 독자의 질문에 답합니다.

규칙:
- 한국어로 대화합니다
- 짧고 명확하게, 실무에 바로 쓸 수 있게 답합니다
- 모르면 솔직하게 모른다고 합니다
- 마크다운 사용 금지${context ? `\n\n---\n[현재 인사이트 내용]\n${context}` : ""}`

  // Claude 시도 → 실패 시 Gemini 폴백
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })
    const text = res.content[0].type === "text" ? res.content[0].text : ""
    return NextResponse.json({ reply: text })
  } catch (claudeErr: any) {
    console.warn("Claude chat 실패, Gemini 폴백:", claudeErr.message)
    try {
      const text = await callGemini(messages, systemPrompt)
      return NextResponse.json({ reply: text })
    } catch (geminiErr: any) {
      console.error("Gemini chat 실패:", geminiErr.message)
      return NextResponse.json({ error: "AI 서비스에 일시적인 문제가 발생했습니다." }, { status: 503 })
    }
  }
}
