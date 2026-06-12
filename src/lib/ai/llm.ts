import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"

// 실패한 provider를 30분간 건너뜀 — 매번 에러 응답 기다리는 낭비 방지
const failedAt = new Map<string, number>()
const COOLDOWN_MS = 30 * 60 * 1000

function available(provider: string): boolean {
  const t = failedAt.get(provider)
  return !t || Date.now() - t > COOLDOWN_MS
}

function markFailed(provider: string) {
  failedAt.set(provider, Date.now())
  console.log(`[AI] ${provider} 실패 → ${COOLDOWN_MS / 60000}분 건너뜀`)
}

function isCreditError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : "").toLowerCase()
  return ["credit", "billing", "quota", "insufficient", "balance", "429", "resource_exhausted"].some(k => msg.includes(k))
}

async function callGeminiModel(model: string, prompt: string, system: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${JSON.stringify(data)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

async function callGemini(prompt: string, system: string, maxTokens = 4000): Promise<string> {
  // 2.5-flash-lite 먼저 (thinking 없음 → 빠름/안정), 실패 시 2.5-flash 폴백
  try {
    return await callGeminiModel("gemini-2.5-flash-lite", prompt, system, maxTokens)
  } catch (err) {
    console.log("[AI] Gemini 2.5-flash-lite 실패 → 2.5-flash 재시도")
    return await callGeminiModel("gemini-2.5-flash", prompt, system, maxTokens)
  }
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

// 우선순위: Gemini → Claude → OpenAI
// (2026-06-12 Gemini 주력 전환 — Claude/OpenAI 크레딧 소진. 충전하면 자동으로 폴백 보험 역할 복귀)
// 실패한 provider는 30분간 건너뛰어 불필요한 대기 없음
export async function generateText({
  system,
  prompt,
  maxTokens = 4000,
}: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  if (available("gemini")) {
    try {
      const result = await callGemini(prompt, system, maxTokens)
      console.log("[AI] Gemini 사용")
      return result
    } catch (err) {
      markFailed("gemini")
      console.warn("[AI] Gemini 오류:", err instanceof Error ? err.message : err)
    }
  }

  if (available("claude")) {
    try {
      const result = await callClaude(system, prompt, maxTokens)
      console.log("[AI] Claude 사용")
      return result
    } catch (err) {
      markFailed("claude")
      if (!isCreditError(err)) console.warn("[AI] Claude 오류:", err instanceof Error ? err.message : err)
    }
  }

  // 최후 폴백 — 실패 시 에러를 그대로 올려 호출부가 인지하게 함
  console.log("[AI] OpenAI 사용")
  return callOpenAI(system, prompt, maxTokens)
}
