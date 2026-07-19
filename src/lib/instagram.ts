// Instagram 콘텐츠 발행 — Instagram API with Instagram Login (graph.instagram.com)
// 토큰은 app_config(DB) 우선, 없으면 env IG_ACCESS_TOKEN. 자동 갱신은 DB에 반영됨.
import { createAdminClient } from "@/lib/supabase/admin"

const GRAPH = "https://graph.instagram.com/v21.0"

// 토큰: 자동 갱신이 반영되는 DB(app_config) 우선, 폴백 env
async function getAccessToken(): Promise<string> {
  try {
    const sb = createAdminClient()
    const { data } = await sb.from("app_config").select("value").eq("key", "ig_access_token").single()
    if (data?.value) return data.value as string
  } catch { /* 테이블 없거나 비어있으면 env 사용 */ }
  const t = process.env.IG_ACCESS_TOKEN
  if (!t) throw new Error("IG_ACCESS_TOKEN 미설정")
  return t
}

function getUserId(): string {
  const u = process.env.IG_USER_ID
  if (!u) throw new Error("IG_USER_ID 미설정")
  return u
}

async function igPost(token: string, path: string, params: Record<string, string>): Promise<string> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token }),
  })
  const j = (await res.json()) as { id?: string; error?: unknown }
  if (!res.ok || !j.id) throw new Error(`Instagram API 오류: ${JSON.stringify(j.error ?? j)}`)
  return j.id
}

async function containerStatus(token: string, id: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${token}`)
  const j = (await res.json()) as { status_code?: string }
  return j.status_code ?? "ERROR"
}

// 캐러셀(여러 장) 발행: 공개 이미지 URL 배열 + 캡션 → 게시물 id
export async function publishCarousel(imageUrls: string[], caption: string): Promise<string> {
  const token = await getAccessToken()
  const userId = getUserId()

  // 1) 각 이미지 → 캐러셀 아이템 컨테이너
  const childIds: string[] = []
  for (const url of imageUrls) {
    childIds.push(await igPost(token, `${userId}/media`, { image_url: url, is_carousel_item: "true" }))
  }

  // 2) 캐러셀 컨테이너 (캡션 포함)
  const carouselId = await igPost(token, `${userId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  })

  // 3) 처리 완료 대기 (이미지는 보통 즉시 FINISHED)
  for (let i = 0; i < 10; i++) {
    const status = await containerStatus(token, carouselId)
    if (status === "FINISHED") break
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`캐러셀 처리 실패: ${status}`)
    await new Promise(r => setTimeout(r, 2000))
  }

  // 4) 발행
  return igPost(token, `${userId}/media_publish`, { creation_id: carouselId })
}

