import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderSlide, TOKENS } from "@/lib/cardnews/templates"
import { loadFonts } from "@/lib/cardnews/fonts"
import { fetchImageDataUri } from "@/lib/cardnews/image"
import type { Slide } from "@/lib/cardnews/types"

export interface CardnewsRender {
  buffers: Buffer[]
  caption: string | null
  slug: string
}

// 카드뉴스 6장을 PNG 버퍼로 렌더 (다운로드/발행 공용). 표지 사진 옵트인 로직 동일.
export async function renderCardnewsBuffers(articleId: string): Promise<CardnewsRender | null> {
  const supabase = createAdminClient()
  const [{ data: card }, { data: insight }, { data: article }] = await Promise.all([
    supabase.from("cardnews").select("slides, category, caption").eq("article_id", articleId).single(),
    supabase.from("insights").select("slug").eq("article_id", articleId).single(),
    supabase.from("articles").select("image_url").eq("id", articleId).single(),
  ])
  if (!card?.slides) return null

  const slides = card.slides as Slide[]
  const category = card.category ?? "마케팅"
  const fonts = await loadFonts()
  const usePhoto = (slides[0] as { usePhoto?: boolean })?.usePhoto !== false
  const coverImage = usePhoto ? await fetchImageDataUri(article?.image_url) : null

  const buffers = await Promise.all(
    slides.map(async (slide, i) => {
      const ab = await new ImageResponse(
        renderSlide(slide, category, slides.length, { coverImage: i === 0 ? coverImage : null }),
        { width: TOKENS.WIDTH, height: TOKENS.HEIGHT, fonts }
      ).arrayBuffer()
      return Buffer.from(ab)
    })
  )

  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const slug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`

  return { buffers, caption: (card as { caption?: string }).caption ?? null, slug }
}
