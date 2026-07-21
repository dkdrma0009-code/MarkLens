// Unsplash 검색 — 주제 키워드로 본문 삽입용 사진 1장 + 작가 크레딧 반환.
// UNSPLASH_ACCESS_KEY 없거나 결과 없으면 null → 이미지 없이 텍스트만으로 폴백.
// 서버사이드 전용 (키 클라이언트 노출 금지).

interface UnsplashResult {
  url: string         // urls.regular (고퀄, 이메일 적정 크기 — fm=jpg 포함)
  credit: string      // user.name
  creditLink: string  // user.links.html
}

// 후보 여러 장을 돌려주는 형태. 비전이 실제로 보고 고르려면 목록이 필요하다.
export interface UnsplashCandidate {
  url: string        // urls.regular — 렌더에 쓸 고해상도
  thumb: string      // urls.small  — 비전 판별용 (페이로드 절감)
  credit: string
  alt: string
}

interface UnsplashPhoto {
  urls?: { regular?: string; small?: string }
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

/** 후보 목록 반환 — 비전이 직접 보고 고르는 용도.
 *  키워드 필터(isTextFree)로 명백한 글자 사진만 1차로 쳐내고, 최종 판단은 비전에 맡긴다.
 *  alt_description 이 부실한 사진은 키워드로 못 걸러지기 때문이다. */
export async function searchUnsplashCandidates(
  query: string,
  limit = 5,
): Promise<UnsplashCandidate[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !query.trim()) return []
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait`,
      { headers: { Authorization: `Client-ID ${key}` } },
    )
    if (!res.ok) return []
    const results: UnsplashPhoto[] = (await res.json())?.results ?? []
    const ranked = [...results.filter(isTextFree), ...results.filter(p => !isTextFree(p))]
    return ranked
      .filter(p => p.urls?.regular && p.urls?.small)
      .slice(0, limit)
      .map(p => ({
        url: p.urls!.regular!,
        thumb: p.urls!.small!,
        credit: p.user?.name ?? "Unsplash",
        alt: p.alt_description ?? "",
      }))
  } catch {
    return []
  }
}

/** Unsplash 이용약관: 사진을 실제로 "사용"할 때 download_location 트리거 필수.
 *  후보를 여러 장 받아 하나만 쓰는 구조라, 선택된 뒤에 따로 호출해야 한다. */
export async function trackUnsplashUse(query: string, chosenUrl: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait`,
      { headers: { Authorization: `Client-ID ${key}` } },
    )
    if (!res.ok) return
    const results: UnsplashPhoto[] = (await res.json())?.results ?? []
    const hit = results.find(p => p.urls?.regular === chosenUrl)
    if (hit?.links?.download_location) {
      await fetch(hit.links.download_location, { headers: { Authorization: `Client-ID ${key}` } })
    }
  } catch { /* 통계 집계 실패는 무시 */ }
}
