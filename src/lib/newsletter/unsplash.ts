// Unsplash 검색 — 주제 키워드로 본문 삽입용 사진 1장 + 작가 크레딧 반환.
// UNSPLASH_ACCESS_KEY 없거나 결과 없으면 null → 이미지 없이 텍스트만으로 폴백.
// 서버사이드 전용 (키 클라이언트 노출 금지).

interface UnsplashResult {
  url: string         // urls.regular (고퀄, 이메일 적정 크기 — fm=jpg 포함)
  credit: string      // user.name
  creditLink: string  // user.links.html
}

// orientation 기본 landscape — 뉴스레터 본문용. 릴스(9:16)는 "portrait"로 호출한다.
export async function searchUnsplash(
  query: string,
  orientation: "landscape" | "portrait" = "landscape",
): Promise<UnsplashResult | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !query.trim()) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=${orientation}`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.results?.[0]
    if (!p?.urls?.regular) return null

    // Unsplash 이용약관: 사진 "사용" 시 download_location 트리거 필수 (통계 집계). fire-and-forget.
    if (p.links?.download_location) {
      fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {})
    }

    return {
      url: p.urls.regular,
      credit: p.user?.name ?? "Unsplash",
      creditLink: p.user?.links?.html ?? "https://unsplash.com",
    }
  } catch {
    return null
  }
}
