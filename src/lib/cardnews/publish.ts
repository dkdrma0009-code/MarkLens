import { createAdminClient } from "@/lib/supabase/admin"
import { renderCardnewsBuffers } from "./render-buffers"
import { publishCarousel } from "@/lib/instagram"
import { publishThreadsCarousel } from "@/lib/threads"

export const CARDNEWS_BUCKET = "cardnews-ig"
const BUCKET = CARDNEWS_BUCKET

// 캡션 없을 때의 폴백 (인스타는 링크 클릭 불가 → 프로필 유도)
function defaultCaption(hook: string | null, category: string | null): string {
  const tag = (category ?? "마케팅").replace(/\s+/g, "")
  return `${hook ?? "이번 주 마케팅 인사이트"}

자세한 내용은 프로필 링크에서 확인하세요 🔍

트렌드를 실전으로 바꾸는 마크렌즈 | @marklens.site

#마케팅 #${tag} #마케팅트렌드 #마케팅공부 #취준 #마케터 #MarkLens`
}

// 카드뉴스 1건을 인스타 캐러셀로 발행 (버튼/cron 공용). 반환: IG 게시물 id
export async function publishCardnews(articleId: string): Promise<string> {
  const supabase = createAdminClient()

  // 스킵 처리된 카드뉴스(발행 멈춤 스테일 등)는 발행하지 않는다 — 사이트 공개는 유지, IG 만 종결.
  const { data: card } = await supabase
    .from("cardnews")
    .select("publish_status")
    .eq("article_id", articleId)
    .maybeSingle()
  if (card?.publish_status === "skipped_stale") {
    throw new Error(`카드뉴스가 스킵 처리됨(${card.publish_status}) — 발행하지 않습니다.`)
  }

  const rendered = await renderCardnewsBuffers(articleId)
  if (!rendered) throw new Error("카드뉴스가 없습니다. 먼저 생성하세요.")

  // 공개 버킷 업로드 → JPEG 변환 URL (인스타는 JPEG만 허용)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})
  const ts = Date.now()
  const imageUrls: string[] = []
  for (let i = 0; i < rendered.buffers.length; i++) {
    const path = `${articleId}/${ts}-${String(i + 1).padStart(2, "0")}.png`
    const { error } = await supabase.storage.from(BUCKET).upload(path, rendered.buffers[i], { contentType: "image/png", upsert: true })
    if (error) throw new Error(`업로드 실패: ${error.message}`)
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    imageUrls.push(`https://images.weserv.nl/?url=${encodeURIComponent(publicUrl)}&output=jpg`)
  }

  // 캡션: 저장된 것 우선, 없으면 인사이트 hook 기반 폴백
  let caption = rendered.caption
  if (!caption) {
    const { data: insight } = await supabase.from("insights").select("hook, category").eq("article_id", articleId).single()
    caption = defaultCaption(insight?.hook ?? null, insight?.category ?? null)
  }

  const postId = await publishCarousel(imageUrls, caption)

  // Threads 교차 발행 (best-effort — 미설정/실패해도 인스타 발행은 유지)
  try {
    const tId = await publishThreadsCarousel(imageUrls, caption)
    if (tId) console.log("[threads] 발행 완료:", tId)
  } catch (e) {
    console.warn("[threads] 발행 실패:", e instanceof Error ? e.message : e)
  }

  await supabase.from("cardnews").update({ posted_at: new Date().toISOString(), ig_post_id: postId }).eq("article_id", articleId)
  return postId
}
