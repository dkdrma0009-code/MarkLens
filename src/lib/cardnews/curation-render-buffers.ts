import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderCurationSlide } from "./curation-templates"
import { renderTrendImageSlide } from "./curation-templates-image"
import {
  renderCurationCoverEditorial,
  renderTrendEditorialGrid,
  renderOutroEditorial,
  type EditorialCtx,
} from "./curation-templates-editorial"
import { fetchImageDataUri } from "./image"
import { loadFonts } from "./fonts"
import { TOKENS } from "./templates"
import stockPosters from "./stock-posters.json"
import type {
  CurationSlide, CurationTrendSlide, CurationIntroSlide, CurationOutroSlide,
} from "./curation-types"

/* 큐레이션 7장을 PNG 버퍼로 렌더 — cardnews 의 render-buffers.ts 와 별개.

   기본(editorial): 밝은 에디토리얼(lit_official_kr Hot 8 Chart 레퍼런스).
     - 표지: 크림 배경 + 트렌드 5개 목록 미리보기(번호·카테고리·제목·썸네일)
     - 트렌드: 좌 히어로 큰 이미지 + 우 스톡 3컷 그리드. 히어로=아티클 이미지,
       없으면 카테고리 스톡 폴백.
     - outro: 크림 톤 구독 유도 + 그 주 5썸네일.
   롤백(editorial:false): 기존 다크 템플릿(curation-templates 텍스트 / -image 풀블리드).
   다크 템플릿 파일 3종은 롤백용으로 그대로 둔다. */

// 인사이트 카테고리(한글) → 스톡 슬러그.
const CATEGORY_SLUG: Record<string, string> = {
  "브랜딩": "branding", "퍼포먼스 마케팅": "performance", "CRM": "crm", "콘텐츠 마케팅": "content",
  "SEO": "seo", "소셜 미디어": "social", "AI 마케팅": "ai", "소비자 심리": "psychology",
}
const POSTERS = stockPosters as Record<string, string[]>
const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, ".") : "")

function poolFor(category: string): string[] {
  const slug = CATEGORY_SLUG[category] ?? "default"
  return POSTERS[slug] ?? POSTERS["default"] ?? []
}

export interface CurationRender {
  buffers: Buffer[]
  caption: string | null
}

// ── 에디토리얼: 슬라이드 + 아티클 이미지 조회 → cover/trend/outro React 엘리먼트 ──
async function buildEditorialElements(
  slides: CurationSlide[], weekOf?: string | null,
): Promise<React.ReactElement[]> {
  const supabase = createAdminClient()
  const total = slides.length
  const weekDate = fmtDate(weekOf)
  const intro = slides.find((s): s is CurationIntroSlide => s.type === "intro")
  const outro = slides.find((s): s is CurationOutroSlide => s.type === "outro")
  const trends = slides.filter((s): s is CurationTrendSlide => s.type === "trend")

  // 트렌드 아티클 메타 일괄 조회
  const ids = trends.map((t) => t.item.articleId).filter((x): x is string => !!x)
  const artById = new Map<string, { image_url?: string; source_name?: string; published_at?: string }>()
  if (ids.length) {
    const { data } = await supabase
      .from("articles")
      .select("id, image_url, source_name, published_at")
      .in("id", ids)
    for (const a of data ?? []) artById.set(a.id, a)
  }

  // 트렌드별 히어로(아티클→스톡 폴백) + 그리드 3컷 로드
  const prepared = await Promise.all(trends.map(async (s) => {
    const it = s.item
    const pool = poolFor(it.category)
    const art = it.articleId ? artById.get(it.articleId) : undefined
    const hero =
      (await fetchImageDataUri(art?.image_url)) ??
      (await fetchImageDataUri(pool[0])) ??
      ""
    const gi = [1, 2, 3].map((j) => pool[(it.rank * 3 + j) % (pool.length || 1)])
    const grid = (await Promise.all(gi.map((g) => fetchImageDataUri(g)))).map((x, k) => x ?? gi[k] ?? hero)
    const ctx: EditorialCtx = {
      page: it.rank + 1,
      total,
      date: fmtDate(art?.published_at) || weekDate,
      source: art?.source_name || "MarkLens",
    }
    return { it, ctx, hero, grid: grid as string[] }
  }))

  const cover = renderCurationCoverEditorial({
    kicker: "이번 주 마케팅 트렌드",
    headline: intro?.headline ?? ["이번 주", "마케팅 트렌드"],
    highlight: intro?.highlight,
    date: weekDate,
    items: prepared.map((p) => ({ rank: p.it.rank, title: p.it.title, category: p.it.category, thumb: p.hero })),
  })
  const trendEls = prepared.map((p) => renderTrendEditorialGrid(p.it, p.ctx, { rep: p.hero, grid: p.grid }))
  const outroEl = renderOutroEditorial({
    headline: outro?.headline ?? "매주 이렇게 정리해요",
    body: outro?.body ?? "월요일마다 마크렌즈가 주목한 트렌드를 큐레이션합니다.",
    cta: outro?.cta ?? "프로필 링크 → 뉴스레터 구독",
    date: weekDate,
    thumbs: prepared.map((p) => p.hero),
  })

  return [cover, ...trendEls, outroEl]
}

// ── 다크(롤백): 트렌드 장 스톡 풀블리드 + intro/outro 텍스트 ──
async function buildDarkElements(slides: CurationSlide[]): Promise<React.ReactElement[]> {
  const total = slides.length
  return Promise.all(slides.map(async (slide, i) => {
    const page = i + 1
    if (slide.type === "trend") {
      const pool = poolFor(slide.item.category)
      const url = pool[(slide.item.rank - 1) % (pool.length || 1)]
      const dataUri = url ? await fetchImageDataUri(url) : null
      return dataUri
        ? renderTrendImageSlide(slide.item, page, total, dataUri)
        : renderCurationSlide(slide, page, total)
    }
    return renderCurationSlide(slide, page, total)
  }))
}

// slides + caption(+week_of) 로 렌더. editorial:false → 다크 롤백.
export async function renderCurationBuffers(
  curation: { slides: CurationSlide[]; caption?: string | null; week_of?: string | null },
  options: { editorial?: boolean } = {},
): Promise<CurationRender> {
  const editorial = options.editorial ?? true
  const fonts = await loadFonts()
  const slides = curation.slides

  const elements = editorial
    ? await buildEditorialElements(slides, curation.week_of)
    : await buildDarkElements(slides)

  const buffers = await Promise.all(
    elements.map(async (el) => {
      const ab = await new ImageResponse(el, {
        width: TOKENS.WIDTH, height: TOKENS.HEIGHT, fonts,
      }).arrayBuffer()
      return Buffer.from(ab)
    }),
  )

  return { buffers, caption: curation.caption ?? null }
}
