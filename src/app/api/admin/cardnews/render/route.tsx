import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { renderSlide, SAMPLE_CARDNEWS, TOKENS } from "@/lib/cardnews/templates"
import { loadFonts } from "@/lib/cardnews/fonts"
import { fetchImageDataUri } from "@/lib/cardnews/image"
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

// 인사이트 hook을 표지 헤드라인(줄당 ≤12자, 최대 3줄)으로 분할 — 미생성 카드 프리뷰용
function splitHeadline(text: string, maxPerLine = 12, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w
    if ([...cand].length <= maxPerLine) {
      cur = cand
    } else {
      if (cur) lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  return lines.length ? lines.slice(0, maxLines) : [text.slice(0, maxPerLine)]
}

export async function GET(req: Request) {
  if (!await isAuthorized(req)) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const slideNum = Math.min(Math.max(Number(searchParams.get("slide")) || 1, 1), 6)

  let slides: Slide[]
  let category: string
  let coverImage: string | null = null
  let isPreview = false // 미생성 카드의 표지 프리뷰 여부 (캐시 정책 분기)

  if (searchParams.get("demo") === "1") {
    // 디자인 튜닝용 샘플 렌더
    slides = SAMPLE_CARDNEWS.slides
    category = SAMPLE_CARDNEWS.category
  } else {
    const articleId = searchParams.get("articleId")
    if (!articleId) return new Response("articleId required", { status: 400 })

    const supabase = createAdminClient()
    const { data } = await supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single()

    if (data?.slides) {
      slides = data.slides as Slide[]
      category = data.category ?? "마케팅"
    } else {
      // 미생성 — 인사이트(hook)로 표지 프리뷰 생성 (표지 1장만 지원)
      if (slideNum !== 1) return new Response("카드뉴스가 없습니다. 먼저 생성하세요.", { status: 404 })
      const { data: insight } = await supabase.from("insights").select("hook, category").eq("article_id", articleId).single()
      if (!insight?.hook) return new Response("카드뉴스가 없습니다. 먼저 생성하세요.", { status: 404 })
      category = insight.category ?? "마케팅"
      slides = [{ type: "cover", headline: splitHeadline(insight.hook) }]
      isPreview = true
    }

    // 표지(1장)는 아티클 대표 이미지를 배경으로 사용 (없으면 타이포 표지)
    if (slideNum === 1) {
      const { data: article } = await supabase.from("articles").select("image_url").eq("id", articleId).single()
      coverImage = await fetchImageDataUri(article?.image_url)
    }
  }

  const slide = slides[slideNum - 1]
  if (!slide) return new Response("slide not found", { status: 404 })

  return new ImageResponse(renderSlide(slide, category, slides.length, { coverImage }), {
    width: TOKENS.WIDTH,
    height: TOKENS.HEIGHT,
    fonts: await loadFonts(),
    // 프리뷰는 인사이트가 바뀌지 않는 한 동일 → 1일 캐시로 재렌더 방지 (생성본은 편집 즉시 반영 위해 캐시 안 함)
    ...(isPreview ? { headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } } : {}),
  })
}
