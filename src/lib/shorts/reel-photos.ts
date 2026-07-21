import { searchUnsplash } from "@/lib/newsletter/unsplash"
import { generateText } from "@/lib/ai/llm"
import { planReelShots } from "@/lib/shorts/reel-vision"
import type { Slide } from "@/lib/cardnews/types"

// 풀블리드·시네마틱 릴스용 — 장면마다 배경 사진 1장.
// Unsplash 검색은 한글 질의가 거의 안 먹어서, 슬라이드 내용에서 영문 검색어를 먼저 뽑는다.

export type ReelPhoto = { url: string; credit: string }
export type ReelPhotos = Partial<Record<Slide["type"], ReelPhoto>>

// 비전이 함께 정해준 연출값. 조절 UI의 초기값으로 쓰인다(사람이 덮어쓸 수 있음).
export type ReelShotHints = Partial<Record<Slide["type"], {
  titlePos: "top" | "center" | "bottom"
  zoomFrom: number
  zoomTo: number
  reason: string
}>>

export const SLIDE_LABEL: Record<Slide["type"], string> = {
  cover: "표지(후킹)", fact: "무슨 일", why: "왜 중요한가",
  apply: "실전 적용", keywords: "키워드", cta: "구독 유도",
}

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
      // 뻔한 비유 사진은 \"그냥 스톡이네\" 하고 스크롤을 부른다
      "AVOID stock cliches: chess pieces, handshakes, lightbulbs, puzzle pieces, " +
      "dartboards, ladders, sunrises over mountains, rocket launches, gears, compasses, " +
      "and people pointing at charts. " +
      "Tie the query to the concrete situation the slide describes, not to an abstract " +
      "metaphor for it. " +
      "No prose, no explanation, JSON only.",
    prompt: `Category: ${category}\n\nSlides:\n${listing}`,
    maxTokens: 500,
  })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("검색어 JSON 파싱 실패")
  return JSON.parse(match[0]) as Record<string, string>
}

/**
 * 슬라이드별 배경 사진 + 연출 힌트를 해석한다.
 *
 * 비전이 후보를 직접 보고 고른다 — 키워드 필터만으로는 글자 박힌 사진이 뚫린다
 * (alt_description 이 부실한 사진이 많다). 자막 위치도 사진 구도마다 달라서 같이 정한다.
 * 비전이 실패하면 키워드 필터 경로로 폴백한다.
 *
 * ⚠️ 결과를 미리보기와 렌더가 **공유**해야 한다. 각자 호출하면 다른 사진이 나온다.
 */
export async function resolveReelPhotos(
  slides: Slide[], category: string, articleImage?: string | null,
): Promise<{ photos: ReelPhotos; hints: ReelShotHints }> {
  // 표지는 기사 본문 이미지를 쓴다 — 그 기사의 실제 사진이라 스톡보다 관련성이 높다.
  // 나머지 장면만 스톡에서 찾는다.
  const stockSlides = articleImage ? slides.filter(s => s.type !== "cover") : slides
  let queries: Record<string, string> = {}
  try {
    queries = await buildQueries(stockSlides, category)
  } catch (e) {
    console.warn("[reel-photos] 검색어 생성 실패 — 카테고리로 폴백:", e instanceof Error ? e.message : e)
  }

  const photos: ReelPhotos = {}
  const hints: ReelShotHints = {}

  try {
    const plans = await planReelShots(
      stockSlides, queries, s => SLIDE_LABEL[s.type], s => slideText(s), category,
    )
    for (const [type, p] of Object.entries(plans)) {
      if (!p) continue
      const t = type as Slide["type"]
      photos[t] = { url: p.url, credit: p.credit }
      hints[t] = {
        titlePos: p.titlePos,
        zoomFrom: p.zoomIn ? 1.05 : 1.14,
        zoomTo: p.zoomIn ? 1.14 : 1.04,
        reason: p.reason,
      }
    }
  } catch (e) {
    console.warn("[reel-photos] 비전 판단 실패 — 키워드 필터로 폴백:", e instanceof Error ? e.message : e)
  }

  if (articleImage) photos.cover = { url: articleImage, credit: "" }

  // 비전이 못 채운 장면만 기존 경로로 메운다
  await Promise.all(
    stockSlides.filter(s => !photos[s.type]).map(async s => {
      const q = queries[s.type]?.trim() || category
      const hit = await searchUnsplash(q, "portrait", true)
      if (hit) photos[s.type] = { url: hit.url, credit: hit.credit }
    }),
  )

  return { photos, hints }
}
