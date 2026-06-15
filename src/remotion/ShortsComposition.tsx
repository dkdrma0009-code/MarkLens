import { useEffect, useState } from "react"
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  staticFile,
  delayRender,
  continueRender,
  type CalculateMetadataFunction,
} from "remotion"
// 상대경로 import — Remotion 자체 webpack은 tsconfig `@/` alias를 모르므로 (templates.tsx는 변경 없이 재사용)
import { renderShortScene, VTOKENS } from "../lib/shorts/templates"
import type { Slide } from "../lib/cardnews/types"

export const FPS = 30
const SLIDE_FRAMES = 90 // 3초
const CTA_FRAMES = 120 // 마지막 CTA 4초
const FADE = 8 // 슬라이드 경계 페이드(약 0.27초)

// type 별칭 — Remotion Composition 제네릭의 Record<string, unknown> 제약 충족 (interface는 불가)
export type ShortsProps = {
  slides: Slide[]
  category: string
  coverImage: string | null // data URI (표지 1장만)
}

export const defaultShortsProps: ShortsProps = { slides: [], category: "마케팅", coverImage: null }

function slideDuration(s: Slide): number {
  return s.type === "cta" ? CTA_FRAMES : SLIDE_FRAMES
}

// 슬라이드 수·종류에 따라 전체 길이 계산
export const calcShortsMetadata: CalculateMetadataFunction<ShortsProps> = ({ props }) => ({
  durationInFrames: Math.max(props.slides.reduce((a, s) => a + slideDuration(s), 0), 1),
})

// Pretendard @font-face (publicDir=assets → staticFile)
const FONT_CSS = `
@font-face{font-family:'Pretendard';font-style:normal;font-weight:400;src:url('${staticFile("fonts/Pretendard-Regular.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:600;src:url('${staticFile("fonts/Pretendard-SemiBold.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:700;src:url('${staticFile("fonts/Pretendard-Bold.otf")}') format('opentype');}
`

// 한 슬라이드 — 등장(fade-in + 살짝 위로) + 종료 fade-out → 슬라이드 간 크로스(딥) 전환
function SlideClip({ slide, category, coverImage, duration }: {
  slide: Slide; category: string; coverImage: string | null; duration: number
}) {
  const frame = useCurrentFrame()
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }
  const enter = interpolate(frame, [0, 15], [0, 1], clamp)
  const up = interpolate(frame, [0, 15], [24, 0], clamp)
  const exit = interpolate(frame, [duration - FADE, duration], [1, 0], clamp)
  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, exit), transform: `translateY(${up}px)` }}>
      {renderShortScene(slide, category, { coverImage })}
    </AbsoluteFill>
  )
}

export function ShortsComposition({ slides, category, coverImage }: ShortsProps) {
  // 폰트 로드 완료 후 렌더 (폴백 폰트 노출 방지)
  const [handle] = useState(() => delayRender("load-fonts"))
  useEffect(() => {
    Promise.all([
      document.fonts.load("400 100px Pretendard"),
      document.fonts.load("600 100px Pretendard"),
      document.fonts.load("700 100px Pretendard"),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle))
  }, [handle])

  const durations = slides.map(slideDuration)
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <AbsoluteFill style={{ backgroundColor: VTOKENS.BG }}>
      <style>{FONT_CSS}</style>
      {slides.map((slide, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durations[i]}>
          <SlideClip slide={slide} category={category} coverImage={i === 0 ? coverImage : null} duration={durations[i]} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
