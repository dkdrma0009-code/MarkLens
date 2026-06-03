import Anthropic from "@anthropic-ai/sdk"

const CREDIT_ERROR_KEYWORDS = ["credit", "billing", "quota", "insufficient", "balance"]

function isCreditError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : "").toLowerCase()
  return CREDIT_ERROR_KEYWORDS.some(k => msg.includes(k))
}

async function callGemini(prompt: string, system: string): Promise<string> {
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

export async function generateText({
  system,
  prompt,
  maxTokens = 4000,
}: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  // Claude 시도
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    })
    return res.content[0].type === "text" ? res.content[0].text : ""
  } catch (err) {
    if (isCreditError(err)) {
      console.log("Claude 크레딧 부족 → Gemini 폴백")
      return callGemini(prompt, system)
    }
    throw err
  }
}
