import { ImageResponse } from "next/og"
import { renderCurationSlide } from "./curation-templates"
import { loadFonts } from "./fonts"
import { TOKENS } from "./templates"
import type { CurationSlide } from "./curation-types"

/* 큐레이션 7장을 PNG 버퍼로 렌더 — cardnews 의 render-buffers.ts 와 별개.
   차이: article_id 로 DB 조회하는 대신 슬라이드를 직접 받는다. 표지 사진 로직 없음
   (큐레이션은 기사 이미지가 없다). 폰트·캔버스 크기(1080×1350)는 TOKENS 공유. */

export interface CurationRender {
  buffers: Buffer[]
  caption: string | null
}

// slides + caption 만 있으면 렌더 가능 — DB 행/전체 CurationCardnews 둘 다 넘길 수 있게 최소 shape.
export async function renderCurationBuffers(
  curation: { slides: CurationSlide[]; caption?: string | null },
): Promise<CurationRender> {
  const fonts = await loadFonts()
  const slides = curation.slides
  const total = slides.length

  const buffers = await Promise.all(
    slides.map(async (slide, i) => {
      const ab = await new ImageResponse(
        renderCurationSlide(slide, i + 1, total),
        { width: TOKENS.WIDTH, height: TOKENS.HEIGHT, fonts },
      ).arrayBuffer()
      return Buffer.from(ab)
    }),
  )

  return { buffers, caption: curation.caption ?? null }
}
