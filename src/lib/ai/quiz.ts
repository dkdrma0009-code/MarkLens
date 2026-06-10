import { generateText } from "@/lib/ai/llm"

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

export const LEVEL_MAP: Record<string, string> = {
  beginner: "입문 (마케팅을 처음 배우는 사람도 이해할 수 있는 기본 개념)",
  intermediate: "중급 (마케팅 기초는 알고 실무를 배우는 단계)",
  advanced: "고급 (현직 마케터 수준의 전략적 사고와 실무 지식)",
}

export const TYPE_MAP: Record<string, string> = {
  multiple_choice: "객관식만",
  short_answer: "단답형만",
  mixed: "객관식과 단답형 혼합 (비율 자유)",
}

export interface QuizQuestion {
  type: "multiple_choice" | "short_answer"
  question: string
  options?: string[]
  answer: number | string
  explanation: string
}

const SYSTEM = `너는 한국의 마케팅 전문 교육자야. 모든 문제·보기·정답·해설을 반드시 한국어로만 작성해. 영어로 쓰지 마. (전문 용어는 한국어 표기 후 괄호 안에 영어 병기 허용)
반드시 아래 JSON 형식으로만 응답해. 마크다운이나 설명 없이 순수 JSON만.

{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "문제 내용",
      "options": ["① 보기1", "② 보기2", "③ 보기3", "④ 보기4"],
      "answer": 0,
      "explanation": "해설"
    },
    {
      "type": "short_answer",
      "question": "문제 내용",
      "answer": "정답 키워드",
      "explanation": "해설"
    }
  ]
}

주의: 실제 마케팅 실무에서 쓰이는 개념 위주로 출제. 정답은 명확하게.`

// Gemini 직접 호출 — JSON 모드 + 2.5-flash-lite(thinking 없음 → 빠름/안정)
async function callGemini(system: string, prompt: string, maxTokens: number): Promise<string> {
  for (const model of ["gemini-2.5-flash-lite", "gemini-2.5-flash"]) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
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

function sanitizeJson(raw: string): string {
  let sanitized = ""
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (escaped) { sanitized += c; escaped = false; continue }
    if (c === "\\") { sanitized += c; escaped = true; continue }
    if (c === '"') { inString = !inString; sanitized += c; continue }
    if (inString) {
      if (c === "\n") { sanitized += "\\n"; continue }
      if (c === "\r") { sanitized += "\\r"; continue }
      if (c === "\t") { sanitized += "\\t"; continue }
      if (c.charCodeAt(0) < 0x20) continue
    }
    sanitized += c
  }
  return sanitized
}

function tryParse(text: string): QuizQuestion[] | null {
  try {
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned
    const data = JSON.parse(sanitizeJson(jsonStr))
    return data.questions?.length ? data.questions : null
  } catch {
    return null
  }
}

// 최근 인사이트를 출제 소스 텍스트로 변환
export function buildTrendDigest(insights: Array<{ hook?: string | null; summary?: string | null; why_it_matters?: string | null }>): string {
  return insights
    .map((i, idx) => {
      const why = (i.why_it_matters ?? "").slice(0, 300)
      return `${idx + 1}. ${i.hook ?? ""}\n${i.summary ?? ""}${why ? `\n${why}` : ""}`
    })
    .join("\n\n")
}

// 청크 1개 생성 — Gemini 직접 → 실패 시 폴백 체인
// context가 있으면 이번 주 트렌드 인사이트 기반으로 출제 (무기고 직무 정렬)
export async function generateChunk(n: number, level: string, type: string, seed: number, context?: string): Promise<QuizQuestion[]> {
  const maxTokens = Math.min(n * 280 + 500, 4000)
  const trendBlock = context
    ? `\n아래는 최근 발행된 마케팅 트렌드 인사이트야. 문제는 반드시 이 인사이트들의 내용(트렌드, 사례, 개념)을 기반으로 출제해. 일반 교과서 지식 문제 금지.\n\n[이번 주 인사이트]\n${context}\n`
    : ""
  const prompt = `한국어로 마케팅 문제 ${n}개를 생성해줘.
난이도: ${LEVEL_MAP[level] ?? level}
유형: ${TYPE_MAP[type] ?? type}
주제 다양성 시드: ${seed} (이 번호에 맞춰 서로 다른 ${context ? "인사이트를 골라" : "마케팅 주제·개념으로"} 출제해서 중복을 피해줘)
${trendBlock}
모든 내용은 반드시 한국어로. JSON만 반환해. 다른 텍스트 없이.`

  try {
    const text = await callGemini(SYSTEM, prompt, maxTokens)
    const result = tryParse(text)
    if (result) return result
  } catch (e) {
    console.warn(`[quiz] chunk ${seed} Gemini 실패:`, e instanceof Error ? e.message : e)
  }

  try {
    const text = await generateText({ system: SYSTEM, prompt, maxTokens })
    const result = tryParse(text)
    if (result) return result
  } catch (e) {
    console.error(`[quiz] chunk ${seed} 폴백 실패:`, e instanceof Error ? e.message : e)
  }

  return []
}

// 문제 수를 5개 단위 청크로 분할
export function splitChunks(count: number, chunkSize = 5): number[] {
  const chunks: number[] = []
  let remaining = count
  while (remaining > 0) {
    chunks.push(Math.min(chunkSize, remaining))
    remaining -= chunkSize
  }
  return chunks
}

// count개 문제를 청크 병렬로 생성
export async function generateQuestions(count: number, level: string, type: string, seedBase = 0, context?: string): Promise<QuizQuestion[]> {
  const chunks = splitChunks(count)
  const results = await Promise.all(
    chunks.map((n, idx) => generateChunk(n, level, type, seedBase + idx + 1, context))
  )
  return results.flat().slice(0, count)
}
