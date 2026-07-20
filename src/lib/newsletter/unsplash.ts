// Unsplash 검색 — 주제 키워드로 본문 삽입용 사진 1장 + 작가 크레딧 반환.
// UNSPLASH_ACCESS_KEY 없거나 결과 없으면 null → 이미지 없이 텍스트만으로 폴백.
// 서버사이드 전용 (키 클라이언트 노출 금지).

interface UnsplashResult {
  url: string         // urls.regular (고퀄, 이메일 적정 크기 — fm=jpg 포함)
  credit: string      // user.name
  creditLink: string  // user.links.html
}

interface UnsplashPhoto {
  urls?: { regular?: string }
  user?: { name?: string; links?: { html?: string } }
  links?: { download_location?: string }
  alt_description?: string | null
  description?: string | null
  tags?: { title?: string }[]
}

// 사진 속 글자를 시사하는 단어들. alt_description·태그에 이게 있으면 자막이 겹친다.
const TEXT_HINTS = [
  "text", "sign", "signage", "quote", "word", "letter", "typography", "poster",
  "banner", "billboard", "sticky note", "post-it", "note", "notebook page",
  "whiteboard", "blackboard", "chalkboard", "book", "page", "magazine", "newspaper",
  "screen", "monitor", "laptop screen", "presentation", "slide", "chart", "graph",
  "diagram", "handwriting", "written", "writing", "label", "logo", "menu",
]

function isTextFree(p: UnsplashPhoto): boolean {
  const hay = [
    p.alt_description ?? "",
    p.description ?? "",
    ...(p.tags ?? []).map(t => t.title ?? ""),
  ].join(" ").toLowerCase()
  return !TEXT_HINTS.some(w => hay.includes(w))
}

// orientation 기본 landscape — 뉴스레터 본문용. 릴스(9:16)는 "portrait"로 호출한다.
// avoidText: 영상 자막이 얹히는 용도라 사진에 글자가 없어야 할 때 켠다.
export async function searchUnsplash(
  query: string,
  orientation: "landscape" | "portrait" = "landscape",
  avoidText = false,
): Promise<UnsplashResult | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !query.trim()) return null
  try {
    // 글자 사진을 걸러내려면 후보가 넉넉해야 한다. 뉴스레터(avoidText=false)는 3장이면 충분.
    const perPage = avoidText ? 12 : 3
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results: UnsplashPhoto[] = data?.results ?? []
    // 글자 박힌 사진 제외 — 그 위에 자막을 얹으면 둘 다 안 읽힌다.
    // 후보 중 통과하는 첫 장을 쓰고, 전부 걸리면 어쩔 수 없이 1순위로 폴백.
    const p = (avoidText ? results.find(isTextFree) ?? results[0] : results[0])
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
