import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"

function isCreditError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : "").toLowerCase()
  return ["credit", "billing", "quota", "insufficient", "balance", "429", "resource_exhausted"].some(k => msg.includes(k))
}

async function callGemini(prompt: string, system: string, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

async function callClaude(system: string, prompt: string, maxTokens: number): Promise<string> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  })
  return res.content[0].type === "text" ? res.content[0].text : ""
}

async function callOpenAI(system: string, prompt: string, maxTokens: number): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  })
  return res.choices[0].message.content ?? ""
}

// 우선순위: Claude → OpenAI → Gemini
// 크레딧/쿼터 소진 시 자동으로 다음 단계로 폴백
export async function generateText({
  system,
  prompt,
  maxTokens = 4000,
}: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  // 1. Claude 시도
  try {
    const result = await callClaude(system, prompt, maxTokens)
    console.log("[AI] Claude 사용")
    return result
  } catch (err) {
    if (isCreditError(err)) {
      console.log("[AI] Claude 크레딧 부족 → OpenAI 시도")
    } else {
      console.warn("[AI] Claude 오류 → OpenAI 시도:", err instanceof Error ? err.message : err)
    }
  }

  // 2. OpenAI 시도
  try {
    const result = await callOpenAI(system, prompt, maxTokens)
    console.log("[AI] OpenAI 사용")
    return result
  } catch (err) {
    if (isCreditError(err)) {
      console.log("[AI] OpenAI 크레딧 부족 → Gemini 시도")
    } else {
      console.warn("[AI] OpenAI 오류 → Gemini 시도:", err instanceof Error ? err.message : err)
    }
  }

  // 3. Gemini 폴백 (최후 수단)
  console.log("[AI] Gemini 사용")
  return callGemini(prompt, system, maxTokens)
}
