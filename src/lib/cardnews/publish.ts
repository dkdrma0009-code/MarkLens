import { createAdminClient } from "@/lib/supabase/admin"
import { renderCardnewsBuffers } from "./render-buffers"
import { publishCarousel } from "@/lib/instagram"
import { publishThreadsCarousel } from "@/lib/threads"
import { needsReview } from "./publish-state"

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

/* 채널별 발행 상태 (migration 023). 각 채널은 발행 전에 조건부 UPDATE 로 선점한다(state null/failed → publishing).
   - 플랫폼의 최종 publish 호출 "전" 실패 → failed (재시도 가능: 예약 크론·발행 버튼)
   - 최종 publish 호출 "중/후" 실패, 또는 게시는 됐는데 DB 기록 실패 → needs_review (자동 재발행 없음)
   - publishing 이 STALE_PUBLISHING_MS(publish-state.ts) 이상 지속 → 관리자 화면에서 확인 필요로 표시, resolveCardnewsPublish 로 복구
   Threads 는 Instagram 발행 성공 후에만 시도하고, 실패 시 재시도는 관리자 수동(retryThreadsPublish)만. */
export type PublishChannel = "instagram" | "threads"
export type PublishState = "publishing" | "published" | "failed" | "needs_review"
const COLUMNS = {
  instagram: { state: "ig_publish_state", claimed: "ig_publish_claimed_at", error: "ig_publish_error", postId: "ig_post_id", postedAt: "posted_at" },
  threads: { state: "threads_publish_state", claimed: "threads_publish_claimed_at", error: "threads_publish_error", postId: "threads_post_id", postedAt: "threads_posted_at" },
} as const
const LABEL: Record<PublishChannel, string> = { instagram: "Instagram", threads: "Threads" }
type Db = ReturnType<typeof createAdminClient>
type CardState = Record<string, string | null>

async function readCard(supabase: Db, articleId: string): Promise<CardState | null> {
  const { data, error } = await supabase.from("cardnews")
    .select("article_id, posted_at, publish_status, ig_publish_state, ig_publish_claimed_at, threads_publish_state, threads_publish_claimed_at, threads_posted_at")
    .eq("article_id", articleId).maybeSingle()
  if (error) throw new Error(`카드뉴스 상태 조회 실패: ${error.message}`)
  return data as CardState | null
}

// Current per-channel state, for the admin to show what a request actually left behind.
export async function readCardnewsPublishState(articleId: string): Promise<Record<string, unknown> | null> {
  const { data } = await createAdminClient().from("cardnews")
    .select("posted_at, ig_post_id, ig_publish_state, ig_publish_claimed_at, ig_publish_error, threads_publish_state, threads_publish_claimed_at, threads_publish_error, threads_post_id")
    .eq("article_id", articleId).maybeSingle()
  return data as Record<string, unknown> | null
}

// Why a claim was refused, in words the admin can act on.
function blockedReason(card: CardState | null, channel: PublishChannel): string {
  const c = COLUMNS[channel], label = LABEL[channel]
  if (!card) return "카드뉴스가 없습니다. 먼저 생성하세요."
  if (channel === "instagram" && card.publish_status === "skipped_stale") return `카드뉴스가 스킵 처리됨(${card.publish_status}) — 발행하지 않습니다.`
  if (channel === "threads" && !card.posted_at) return "Threads 는 Instagram 발행 후에만 발행합니다."
  const state = card[c.state]
  if (needsReview(state, card[c.claimed])) return `${label} 발행 확인 필요 상태입니다 — 관리자 화면에서 게시 여부를 확인한 뒤 처리하세요.`
  if (state === "publishing") return `${label} 발행이 이미 진행 중입니다.`
  if (state === "published" || (channel === "instagram" && card.posted_at)) return `이미 ${label} 에 발행된 카드뉴스입니다.`
  return `${label} 발행을 시작할 수 없는 상태입니다(${state}).`
}

// Atomic claim: one UPDATE whose WHERE holds only while nobody else has claimed or published this channel.
async function claim(supabase: Db, articleId: string, channel: PublishChannel, from: ("null" | "failed")[]) {
  const c = COLUMNS[channel]
  let query = supabase.from("cardnews")
    .update({ [c.state]: "publishing", [c.claimed]: new Date().toISOString(), [c.error]: null })
    .eq("article_id", articleId)
    .or(from.map(s => s === "null" ? `${c.state}.is.null` : `${c.state}.eq.${s}`).join(","))
  query = channel === "instagram"
    ? query.is("posted_at", null).or("publish_status.is.null,publish_status.neq.skipped_stale")
    : query.not("posted_at", "is", null)
  const { data, error } = await query.select("article_id")
  if (error) throw new Error(`${LABEL[channel]} 발행 선점 실패: ${error.message}`)
  if (!data?.length) throw new Error(blockedReason(await readCard(supabase, articleId), channel))
}

async function settle(supabase: Db, articleId: string, channel: PublishChannel, state: PublishState, values: Record<string, string | null> = {}) {
  const c = COLUMNS[channel]
  return supabase.from("cardnews").update({ [c.state]: state, ...values }).eq("article_id", articleId).eq(c.state, "publishing")
}

async function prepareImages(supabase: Db, articleId: string): Promise<{ imageUrls: string[]; caption: string }> {
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
  return { imageUrls, caption }
}

