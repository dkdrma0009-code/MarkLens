import { createAdminClient } from "@/lib/supabase/admin"
import { generateQuestions, type QuizQuestion } from "@/lib/ai/quiz"
import { NextResponse } from "next/server"

export const maxDuration = 60

// 미리 쌓아둔 풀에서 랜덤 추출 → 즉시 응답 (수십 ms)
// 풀이 부족하면 AI 즉석 생성으로 폴백
export async function POST(req: Request) {
  const { count, level, type } = await req.json()
  const n = Math.min(Math.max(Number(count) || 10, 1), 30)

  const supabase = createAdminClient()

  // mixed면 type 필터 없음(NULL), 아니면 해당 타입만
  const pType = type === "mixed" ? null : type

  const { data, error } = await supabase.rpc("random_quiz", {
    p_level: level,
    p_type: pType,
    p_count: n,
  })

  if (!error && data?.length) {
    const questions = (data as { data: QuizQuestion }[]).map(row => row.data)
    // 풀에 충분히 있으면 그대로 반환
    if (questions.length >= n) {
      return NextResponse.json({ questions, source: "pool" })
    }
    // 부족분만 AI로 채워서 합침
    const missing = n - questions.length
    const fresh = await generateQuestions(missing, level, type)
    const merged = [...questions, ...fresh].slice(0, n)
    if (merged.length) return NextResponse.json({ questions: merged, source: "mixed" })
  }

  // 풀 비었거나 조회 실패 → 전량 AI 생성
  if (error) console.warn("[quiz] random_quiz RPC 실패, AI 폴백:", error.message)
  const questions = await generateQuestions(n, level, type)
  if (!questions.length) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }
  return NextResponse.json({ questions, source: "live" })
}
