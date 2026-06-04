import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

async function callGemini(system: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  )
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    // 최근 6개 메시지만 유지
    const recentMessages = messages.slice(-6)

    const system = `너는 이 페이지의 글 내용을 기반으로 답변하는 어시스턴트야.
반드시 글에 나온 내용만을 근거로 답변하고, 글과 무관한 질문이 오면 "이 글과 관련된 질문을 해주세요 😊"라고만 답해.
욕설이나 비속어가 포함된 메시지는 "그런 표현은 삼가 주세요 😊 마케팅 질문이 있으면 편하게 물어보세요!"라고만 답해.
사용자 이름은 절대 추측하거나 언급하지 마.
답변은 자연스러운 한국어로, 핵심만 간결하게 말해줘.${context ? `\n\n[글 내용]\n${context}` : ""}`

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
            max_tokens: 1000,
            system,
            messages: [{ role: "user", content: prompt }],
          })

          for await (const chunk of claudeStream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              send(chunk.delta.text)
            }
          }
        } catch (e: any) {
          const isCreditError = /credit|billing|quota|balance/i.test(e?.message ?? "")
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
