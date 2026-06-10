import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { renderSlide, SAMPLE_CARDNEWS, TOKENS } from "@/lib/cardnews/templates"
import { loadFonts } from "@/lib/cardnews/fonts"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 60

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function GET(req: Request) {
  if (!await isAuthorized(req)) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const slideNum = Math.min(Math.max(Number(searchParams.get("slide")) || 1, 1), 6)

  let slides: Slide[]
  let category: string

  if (searchParams.get("demo") === "1") {
    // 디자인 튜닝용 샘플 렌더
    slides = SAMPLE_CARDNEWS.slides
    category = SAMPLE_CARDNEWS.category
  } else {
    const articleId = searchParams.get("articleId")
    if (!articleId) return new Response("articleId required", { status: 400 })

    const supabase = createAdminClient()
    const { data } = await supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single()
    if (!data?.slides) return new Response("카드뉴스가 없습니다. 먼저 생성하세요.", { status: 404 })
    slides = data.slides as Slide[]
    category = data.category ?? "마케팅"
  }

  const slide = slides[slideNum - 1]
  if (!slide) return new Response("slide not found", { status: 404 })

  return new ImageResponse(renderSlide(slide, category, slides.length), {
    width: TOKENS.WIDTH,
    height: TOKENS.HEIGHT,
    fonts: await loadFonts(),
  })
}
