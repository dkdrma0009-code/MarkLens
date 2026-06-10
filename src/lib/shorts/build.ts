import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderCampaignFrame, VTOKENS } from "./templates"
import { loadFonts } from "@/lib/cardnews/fonts"

const BUCKET = "shorts"

export interface ShortAssets {
  overlayUrl: string  // Satori로 렌더한 투명 텍스트 오버레이 PNG 공개 URL
  imageUrl: string    // 배경 이미지(weserv jpg 변환) 공개 URL — 없으면 ""
  headline: string
  caption: string
}

// 캠페인 숏츠용 합성 에셋 생성: 텍스트 오버레이(Satori) → 공개 버킷 업로드, 배경 이미지 공개 URL 구성
export async function buildShortAssets(articleId: string): Promise<ShortAssets | null> {
  const supabase = createAdminClient()
  const [{ data: article }, { data: insight }] = await Promise.all([
    supabase.from("articles").select("source_name, image_url").eq("id", articleId).single(),
    supabase.from("insights").select("hook, category, why_it_matters, key_takeaways").eq("article_id", articleId).single(),
  ])
  if (!article || !insight) return null

  const takeaways = Array.isArray(insight.key_takeaways) ? (insight.key_takeaways as string[]) : []
  const caption = takeaways[0] || (insight.why_it_matters ?? "").split(/(?<=[.!?。])\s+/)[0] || ""
  const headline = insight.hook ?? ""

  // 투명 오버레이 렌더 (텍스트/그라데이션만, 이미지는 Shotstack이 아래에 깔음)
  const img = new ImageResponse(
    renderCampaignFrame({
      image: null,
      transparent: true,
      category: insight.category ?? "마케팅",
      headline,
      caption,
      source: article.source_name ?? "MarkLens",
    }),
    { width: VTOKENS.WIDTH, height: VTOKENS.HEIGHT, fonts: await loadFonts() }
  )
  const buf = Buffer.from(await img.arrayBuffer())

  // 공개 버킷 보장 후 업로드 (Shotstack이 가져갈 수 있게 public)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})
  const path = `${articleId}-${Date.now()}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: "image/png", upsert: true })
  if (error) throw new Error(`오버레이 업로드 실패: ${error.message}`)
  const overlayUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  // 배경 이미지 — webp 대비 weserv로 jpg 변환(공개 URL)
  const imageUrl = article.image_url
    ? `https://images.weserv.nl/?url=${encodeURIComponent(article.image_url)}&output=jpg&w=1080&h=1920&fit=cover`
    : ""

  return { overlayUrl, imageUrl, headline, caption }
}
