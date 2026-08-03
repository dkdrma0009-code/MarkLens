import { createAdminClient } from "@/lib/supabase/admin"
import { renderCurationBuffers } from "./curation-render-buffers"
import { CARDNEWS_BUCKET } from "./publish"
import { publishCarousel } from "@/lib/instagram"
import { publishThreadsCarousel } from "@/lib/threads"
import type { CurationSlide } from "./curation-types"

/* 큐레이션 1건을 인스타 캐러셀로 발행 — cardnews 의 publish.ts 와 별개.
   차이: article_id 가 아니라 curations.id 키. 표지 사진 없음. 발행 원시(publishCarousel·
   Storage·Threads)는 cardnews 와 동일하게 재사용한다.
   전제: 이미 curations 테이블에 저장된 행(id)이어야 한다(크론이 generate→insert→publish). */

// 캡션이 비었을 때의 폴백 (buildCuration 이 보통 채우지만 안전망)
function defaultCaption(): string {
  return `이번 주 마크렌즈가 주목한 마케팅 트렌드를 정리했어요.

나중에 다시 보려면 저장 필수 📌
더 깊은 분석은 프로필 링크 → 뉴스레터 구독

#마케팅 #마케팅트렌드 #마케팅공부 #취준 #마케터 #큐레이션 #MarkLens`
}

// 반환: IG 게시물 id
export async function publishCuration(curationId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data: cur } = await supabase
    .from("curations")
    .select("id, slides, caption, week_of")
    .eq("id", curationId)
    .single()
  if (!cur?.slides) throw new Error("큐레이션이 없습니다 (먼저 생성·저장하세요).")

  const rendered = await renderCurationBuffers({
    slides: cur.slides as CurationSlide[],
    caption: (cur as { caption?: string | null }).caption,
    week_of: (cur as { week_of?: string | null }).week_of,
  })

  // 공개 버킷 재사용(cardnews-ig) → curations/<id>/ 경로 → JPEG 변환 URL(인스타는 JPEG만)
  await supabase.storage.createBucket(CARDNEWS_BUCKET, { public: true }).catch(() => {})
  const ts = Date.now()
  const imageUrls: string[] = []
  for (let i = 0; i < rendered.buffers.length; i++) {
    const path = `curations/${curationId}/${ts}-${String(i + 1).padStart(2, "0")}.png`
    const { error } = await supabase.storage.from(CARDNEWS_BUCKET).upload(path, rendered.buffers[i], { contentType: "image/png", upsert: true })
    if (error) throw new Error(`업로드 실패: ${error.message}`)
    const publicUrl = supabase.storage.from(CARDNEWS_BUCKET).getPublicUrl(path).data.publicUrl
    imageUrls.push(`https://images.weserv.nl/?url=${encodeURIComponent(publicUrl)}&output=jpg`)
  }

  const caption = rendered.caption || defaultCaption()
  const postId = await publishCarousel(imageUrls, caption)

  // Threads 교차 발행 (best-effort — 실패해도 인스타 발행은 유지)
  try {
    const tId = await publishThreadsCarousel(imageUrls, caption)
    if (tId) console.log("[threads] 큐레이션 발행 완료:", tId)
  } catch (e) {
    console.warn("[threads] 큐레이션 발행 실패:", e instanceof Error ? e.message : e)
  }

  await supabase.from("curations").update({ posted_at: new Date().toISOString(), ig_post_id: postId }).eq("id", curationId)
  return postId
}
