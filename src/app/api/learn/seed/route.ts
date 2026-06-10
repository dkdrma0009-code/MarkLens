import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateQuestions, buildTrendDigest } from "@/lib/ai/quiz"
import { NextResponse } from "next/server"

export const maxDuration = 300

const LEVELS = ["beginner", "intermediate", "advanced"]

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 풀 채우기: 최근 인사이트를 출제 소스로 트렌드 기반 문제를 생성해 quiz_questions에 적재
// body: { perCombo?: number, replace?: boolean }
//   perCombo — 레벨×타입 조합당 생성 개수 (기본 20)
//   replace — true면 적재 성공 후 이번 시드 이전 문제 전부 삭제 (주간 갱신용)
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isN8n = secret === process.env.N8N_WEBHOOK_SECRET
  if (!isN8n && !await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const perCombo = Math.min(Math.max(Number(body.perCombo) || 20, 1), 50)
  const replace = body.replace === true
  const startedAt = new Date().toISOString()

  const supabase = createAdminClient()

  // 출제 소스: 최근 발행 인사이트 12개
  const { data: insights } = await supabase
    .from("insights")
    .select("hook, summary, why_it_matters, article:articles!inner(status)")
    .eq("article.status", "published")
    .order("created_at", { ascending: false })
    .limit(12)

  if (!insights?.length) {
    return NextResponse.json({ error: "출제할 인사이트 없음" }, { status: 400 })
  }
  const digest = buildTrendDigest(insights)

  const rows: { level: string; type: string; data: unknown }[] = []
  let seedBase = 0

  for (const level of LEVELS) {
    for (const type of ["multiple_choice", "short_answer"]) {
      const questions = await generateQuestions(perCombo, level, type, seedBase, digest)
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

  // 주간 갱신: 새 문제 적재 성공 후 옛 문제 제거
  let removed = 0
  if (replace) {
    const { count } = await supabase
      .from("quiz_questions")
      .delete({ count: "exact" })
      .lt("created_at", startedAt)
    removed = count ?? 0
  }

  const { count: poolTotal } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true })

  return NextResponse.json({ inserted: rows.length, removed, poolTotal: poolTotal ?? null })
}
