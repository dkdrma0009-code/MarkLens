// Threads 콘텐츠 발행 (Threads API) — THREADS_ACCESS_TOKEN, THREADS_USER_ID 필요
// 토큰은 app_config(DB) 우선, 없으면 env. 자동 갱신은 DB에 반영됨.
import { createAdminClient } from "@/lib/supabase/admin"

const GRAPH = "https://graph.threads.net/v1.0"

async function getThreadsToken(): Promise<string | null> {
  try {
    const sb = createAdminClient()
    const { data } = await sb.from("app_config").select("value").eq("key", "threads_access_token").single()
    if (data?.value) return data.value as string
  } catch { /* DB 없으면 env */ }
  return process.env.THREADS_ACCESS_TOKEN ?? null
}

async function creds(): Promise<{ token: string; userId: string } | null> {
  const token = await getThreadsToken()
  const userId = process.env.THREADS_USER_ID
  if (!token || !userId) return null
  return { token, userId }
}

// 장수명 토큰 갱신 → app_config에 저장 (cron에서 주기 호출). 반환: 남은 유효일
export async function refreshThreadsToken(): Promise<number> {
  const token = await getThreadsToken()
  if (!token) throw new Error("THREADS_ACCESS_TOKEN 미설정")
  const res = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`)
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown }
  if (!j.access_token) throw new Error(`Threads 토큰 갱신 실패: ${JSON.stringify(j.error ?? j)}`)
  const sb = createAdminClient()
  await sb.from("app_config").upsert({ key: "threads_access_token", value: j.access_token, updated_at: new Date().toISOString() })
  return Math.round((j.expires_in ?? 0) / 86400)
}

async function tPost(token: string, path: string, params: Record<string, string>): Promise<string> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token }),
  })
  const j = (await res.json()) as { id?: string; error?: unknown }
  if (!res.ok || !j.id) throw new Error(`Threads API 오류: ${JSON.stringify(j.error ?? j)}`)
  return j.id
}

async function status(token: string, id: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${id}?fields=status&access_token=${token}`)
  const j = (await res.json()) as { status?: string }
  return j.status ?? "ERROR"
}

// 헬스체크 — 실제 발행과 동일한 토큰 경로(creds)·엔드포인트로 부작용 없는 GET
export async function checkThreads(): Promise<{ ok: boolean; detail: string }> {
  const c = await creds()
  if (!c) return { ok: false, detail: "미설정 (THREADS_ACCESS_TOKEN/USER_ID)" }
  try {
    const res = await fetch(`${GRAPH}/${c.userId}?fields=username&access_token=${c.token}`)
    const j = (await res.json()) as { username?: string; error?: { message?: string } }
    if (!res.ok || !j.username) return { ok: false, detail: j.error?.message ?? "응답 오류" }
    return { ok: true, detail: `@${j.username}` }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

// 어드민 분석용 Threads 인사이트 — 계정 요약 + 게시물별 성과(조회·좋아요·답글·리포스트·인용)
export interface ThreadsMediaInsight {
  id: string; text: string; permalink: string; timestamp: string
  views: number; likes: number; replies: number; reposts: number; quotes: number
}
export interface ThreadsInsights {
  account: { username: string; followers: number }
  media: ThreadsMediaInsight[]
  totalViews: number
}

export async function getThreadsInsights(): Promise<ThreadsInsights | null> {
  const c = await creds()
  if (!c) return null
  try {
    const acc = await fetch(`${GRAPH}/${c.userId}?fields=username&access_token=${c.token}`).then(r => r.json())
    if (!acc?.username) return null

    let followers = 0
    try {
      const fi = await fetch(`${GRAPH}/${c.userId}/threads_insights?metric=followers_count&access_token=${c.token}`).then(r => r.json())
      followers = fi?.data?.[0]?.total_value?.value ?? 0
    } catch { /* 신규 계정 등 0 */ }

    const ml = await fetch(`${GRAPH}/${c.userId}/threads?fields=id,text,permalink,timestamp&limit=8&access_token=${c.token}`).then(r => r.json())
    const media: ThreadsMediaInsight[] = await Promise.all((ml?.data ?? []).map(async (m: { id: string; text?: string; permalink: string; timestamp: string }) => {
      const map: Record<string, number> = {}
      try {
        const ins = await fetch(`${GRAPH}/${m.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${c.token}`).then(r => r.json())
        for (const d of ins?.data ?? []) map[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0
      } catch { /* 인사이트 미지원 → 0 */ }
      const g = (n: string) => map[n] ?? 0
      return {
        id: m.id, text: (m.text ?? "").replace(/\s+/g, " ").slice(0, 60), permalink: m.permalink, timestamp: m.timestamp,
        views: g("views"), likes: g("likes"), replies: g("replies"), reposts: g("reposts"), quotes: g("quotes"),
      }
    }))

    return { account: { username: acc.username, followers }, media, totalViews: media.reduce((s, m) => s + m.views, 0) }
  } catch (e) {
    console.warn("[Threads insights]", e instanceof Error ? e.message : e)
    return null
  }
}

// 이미지 캐러셀 발행: 공개 이미지 URL 배열 + 텍스트 → 게시물 id (미설정 시 null)
export async function publishThreadsCarousel(imageUrls: string[], text: string): Promise<string | null> {
  const c = await creds()
  if (!c) return null
  const { token, userId } = c

  // 1) 각 이미지 → 캐러셀 아이템
  const childIds: string[] = []
  for (const url of imageUrls) {
    childIds.push(await tPost(token, `${userId}/threads`, { media_type: "IMAGE", image_url: url, is_carousel_item: "true" }))
  }

  // 2) 캐러셀 컨테이너 (Threads는 캡션 필드가 text)
  const carouselId = await tPost(token, `${userId}/threads`, { media_type: "CAROUSEL", children: childIds.join(","), text })

  // 3) 처리 대기
  for (let i = 0; i < 10; i++) {
    const s = await status(token, carouselId)
    if (s === "FINISHED") break
    if (s === "ERROR" || s === "EXPIRED") throw new Error(`Threads 처리 실패: ${s}`)
    await new Promise(r => setTimeout(r, 2000))
  }

  // 4) 발행
  return tPost(token, `${userId}/threads_publish`, { creation_id: carouselId })
}
