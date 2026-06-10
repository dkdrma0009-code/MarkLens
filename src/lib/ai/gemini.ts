import { generateText } from "@/lib/ai/llm"

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

function tryParse<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned
    return JSON.parse(jsonStr) as T
  } catch {
    return null
  }
}

// Gemini JSON 모드 직접 호출 (빠름/안정) → 실패 시 Claude→OpenAI→Gemini 폴백 체인
export async function geminiJson<T>(system: string, prompt: string, maxTokens = 2000): Promise<T | null> {
  // 키가 없으면 Gemini 직접 호출은 건너뛰고 폴백 체인으로 — 불필요한 실패 fetch 2회 방지
  for (const model of GEMINI_KEY ? ["gemini-2.5-flash-lite", "gemini-2.5-flash"] : []) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, responseMimeType: "application/json" },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) continue
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        const parsed = tryParse<T>(text)
        if (parsed) return parsed
      }
    } catch { /* 다음 모델 시도 */ }
  }

  try {
    const text = await generateText({ system, prompt, maxTokens })
    return tryParse<T>(text)
  } catch {
    return null
  }
}
