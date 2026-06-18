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
import { renderShortScene, VTOKENS } from "../lib/shorts/templates"
import type { Slide } from "../lib/cardnews/types"

export const FPS = 30
const SLIDE_FRAMES = 66  // 2.2s — 정지 구간 최소화
const CTA_FRAMES = 90    // 3s
const ENTER = 12         // body 슬라이드 공통 진입 (0.4s)
const EXIT = 10          // 공통 퇴장 (0.33s)

export type ShortsProps = {
  slides: Slide[]
  category: string
  coverImage: string | null // data URI (표지 1장만)
}

export const defaultShortsProps: ShortsProps = { slides: [], category: "마케팅", coverImage: null }

function slideDuration(s: Slide): number {
  return s.type === "cta" ? CTA_FRAMES : SLIDE_FRAMES
}

export const calcShortsMetadata: CalculateMetadataFunction<ShortsProps> = ({ props }) => ({
  durationInFrames: Math.max(props.slides.reduce((a, s) => a + slideDuration(s), 0), 1),
})

const FONT_CSS = `
@font-face{font-family:'Pretendard';font-style:normal;font-weight:400;src:url('${staticFile("fonts/Pretendard-Regular.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:600;src:url('${staticFile("fonts/Pretendard-SemiBold.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:700;src:url('${staticFile("fonts/Pretendard-Bold.otf")}') format('opentype');}
`

// 전환 전략:
//   cover    → 빠른 fade-in, 슬라이드-레프트 exit (후킹 모션 — 가장 강하게)
//   body ×4  → 통일된 translateY+scale 진입, fade-up 퇴장 (일관된 리듬)
//   cta      → scale+fade 진입, 퇴장 없음 (마무리)
function SlideClip({ slide, category, coverImage, duration }: {
  slide: Slide; category: string; coverImage: string | null; duration: number
}) {
  const frame = useCurrentFrame()
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

  // enter [0,ENTER]·exit [duration-EXIT,duration] 창이 겹치면 translateY가 중복 적용됨
  if (duration <= ENTER + EXIT) throw new Error(`duration(${duration}) must be > ENTER+EXIT(${ENTER + EXIT})`)

  let style: React.CSSProperties

  if (slide.type === "cover") {
    const enterOp = interpolate(frame, [0, 8], [0, 1], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitX   = interpolate(frame, [duration - EXIT, duration], [0, -80], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      transform: `translateX(${exitX}px)`,
    }
  } else if (slide.type === "cta") {
    const sc = interpolate(frame, [0, ENTER + 3], [0.94, 1.0], clamp)
    const op = interpolate(frame, [0, ENTER], [0, 1], clamp)
    style = { opacity: op, transform: `scale(${sc})` }
  } else {
    // body 슬라이드 4종 통일 전환
    const enterOp = interpolate(frame, [0, ENTER], [0, 1], clamp)
    const enterY  = interpolate(frame, [0, ENTER], [36, 0], clamp)
    const enterSc = interpolate(frame, [0, ENTER], [0.96, 1.0], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitY   = interpolate(frame, [duration - EXIT, duration], [0, -20], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      // enter/exit는 상호 배타적 구간 — 더해도 한쪽만 0이 아님
      transform: `translateY(${enterY + exitY}px) scale(${enterSc})`,
    }
  }

  return (
    <AbsoluteFill style={style}>
      {renderShortScene(slide, category, frame, duration, { coverImage })}
    </AbsoluteFill>
  )
}

export function ShortsComposition({ slides, category, coverImage }: ShortsProps) {
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
          <SlideClip
            slide={slide}
            category={category}
            coverImage={i === 0 ? coverImage : null}
            duration={durations[i]}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
