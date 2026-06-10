import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestions, type QuizQuestion } from "@/lib/ai/quiz"
import { NextResponse } from "next/server"

export const maxDuration = 60

// 질문 정규화 키 — 공백/기호/영문대소문자 제거 후 앞 20글자
// 같은 주제를 다르게 물어도 도입부가 같으면 유사문제로 간주해 한 세션에서 배제
function dedupeKey(q: QuizQuestion): string {
  return (q.question ?? "").toLowerCase().replace(/[^가-힣a-z0-9]/g, "").slice(0, 20)
}

// 유사문제 제거하며 최대 n개 선별
function pickDistinct(questions: QuizQuestion[], n: number): QuizQuestion[] {
  const seen = new Set<string>()
  const out: QuizQuestion[] = []
  for (const q of questions) {
    const k = dedupeKey(q)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(q)
    if (out.length >= n) break
  }
  return out
}

// 미리 쌓아둔 풀에서 랜덤 추출 → 즉시 응답 (수십 ms)
// 유사문제 배제 후 부족하면 AI로 보충
export async function POST(req: Request) {
  const { count, level, type } = await req.json()
  const n = Math.min(Math.max(Number(count) || 10, 1), 30)

  const supabase = createAdminClient()
  const pType = type === "mixed" ? null : type

  // 필요 수의 3배를 랜덤으로 받아 유사문제를 걸러낼 여유 확보
  const { data, error } = await supabase.rpc("random_quiz", {
    p_level: level,
    p_type: pType,
    p_count: n * 3,
  })

  let questions: QuizQuestion[] = []
  if (!error && data?.length) {
    const pool = (data as { data: QuizQuestion }[]).map(row => row.data)
    questions = pickDistinct(pool, n)
  } else if (error) {
    console.warn("[quiz] random_quiz RPC 실패, AI 폴백:", error.message)
  }

  // 풀이 부족하면 AI로 보충 (기존 질문과도 중복 안 되게 합쳐서 다시 선별)
  if (questions.length < n) {
    const missing = n - questions.length
    const fresh = await generateQuestions(missing + 2, level, type)
    questions = pickDistinct([...questions, ...fresh], n)
  }

  if (!questions.length) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
  return NextResponse.json({ questions })
}
