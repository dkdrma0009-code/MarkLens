import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { validateSlideAll } from "@/lib/cardnews/validate"
import type { Slide, CoverSlide } from "@/lib/cardnews/types"

// 진단이 제안한 새 표지 훅으로 cover.headline만 교체 (나머지 슬라이드 유지).
// headline은 줄바꿈(\n)으로 구분된 문자열 → 배열로. highlight는 새 문구에 맞게 보정.
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId, headline } = await req.json().catch(() => ({}))
  if (!articleId || typeof headline !== "string" || !headline.trim()) {
    return NextResponse.json({ error: "articleId, headline required" }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: card } = await sb.from("cardnews").select("slides").eq("article_id", articleId).single()
  if (!card?.slides) return NextResponse.json({ error: "카드뉴스가 없습니다" }, { status: 404 })

  const slides = card.slides as Slide[]
  const idx = slides.findIndex(s => s.type === "cover")
  if (idx < 0) return NextResponse.json({ error: "표지 슬라이드가 없습니다" }, { status: 400 })

  const lines = headline.split(/\n/).map(l => l.trim()).filter(Boolean).slice(0, 3)
  const cover = slides[idx] as CoverSlide
  cover.headline = lines

  // highlight: 기존 강조어가 새 문구에 없으면, 숫자 토큰이 있으면 그걸로, 없으면 제거
  const joined = lines.join("")
  if (!cover.highlight || !joined.includes(cover.highlight)) {
    const num = joined.match(/\d+[%배원건]?/)?.[0]
    cover.highlight = num && joined.includes(num) ? num : undefined
  }
  slides[idx] = cover

  const warnings = validateSlideAll(cover, idx + 1)
  const { error } = await sb.from("cardnews").update({ slides, updated_at: new Date().toISOString() }).eq("article_id", articleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, warnings })
}
