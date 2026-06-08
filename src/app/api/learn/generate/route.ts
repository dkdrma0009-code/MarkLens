import { generateText } from "@/lib/ai/llm"
import { NextResponse } from "next/server"

export const maxDuration = 60

const LEVEL_MAP: Record<string, string> = {
  beginner: "입문 (마케팅을 처음 배우는 사람도 이해할 수 있는 기본 개념)",
  intermediate: "중급 (마케팅 기초는 알고 실무를 배우는 단계)",
  advanced: "고급 (현직 마케터 수준의 전략적 사고와 실무 지식)",
}

const TYPE_MAP: Record<string, string> = {
  multiple_choice: "객관식만",
  short_answer: "단답형만",
  mixed: "객관식과 단답형 혼합 (비율 자유)",
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

export async function POST(req: Request) {
  const { count, level, type } = await req.json()

  const system = `너는 마케팅 전문 교육자야. 반드시 아래 JSON 형식으로만 응답해. 마크다운이나 설명 없이 순수 JSON만.

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

  const prompt = `마케팅 문제 ${count}개를 생성해줘.
난이도: ${LEVEL_MAP[level] ?? level}
유형: ${TYPE_MAP[type] ?? type}

JSON만 반환해. 다른 텍스트 없이.`

  try {
    const text = await generateText({ system, prompt, maxTokens: 8000 })

    if (!text) {
      console.error("[quiz] empty response")
      return NextResponse.json({ error: "Generation failed" }, { status: 500 })
    }

    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error("[quiz] no JSON found in:", text.slice(0, 300))
      return NextResponse.json({ error: "Generation failed" }, { status: 500 })
    }

    const data = JSON.parse(sanitizeJson(match[0]))
    if (!data.questions?.length) {
      console.error("[quiz] no questions in parsed data")
      return NextResponse.json({ error: "No questions" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error("[quiz] generate error:", e)
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
}
