import { searchUnsplashCandidates, trackUnsplashUse, type UnsplashCandidate } from "@/lib/newsletter/unsplash"
import { generateVision, generateText } from "@/lib/ai/llm"
import type { Slide } from "@/lib/cardnews/types"

/* 비전으로 장면별 사진과 연출을 정한다.

   키워드 필터(alt_description 검사)만으로는 글자 사진이 뚫린다 — 설명이 부실한
   사진이 많기 때문이다. 실제로 이미지를 보고 판단해야 한다.
   동시에 자막을 어디 둘지도 사진마다 다르므로 같이 결정한다. */

export type ShotPlan = {
  url: string
  credit: string
  titlePos: "top" | "center" | "bottom"
  zoomIn: boolean
  reason: string
}

const SYSTEM = `You choose stock photos to use as full-bleed backgrounds for a vertical
(9:16) Korean marketing reel. A Korean caption will be overlaid on top of the photo.

Reject a photo if ANY of these is true:
- It contains readable text, letters, numbers, logos, signage, handwriting, or a
  quote graphic. This is the most common failure — look carefully, including small
  text on screens, papers, notebooks, whiteboards, mugs, and clothing.
- The subject fills the entire frame leaving no calm area for a caption.
- It is a collage, screenshot, chart, or diagram.

Among the acceptable photos pick the one with the strongest, cleanest subject.
Then decide where the caption should sit so it does NOT cover the subject's face
or the main focal point:
  top    — subject is in the lower half
  center — subject is off to one side, middle band is calm
  bottom — subject is in the upper half
And decide the camera move: zoomIn=true to push into the subject, false to pull back.

Reply with ONLY this JSON, no prose:
{"index": <0-based index of chosen photo>, "titlePos": "top"|"center"|"bottom",
 "zoomIn": true|false, "allRejected": true|false, "reason": "<short Korean reason>"}
Always pick an index even when every photo fails — but set allRejected to true in
that case so the caller can search again with a different query.`

async function planOne(
  slideLabel: string, caption: string, cands: UnsplashCandidate[],
): Promise<{ plan: ShotPlan; allRejected: boolean } | null> {
  if (!cands.length) return null
  const raw = await generateVision({
    system: SYSTEM,
    prompt:
      `Scene: ${slideLabel}\n` +
      `Korean caption that will be overlaid: "${caption.slice(0, 120)}"\n` +
      `${cands.length} candidate photos follow, in order (index 0 first).`,
    imageUrls: cands.map(c => c.thumb),
  })
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`비전 응답 JSON 파싱 실패: ${raw.slice(0, 160)}`)
  const j = JSON.parse(m[0]) as {
    index?: number; titlePos?: string; zoomIn?: boolean; allRejected?: boolean; reason?: string
  }
  const idx = Number.isInteger(j.index) && j.index! >= 0 && j.index! < cands.length ? j.index! : 0
  const pos = j.titlePos === "top" || j.titlePos === "bottom" ? j.titlePos : "center"
  const c = cands[idx]
  return {
    plan: { url: c.url, credit: c.credit, titlePos: pos, zoomIn: j.zoomIn !== false, reason: j.reason ?? "" },
    allRejected: j.allRejected === true,
  }
}

/** 후보가 전부 부적합할 때 쓸 대체 검색어. 검색어 자체가 문제인 경우가 많다 —
 *  "person writing notes" 는 필기 사진만 부르므로 아무리 골라도 글자가 남는다. */
async function altQuery(
  badQuery: string, sceneLabel: string, caption: string, reason: string,
): Promise<string> {
  const raw = await generateText({
    system:
      "Give ONE alternative English Unsplash search query, 2-4 words, nothing else. " +
      "The previous query returned only photos containing readable text. " +
      "Find a different subject that avoids writing, screens, paper, and signage " +
      "BUT still fits the scene's meaning — a generic query like 'hands working' " +
      "returns off-topic photos (bakery, carpentry) and is worse than the original. " +
      "Stay in the world the caption describes (business, office, city, technology, people). " +
      "Reply with the query only — no quotes, no explanation.",
    prompt:
      `Scene: ${sceneLabel}\n` +
      `Korean caption (keep the photo relevant to this): "${caption.slice(0, 120)}"\n` +
      `Previous query: "${badQuery}"\nWhy it failed: ${reason}`,
    maxTokens: 50,
  })
  return raw.trim().replace(/^["']|["']$/g, "").split("\n")[0].slice(0, 60)
}

/** 장면별로 후보를 조회하고 비전에 판단을 맡긴다.
 *  한 장면이 실패해도 나머지는 진행한다 — 사진 없으면 단색 배경으로 폴백될 뿐이다. */
export async function planReelShots(
  slides: Slide[],
  queries: Record<string, string>,
  labelOf: (s: Slide) => string,
  captionOf: (s: Slide) => string,
  category: string,
): Promise<Partial<Record<Slide["type"], ShotPlan>>> {
  const out: Partial<Record<Slide["type"], ShotPlan>> = {}
  await Promise.all(
    slides.map(async s => {
      const label = labelOf(s)
      let q = queries[s.type]?.trim() || category
      try {
        let cands = await searchUnsplashCandidates(q, 5)
        let r = await planOne(label, captionOf(s), cands)

        // 재검증: 전부 부적합하면 검색어를 바꿔 한 번 더. 검색어가 원인인 경우가
        // 대부분이라(필기·화면·표지판을 부르는 단어) 같은 질의로 재시도해봐야 소용없다.
        if (r?.allRejected) {
          const q2 = await altQuery(q, label, captionOf(s), r.plan.reason)
          const c2 = await searchUnsplashCandidates(q2, 5)
          if (c2.length) {
            const r2 = await planOne(label, captionOf(s), c2)
            if (r2 && !r2.allRejected) {
              console.log(`[reel-vision] ${s.type} 재검색 성공: "${q}" → "${q2}"`)
              q = q2; cands = c2; r = r2
            }
          }
        }

        if (r) {
          out[s.type] = r.plan
          await trackUnsplashUse(q, r.plan.url)
        }
      } catch (e) {
        console.warn(`[reel-vision] ${s.type} 실패:`, e instanceof Error ? e.message : e)
      }
    }),
  )
  return out
}