// 헬스체크 — 실제 발행과 동일한 토큰 경로(DB 우선)·엔드포인트(graph.instagram.com)로 부작용 없는 GET.
// 별도 검증 로직을 짜지 않고 실제 코드 경로를 그대로 타므로 오진이 구조적으로 불가능.
export async function checkInstagram(): Promise<{ ok: boolean; detail: string }> {
  try {
    const token = await getAccessToken()
    const userId = getUserId()
    const res = await fetch(`${GRAPH}/${userId}?fields=username&access_token=${token}`)
    const j = (await res.json()) as { username?: string; error?: { message?: string } }
    if (!res.ok || !j.username) return { ok: false, detail: j.error?.message ?? "응답 오류" }
    return { ok: true, detail: `@${j.username}` }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

// 어드민 분석용 인스타그램 인사이트 — 계정 요약 + 일별 도달 + 게시물별 성과.
// 실제 발행과 동일한 토큰 경로(DB 우선)·엔드포인트 사용.
export interface IgMediaInsight {
  id: string; caption: string; permalink: string; timestamp: string; mediaType: string
  reach: number; likes: number; saved: number; shares: number; comments: number
}
export interface IgInsights {
  account: { username: string; followers: number; mediaCount: number }
  dailyReach: { date: string; reach: number }[]
  media: IgMediaInsight[]
}

export async function getInstagramInsights(): Promise<IgInsights | null> {
  try {
    const token = await getAccessToken()
    const userId = getUserId()

    const acc = await fetch(`${GRAPH}/${userId}?fields=username,followers_count,media_count&access_token=${token}`).then(r => r.json())
    if (!acc?.username) return null

    const reachRes = await fetch(`${GRAPH}/${userId}/insights?metric=reach&period=day&access_token=${token}`).then(r => r.json())
    const dailyReach = (reachRes?.data?.[0]?.values ?? []).map((v: { end_time?: string; value: number }) => ({
      date: v.end_time?.slice(5, 10) ?? "", reach: v.value ?? 0,
    }))

    const mediaList = await fetch(`${GRAPH}/${userId}/media?fields=id,caption,media_type,timestamp,permalink&limit=8&access_token=${token}`).then(r => r.json())
    const media: IgMediaInsight[] = await Promise.all((mediaList?.data ?? []).map(async (m: { id: string; caption?: string; media_type: string; timestamp: string; permalink: string }) => {
      const map: Record<string, number> = {}
      try {
        const ins = await fetch(`${GRAPH}/${m.id}/insights?metric=reach,likes,saved,shares,comments&access_token=${token}`).then(r => r.json())
        for (const d of ins?.data ?? []) map[d.name] = d.values?.[0]?.value ?? 0
      } catch { /* 일부 미디어 타입은 인사이트 미지원 → 0 */ }
      const g = (n: string) => map[n] ?? 0
      return {
        id: m.id, caption: (m.caption ?? "").replace(/\s+/g, " ").slice(0, 60), permalink: m.permalink,
        timestamp: m.timestamp, mediaType: m.media_type,
        reach: g("reach"), likes: g("likes"), saved: g("saved"), shares: g("shares"), comments: g("comments"),
      }
    }))

    return {
      account: { username: acc.username, followers: acc.followers_count ?? 0, mediaCount: acc.media_count ?? 0 },
      dailyReach, media,
    }
  } catch (e) {
    console.warn("[IG insights]", e instanceof Error ? e.message : e)
    return null
  }
}

// 숏츠 릴스 발행: 공개 S3 URL → Instagram Reels 게시물 id
export async function publishReel(videoUrl: string, caption: string, coverUrl?: string): Promise<string> {
  const token = await getAccessToken()
  const userId = getUserId()

  // 1) 릴스 컨테이너 생성
  const reelsId = await igPost(token, `${userId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  })

  // 2) 처리 완료 대기 — FINISHED까지 폴링. 영상 트랜스코딩은 보통 30~90초, 길면 수 분.
  //    FINISHED에 도달 못 한 채 발행하면 2207027("not ready")이 나므로, 미도달 시 발행하지 않고 명확히 실패한다.
  let ready = false
  for (let i = 0; i < 48; i++) { // 48 × 5s = 240s (라우트 maxDuration 300s 내)
    await new Promise(r => setTimeout(r, 5000))
    const s = await containerStatus(token, reelsId)
    if (s === "FINISHED") { ready = true; break }
    if (s === "ERROR" || s === "EXPIRED") throw new Error(`릴스 처리 실패: ${s}`)
  }
  if (!ready) throw new Error("릴스 처리 시간 초과 — 잠시 후 다시 시도하세요")

  // 3) 발행 — FINISHED 직후에도 잠깐 2207027(not ready)이 날 수 있어 재시도
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 6000))
    try {
      return await igPost(token, `${userId}/media_publish`, { creation_id: reelsId })
    } catch (e) {
      lastErr = e
      if (!(e instanceof Error && e.message.includes("2207027"))) throw e
    }
  }
  throw lastErr
}

// 장수명 토큰 갱신 → app_config에 저장 (cron에서 주기 호출). 반환: 남은 유효일
export async function refreshIgToken(): Promise<number> {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH.replace("/v21.0", "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`)
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown }
  if (!j.access_token) throw new Error(`토큰 갱신 실패: ${JSON.stringify(j.error ?? j)}`)
  const sb = createAdminClient()
  await sb.from("app_config").upsert({ key: "ig_access_token", value: j.access_token, updated_at: new Date().toISOString() })
  return Math.round((j.expires_in ?? 0) / 86400)
}
