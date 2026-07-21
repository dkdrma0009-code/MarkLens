import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { resolveReelPhotos, type ReelPhotos, type ReelShotHints } from "@/lib/shorts/reel-photos"
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

  const category = card.category ?? "마케팅"

  // 저장된 설정이 있으면 그대로 쓰고 비전 호출을 건너뛴다.
  // 마이그레이션 009 미적용이면 컬럼이 없어 쿼리가 실패하므로 별도로 감싼다
  // (여기서 죽으면 미리보기 자체가 안 뜬다).
  type SavedReel = { settings?: unknown; photos?: ReelPhotos }
  let saved: SavedReel | null = null
  try {
    const { data } = await sb.from("cardnews").select("reel_settings").eq("article_id", articleId).single()
    saved = (data?.reel_settings as SavedReel | null) ?? null
  } catch { /* 컬럼 없음 → 저장 기능만 비활성, 나머지는 정상 동작 */ }

  if (saved?.settings) {
    return NextResponse.json({
      slides, category, coverImage,
      photos: saved.photos ?? {},
      savedSettings: saved.settings,
      fromSaved: true,
    })
  }

  // 장면별 사진 + 연출 힌트를 비전이 정한다. 여기서 한 번만 해석해 미리보기가 들고
  // 있다가 렌더 요청에 그대로 실어 보낸다 — 렌더가 다시 조회하면 다른 사진이 나온다.
  // 실패해도 렌더는 가능하므로(단색 폴백) 에러로 취급하지 않는다.
  let photos: ReelPhotos = {}
  let hints: ReelShotHints = {}
  try {
    ({ photos, hints } = await resolveReelPhotos(slides, category, coverImage))
  } catch (e) {
    console.warn("[cardnews/slides] 사진 해석 실패:", e instanceof Error ? e.message : e)
  }

  // hints = 비전이 정한 자막 위치·줌 방향. 조절 UI의 초기값으로 쓰고 사람이 덮어쓸 수 있다.
  return NextResponse.json({ slides, category, coverImage, photos, hints, fromSaved: false })
}
