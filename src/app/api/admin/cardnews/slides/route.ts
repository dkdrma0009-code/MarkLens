import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import type { Slide } from "@/lib/cardnews/types"

// 어드민 릴스 미리보기(Remotion Player)용 — 슬라이드 + 표지 이미지를 그대로 내려준다.
// 표지 URL은 Lambda 렌더가 쓰는 것과 동일한 weserv 변환 URL이어야 미리보기와 결과가 같다.
export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const articleId = new URL(req.url).searchParams.get("articleId")
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const sb = createAdminClient()
  const [{ data: card }, { data: article }] = await Promise.all([
    sb.from("cardnews").select("slides, category").eq("article_id", articleId).single(),
    sb.from("articles").select("image_url").eq("id", articleId).single(),
  ])
  if (!card?.slides) return NextResponse.json({ error: "카드뉴스가 없습니다 (먼저 생성하세요)" }, { status: 404 })

  const slides = card.slides as Slide[]
  const usePhoto = (slides[0] as { usePhoto?: boolean })?.usePhoto !== false
  const coverImage = usePhoto && article?.image_url
    ? `https://images.weserv.nl/?url=${encodeURIComponent(article.image_url)}&output=jpg&w=1080&q=85`
    : null

  // 연출 설정 저장(기사별)은 아직 미구현 — 미리보기는 기본값에서 시작한다.
  return NextResponse.json({ slides, category: card.category ?? "마케팅", coverImage })
}
