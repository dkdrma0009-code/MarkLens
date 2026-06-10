import { ImageResponse } from "next/og"
import JSZip from "jszip"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { renderSlide, TOKENS } from "@/lib/cardnews/templates"
import { loadFonts } from "@/lib/cardnews/fonts"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 120

async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 6장 PNG → ZIP (파일명 {slug}-01.png ~ -06.png)
export async function GET(req: Request) {
  if (!await isAuthorized(req)) return new Response("Unauthorized", { status: 401 })

  const { searchParams } = new URL(req.url)
  const articleId = searchParams.get("articleId")
  if (!articleId) return new Response("articleId required", { status: 400 })

  const supabase = createAdminClient()
  const [{ data: card }, { data: insight }] = await Promise.all([
    supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single(),
    supabase.from("insights").select("slug").eq("article_id", articleId).single(),
  ])
  if (!card?.slides) return new Response("카드뉴스가 없습니다", { status: 404 })

  const slides = card.slides as Slide[]
  const category = card.category ?? "마케팅"
  const fonts = await loadFonts()

  // ASCII 안전 파일명 (한글 슬러그 대비)
  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const asciiSlug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`

  const zip = new JSZip()
  for (let i = 0; i < slides.length; i++) {
    const img = new ImageResponse(renderSlide(slides[i], category, slides.length), {
      width: TOKENS.WIDTH,
      height: TOKENS.HEIGHT,
      fonts,
    })
    const buf = await img.arrayBuffer()
    zip.file(`${asciiSlug}-${String(i + 1).padStart(2, "0")}.png`, buf)
  }

  const out = await zip.generateAsync({ type: "arraybuffer" })
  return new Response(out, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiSlug}-cardnews.zip"`,
    },
  })
}
