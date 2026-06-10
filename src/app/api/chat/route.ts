import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

async function callGemini(system: string, prompt: string): Promise<string> {
  for (const model of ["gemini-2.5-flash-lite", "gemini-2.5-flash"]) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000 },
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) continue
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (text) return text
  }
  throw new Error("Gemini unavailable")
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    // 최근 6개 메시지만 유지
    const recentMessages = messages.slice(-6)

    const system = `너는 이 페이지의 마케팅 인사이트 글을 기반으로 답변하는 어시스턴트야.
반드시 글에 나온 내용만을 근거로 답변해. 글과 무관한 질문이 오면 "이 글과 관련된 질문을 해주세요 😊"라고만 답해.
욕설이나 비속어는 "그런 표현은 삼가 주세요 😊"라고만 답해.
답변 규칙:
- 자연스러운 한국어로 답해
- 반드시 완성된 문장으로 끝내야 해. 절대 중간에 끊기지 말 것
- 3~5문장 이내로 핵심만 전달해
- 마크다운 금지${context ? `\n\n[글 내용]\n${context}` : ""}`

    const prompt = recentMessages
      .map((m: { role: string; content: string }) =>
        m.role === "user" ? `사용자: ${m.content}` : `어시스턴트: ${m.content}`
      )
      .join("\n") + "\n어시스턴트:"

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (text: string) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }

        try {
          const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
          const claudeStream = claude.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            system,
            messages: [{ role: "user", content: prompt }],
          })

          for await (const chunk of claudeStream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              send(chunk.delta.text)
            }
          }
        } catch (e) {
          const isCreditError = e instanceof Error && /credit|billing|quota|balance/i.test(e.message)
          if (isCreditError) {
            try {
              const text = await callGemini(system, prompt)
              send(text)
            } catch {
              send("죄송해요, 잠시 문제가 있어요. 다시 시도해주세요.")
            }
          } else {
            send("죄송해요, 잠시 문제가 있어요. 다시 시도해주세요.")
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}
