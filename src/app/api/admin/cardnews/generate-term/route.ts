import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateTermCard } from "@/lib/cardnews/term"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const maxDuration = 120

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 용어·꿀팁 카드뉴스 생성 — 기사 없이 '용어'만으로. 기존 cardnews 저장/렌더/편집을 그대로 재사용.
// article_id에 새 UUID를 부여(인사이트 연결 없음), category로 구분.
export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { term } = await req.json().catch(() => ({}))
  if (!term || typeof term !== "string" || term.trim().length < 2) {
    return NextResponse.json({ error: "용어를 입력하세요 (2자 이상)" }, { status: 400 })
  }

  const { data, warnings } = await generateTermCard(term.trim())
  if (!data?.slides) return NextResponse.json({ error: "카드 생성 실패" }, { status: 500 })

  const articleId = randomUUID()
  const supabase = createAdminClient()
  const { error } = await supabase.from("cardnews").insert({
    article_id: articleId,
    slides: data.slides,
    category: data.category ?? "용어/꿀팁",
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 })

  return NextResponse.json({ articleId, slides: data.slides, warnings })
}
