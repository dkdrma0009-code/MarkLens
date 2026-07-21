import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"

// 릴스컷 연출 설정 + 확정 사진을 기사별로 저장한다.
// 사진을 같이 굳히는 게 핵심 — 설정만 저장하면 다음에 열 때 사진이 바뀌어
// 자막 위치·줌이 어긋난다(그 값들은 특정 사진 구도를 전제로 정한 것이라서).
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId, settings, photos } = await req.json().catch(() => ({}))
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })
  if (!settings) return NextResponse.json({ error: "settings required" }, { status: 400 })

  const sb = createAdminClient()
  const { error } = await sb
    .from("cardnews")
    .update({ reel_settings: { settings, photos: photos ?? {}, savedAt: new Date().toISOString() } })
    .eq("article_id", articleId)

  if (error) {
    // 컬럼이 없으면 마이그레이션 009 미적용 — 원인을 분명히 알려준다
    const hint = error.message.includes("reel_settings")
      ? " (supabase/migrations/009_cardnews_reel_settings.sql 을 먼저 실행하세요)"
      : ""
    return NextResponse.json({ error: error.message + hint }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// 저장된 설정 삭제 — 다시 비전 판단으로 돌아간다
export async function DELETE(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const articleId = new URL(req.url).searchParams.get("articleId")
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const sb = createAdminClient()
  const { error } = await sb.from("cardnews").update({ reel_settings: null }).eq("article_id", articleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
