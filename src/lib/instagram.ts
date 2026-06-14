// Instagram 콘텐츠 발행 (Graph API) — IG_ACCESS_TOKEN(장수명), IG_USER_ID(인스타 비즈니스 계정 ID) 필요
const GRAPH = "https://graph.facebook.com/v21.0"

function creds(): { token: string; userId: string } {
  const token = process.env.IG_ACCESS_TOKEN
  const userId = process.env.IG_USER_ID
  if (!token || !userId) throw new Error("IG_ACCESS_TOKEN / IG_USER_ID 미설정")
  return { token, userId }
}

async function igPost(path: string, params: Record<string, string>): Promise<{ id: string }> {
  const { token } = creds()
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: token }),
  })
  const j = (await res.json()) as { id?: string; error?: unknown }
  if (!res.ok || !j.id) throw new Error(`Instagram API 오류: ${JSON.stringify(j.error ?? j)}`)
  return { id: j.id }
}

async function containerStatus(id: string): Promise<string> {
  const { token } = creds()
  const res = await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${token}`)
  const j = (await res.json()) as { status_code?: string }
  return j.status_code ?? "ERROR"
}

// 캐러셀(여러 장) 발행: 공개 이미지 URL 배열 + 캡션 → 게시물 id
export async function publishCarousel(imageUrls: string[], caption: string): Promise<string> {
  const { userId } = creds()

  // 1) 각 이미지 → 캐러셀 아이템 컨테이너
  const childIds: string[] = []
  for (const url of imageUrls) {
    const r = await igPost(`${userId}/media`, { image_url: url, is_carousel_item: "true" })
    childIds.push(r.id)
  }

  // 2) 캐러셀 컨테이너 (캡션 포함)
  const carousel = await igPost(`${userId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  })

  // 3) 컨테이너가 준비될 때까지 잠깐 대기 (이미지는 보통 즉시 FINISHED)
  for (let i = 0; i < 10; i++) {
    const status = await containerStatus(carousel.id)
    if (status === "FINISHED") break
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`캐러셀 처리 실패: ${status}`)
    await new Promise(r => setTimeout(r, 2000))
  }

  // 4) 발행
  const published = await igPost(`${userId}/media_publish`, { creation_id: carousel.id })
  return published.id
}
