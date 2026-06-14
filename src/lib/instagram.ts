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
