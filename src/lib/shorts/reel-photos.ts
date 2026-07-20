import { searchUnsplash } from "@/lib/newsletter/unsplash"
import { generateText } from "@/lib/ai/llm"
import type { Slide } from "@/lib/cardnews/types"

// 풀블리드 릴스용 — 장면마다 배경 사진 1장.
// Unsplash 검색은 한글 질의가 거의 안 먹어서, 슬라이드 내용에서 영문 검색어를 먼저 뽑는다.

export type ReelPhoto = { url: string; credit: string }
export type ReelPhotos = Partial<Record<Slide["type"], ReelPhoto>>

function slideText(s: Slide): string {
  switch (s.type) {
    case "cover":    return [s.headline.join(" "), s.sub].filter(Boolean).join(" ")
    case "fact":     return s.body
    case "why":      return `${s.headline} ${s.body}`
    case "apply":    return s.body
    case "keywords": return s.keywords.map(k => `${k.word} ${k.desc ?? ""}`).join(" ")
    case "cta":      return `${s.headline} ${s.body}`
  }
}

// 장면별 영문 검색어를 한 번의 호출로 받는다 (장면마다 호출하면 느리고 비싸다).
async function buildQueries(slides: Slide[], category: string): Promise<Record<string, string>> {
  const listing = slides.map(s => `${s.type}: ${slideText(s).slice(0, 160)}`).join("\n")
  const raw = await generateText({
    system:
      "You turn Korean marketing-content slides into English Unsplash search queries. " +
      "Return ONLY a JSON object mapping each slide type to a 2-4 word English query. " +
      "Prefer concrete, photographable subjects (people working, city, meeting, hands, office) over " +
      "abstract nouns (strategy, growth, insight) — abstract words return generic stock clichés. " +
      // 사진에 글자가 박혀 있으면 그 위에 한글 타이틀이 얹혀 둘 다 안 읽힌다.
      "CRITICAL: the photo must contain no readable text. Never use words that return " +
      "whiteboards, sticky notes, signage, posters, quotes, book pages, diagrams, charts, " +
      "slides, screens showing text, or handwriting. Prefer people, hands, places, objects, " +
      "textures, and out-of-focus backgrounds. " +
      "No prose, no explanation, JSON only.",
    prompt: `Category: ${category}\n\nSlides:\n${listing}`,
    maxTokens: 500,
  })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("검색어 JSON 파싱 실패")
  return JSON.parse(match[0]) as Record<string, string>
}

/**
 * 슬라이드별 배경 사진을 해석한다.
 * 실패해도 던지지 않는다 — 사진이 없으면 풀블리드가 단색 배경으로 폴백될 뿐이다.
 *
 * ⚠️ 결과를 미리보기와 렌더가 **공유**해야 한다. 각자 호출하면 Unsplash가 다른 사진을
 *    돌려줄 수 있어 미리보기와 결과물이 달라진다.
 */
export async function resolveReelPhotos(slides: Slide[], category: string): Promise<ReelPhotos> {
  let queries: Record<string, string> = {}
  try {
    queries = await buildQueries(slides, category)
  } catch (e) {
    console.warn("[reel-photos] 검색어 생성 실패 — 카테고리로 폴백:", e instanceof Error ? e.message : e)
  }

  const photos: ReelPhotos = {}
  await Promise.all(
    slides.map(async s => {
      const q = queries[s.type]?.trim() || category
      const hit = await searchUnsplash(q, "portrait", true)
      if (hit) photos[s.type] = { url: hit.url, credit: hit.credit }
    }),
  )
  return photos
}
