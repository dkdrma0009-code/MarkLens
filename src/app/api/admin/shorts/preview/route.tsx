import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { renderCampaignFrame, renderAdOverlay, renderAdEndcard, VTOKENS } from "@/lib/shorts/preview-templates"
import { loadFonts, loadAdFonts } from "@/lib/cardnews/fonts"
import { fetchImageDataUri, fetchImageWithDims } from "@/lib/cardnews/image"

export const maxDuration = 60

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 캠페인 논평 숏츠 "정지 프레임" 미리보기 — Shotstack 없이 레이아웃/스타일 검증용
// kind=ad-overlay  : AI 광고 매거진 오버레이 PNG (중앙 투명 — CapCut 레이어용)
//   ?headline1=&headline2=&highlight=&tagline=&masthead=&handle=
// kind=ad-endcard  : 엔드카드 풀프레임 (실제 제품컷 + 스펙광고 고지)
//   ?img=<제품이미지URL>&title=&sub=
export async function GET(req: Request) {
  if (!await isAuthorized(req)) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get("kind")

  if (kind === "ad-overlay") {
    const headline1 = searchParams.get("headline1")
    if (!headline1) return new Response("headline1 required", { status: 400 })
    return new ImageResponse(
      renderAdOverlay({
        masthead: searchParams.get("masthead") ?? undefined,
        tagline: searchParams.get("tagline") ?? undefined,
        headline1,
        headline2: searchParams.get("headline2") ?? undefined,
        highlight: searchParams.get("highlight") ?? undefined,
        handle: searchParams.get("handle") ?? undefined,
      }),
      { width: VTOKENS.WIDTH, height: VTOKENS.HEIGHT, fonts: await loadAdFonts() }
    )
  }

  if (kind === "ad-endcard") {
    const img = await fetchImageWithDims(searchParams.get("img"))
    return new ImageResponse(
      renderAdEndcard({
        image: img?.dataUri ?? null,
        imageDims: img,
        title: searchParams.get("title") ?? undefined,
        sub: searchParams.get("sub") ?? undefined,
        handle: searchParams.get("handle") ?? undefined,
      }),
      { width: VTOKENS.WIDTH, height: VTOKENS.HEIGHT, fonts: await loadAdFonts() }
    )
  }

  const articleId = searchParams.get("articleId")
  if (!articleId) return new Response("articleId required", { status: 400 })

  const supabase = createAdminClient()
  const [{ data: article }, { data: insight }] = await Promise.all([
    supabase.from("articles").select("source_name, image_url").eq("id", articleId).single(),
    supabase.from("insights").select("hook, category, why_it_matters, key_takeaways").eq("article_id", articleId).single(),
  ])
  if (!article || !insight) return new Response("기사/인사이트 없음", { status: 404 })

  const takeaways = Array.isArray(insight.key_takeaways) ? (insight.key_takeaways as string[]) : []
  const caption = takeaways[0] || (insight.why_it_matters ?? "").split(/(?<=[.!?。])\s+/)[0] || ""

  const image = await fetchImageDataUri(article.image_url)

  return new ImageResponse(
    renderCampaignFrame({
      image,
      category: insight.category ?? "마케팅",
      headline: insight.hook ?? "",
      caption,
      source: article.source_name ?? "MarkLens",
    }),
    { width: VTOKENS.WIDTH, height: VTOKENS.HEIGHT, fonts: await loadFonts() }
  )
}
