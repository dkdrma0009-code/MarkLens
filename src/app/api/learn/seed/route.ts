import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateQuestions } from "@/lib/ai/quiz"
import { NextResponse } from "next/server"

export const maxDuration = 300

const LEVELS = ["beginner", "intermediate", "advanced"]

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 풀 채우기: 레벨별로 객관식 + 단답형을 생성해 quiz_questions에 적재
// body: { perCombo?: number }  레벨×타입 조합당 생성 개수 (기본 20)
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isN8n = secret === process.env.N8N_WEBHOOK_SECRET
  if (!isN8n && !await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const perCombo = Math.min(Math.max(Number(body.perCombo) || 20, 1), 50)

  const supabase = createAdminClient()
  const rows: { level: string; type: string; data: unknown }[] = []
  let seedBase = 0

  // 레벨 × {객관식, 단답형} 각각 생성 — mixed는 풀에 따로 안 쌓음(둘 다 있으면 mixed 조회 시 합쳐짐)
  for (const level of LEVELS) {
    for (const type of ["multiple_choice", "short_answer"]) {
      const questions = await generateQuestions(perCombo, level, type, seedBase)
      seedBase += 100
      for (const q of questions) {
        rows.push({ level, type: q.type, data: q })
      }
    }
  }

  if (!rows.length) {
    return NextResponse.json({ error: "생성된 문제 없음" }, { status: 500 })
  }

  const { error } = await supabase.from("quiz_questions").insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 적재 후 풀 통계
  const { count } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true })

  return NextResponse.json({ inserted: rows.length, poolTotal: count ?? null })
}