// One channel, already claimed: post, then record. Returns the platform post id (null: channel not configured).
async function postClaimed(supabase: Db, articleId: string, channel: PublishChannel, imageUrls: string[], caption: string): Promise<string | null> {
  const c = COLUMNS[channel], label = LABEL[channel]
  let sent = false
  let postId: string | null
  try {
    postId = channel === "instagram"
      ? await publishCarousel(imageUrls, caption, () => { sent = true })
      : await publishThreadsCarousel(imageUrls, caption, () => { sent = true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await settle(supabase, articleId, channel, sent ? "needs_review" : "failed", { [c.error]: (sent ? "게시 요청 중 오류 — 게시 여부 확인 필요: " : "") + message })
    throw new Error(sent ? `${label} 게시 요청 중 오류 — 게시됐을 수 있어 확인 필요 상태로 남겼습니다: ${message}` : message)
  }
  if (postId === null) {
    // Threads not configured: nothing was attempted, so the channel returns to "not published".
    await supabase.from("cardnews").update({ [c.state]: null, [c.claimed]: null }).eq("article_id", articleId).eq(c.state, "publishing")
    return null
  }
  const { error } = await settle(supabase, articleId, channel, "published", { [c.postId]: postId, [c.postedAt]: new Date().toISOString(), [c.error]: null })
  if (error) {
    // Posted but not recorded: never re-post automatically. The claim stays (publishing → stale → needs review) if
    // this write fails too.
    await settle(supabase, articleId, channel, "needs_review", { [c.error]: `게시됨(${postId}) — DB 기록 실패: ${error.message}` })
    throw new Error(`${label} 에 게시됐지만(${postId}) 기록하지 못했습니다 — 확인 필요 상태입니다.`)
  }
  return postId
}

// 카드뉴스 1건을 인스타 캐러셀로 발행 (버튼/cron 공용), 성공 후 Threads 교차 발행. 반환: IG 게시물 id
export async function publishCardnews(articleId: string): Promise<string> {
  const supabase = createAdminClient()
  await claim(supabase, articleId, "instagram", ["null", "failed"])
  let prepared: { imageUrls: string[]; caption: string }
  try {
    prepared = await prepareImages(supabase, articleId)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await settle(supabase, articleId, "instagram", "failed", { ig_publish_error: message })
    throw e
  }
  const postId = (await postClaimed(supabase, articleId, "instagram", prepared.imageUrls, prepared.caption)) as string

  // Threads 교차 발행 — Instagram 결과와 독립적으로 기록. 실패해도 인스타 발행은 유지(재시도는 관리자 수동).
  try {
    await claim(supabase, articleId, "threads", ["null"])
    const tId = await postClaimed(supabase, articleId, "threads", prepared.imageUrls, prepared.caption)
    if (tId) console.log("[threads] 발행 완료:", tId)
  } catch (e) {
    console.warn("[threads] 발행 실패:", e instanceof Error ? e.message : e)
  }
  return postId
}

// 관리자 수동: Instagram 발행 후 Threads 가 failed 인 카드뉴스만 다시 발행한다.
export async function retryThreadsPublish(articleId: string): Promise<string> {
  const supabase = createAdminClient()
  await claim(supabase, articleId, "threads", ["failed"])
  let prepared: { imageUrls: string[]; caption: string }
  try {
    prepared = await prepareImages(supabase, articleId)
  } catch (e) {
    await settle(supabase, articleId, "threads", "failed", { threads_publish_error: e instanceof Error ? e.message : String(e) })
    throw e
  }
  const tId = await postClaimed(supabase, articleId, "threads", prepared.imageUrls, prepared.caption)
  if (!tId) throw new Error("Threads 가 설정되지 않았습니다(THREADS_ACCESS_TOKEN / THREADS_USER_ID).")
  return tId
}

// 관리자 복구: 확인 필요(needs_review 또는 오래 멈춘 publishing) 채널을
//  - "published": 플랫폼에서 게시를 확인했고 그 post id 를 기록
//  - "release": 게시되지 않았음을 확인 → failed 로 되돌려 재시도 가능하게
export async function resolveCardnewsPublish(articleId: string, channel: PublishChannel, action: "published" | "release", postId?: string) {
  const supabase = createAdminClient(), c = COLUMNS[channel]
  const card = await readCard(supabase, articleId)
  if (!card || !needsReview(card[c.state], card[c.claimed])) throw new Error(`${LABEL[channel]} 은(는) 확인 필요 상태가 아닙니다.`)
  if (action === "published" && !postId?.trim()) throw new Error("게시물 id 가 필요합니다.")
  const values = action === "published"
    ? { [c.state]: "published", [c.postId]: postId!.trim(), [c.postedAt]: card[c.postedAt as keyof CardState] ?? new Date().toISOString(), [c.error]: null }
    : { [c.state]: "failed", [c.claimed]: null, [c.error]: "관리자 확인: 게시되지 않음 — 재시도 가능" }
  // Only the state that was just read may change (another admin or a late write wins otherwise).
  let query = supabase.from("cardnews").update(values).eq("article_id", articleId).eq(c.state, card[c.state] as string)
  if (card[c.state] === "publishing") query = query.eq(c.claimed, card[c.claimed] as string)
  const { data, error } = await query.select("article_id")
  if (error) throw new Error(`상태 기록 실패: ${error.message}`)
  if (!data?.length) throw new Error("상태가 그 사이 바뀌었습니다. 새로고침 후 다시 확인하세요.")
}
