import { createAdminClient } from "@/lib/supabase/admin"
import { searchUnsplash } from "@/lib/newsletter/unsplash"
import { isHotlinkBlocked } from "@/lib/images"

// 원본 image_url이 없거나(og 실패) 핫링크 차단인 published 아티클에 Unsplash 폴백 이미지를 채운다.
// 이미 fallback_image 있으면 건너뜀(멱등). 최근 사이트공개분부터 우선(가장 눈에 띄는 것부터).
// Unsplash 데모 한도(시간당 50) 때문에 limit로 배치한다. 실패는 무시하고 다음으로.
export async function backfillFallbackImages(limit = 10): Promise<{ filled: number; scanned: number }> {
  const sb = createAdminClient()
  const { data: rows } = await sb
    .from("articles")
    .select("id, title, image_url")
    .eq("status", "published")
    .is("fallback_image", null)
    .order("site_published_at", { ascending: false, nullsFirst: false })
    .limit(200)

  const targets = (rows ?? [])
    .filter(a => !a.image_url || isHotlinkBlocked(a.image_url as string))
    .slice(0, limit)

  let filled = 0
  for (const a of targets) {
    const photo = await searchUnsplash((a.title as string) || "marketing business", "landscape")
    if (photo) {
      await sb.from("articles").update({ fallback_image: photo }).eq("id", a.id)
      filled++
    }
  }
  return { filled, scanned: targets.length }
}
