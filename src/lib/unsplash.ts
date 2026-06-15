// Unsplash 검색 — 뉴스레터 분위기 사진(주제 기사 이미지 폴백/병행용).
// UNSPLASH_ACCESS_KEY 없으면 null 반환 → 호출부에서 자연스럽게 건너뜀(키 없어도 동작).

interface UnsplashPhoto {
  url: string       // images.unsplash.com CDN URL (이메일에서 직접 핫링크)
  caption: string   // 라이선스 필수 출처표기 (HTML — 작가/Unsplash 링크 포함)
}

export async function searchUnsplash(query: string): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !query.trim()) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.results?.[0]
    if (!p?.urls?.regular) return null

    // Unsplash API 가이드라인: 사진 사용 시 download_location 트리거 (베스트에포트, 응답 대기 안 함)
    if (p.links?.download_location) {
      fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {})
    }

    const name = p.user?.name ?? "Unsplash"
    const utm = "utm_source=marklens&utm_medium=referral"
    const profile = p.user?.links?.html ? `${p.user.links.html}?${utm}` : `https://unsplash.com/?${utm}`
    const caption = `Photo: <a href="${profile}" style="color:#aaa;text-decoration:none;">${name}</a> / <a href="https://unsplash.com/?${utm}" style="color:#aaa;text-decoration:none;">Unsplash</a>`
    return { url: p.urls.regular, caption }
  } catch {
    return null
  }
}
