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
import { Bgm } from "./bgm"
import type { Slide } from "../lib/cardnews/types"

export const FPS = 30

// 릴스는 시청 유지가 도달을 만든다. Shorts와 달리 정보 나열 장면(fact·keywords)을
// 빼고 후킹 → 의미 → 실전 → 구독 흐름만 남긴다. 읽어야 하는 장면은 카드뉴스가 맡는다.
const REEL_SLIDE_TYPES: Slide["type"][] = ["cover", "why", "apply", "cta"]

const SLIDE_FRAMES = 66  // 2.2s
const CTA_FRAMES = 90    // 3s
const ENTER = 12         // 진입 (0.4s)
const EXIT = 10          // 퇴장 (0.33s)

// 켄번즈 드리프트 진폭. 사진이 아니라 텍스트 장면이라 4~5%면 충분하고,
// 더 키우면 글자가 흔들려 읽기 어려워진다.
const KB_AMOUNT = 0.045

export type ReelProps = {
  slides: Slide[]
  category: string
  coverImage: string | null // data URI (표지 1장만)
}

export const defaultReelProps: ReelProps = { slides: [], category: "마케팅", coverImage: null }

export function pickReelSlides(slides: Slide[]): Slide[] {
  return slides.filter(s => REEL_SLIDE_TYPES.includes(s.type))
}

function slideDuration(s: Slide): number {
  return s.type === "cta" ? CTA_FRAMES : SLIDE_FRAMES
}

export const calcReelMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: Math.max(
    pickReelSlides(props.slides).reduce((a, s) => a + slideDuration(s), 0),
    1,
  ),
})

const FONT_CSS = `
@font-face{font-family:'Pretendard';font-style:normal;font-weight:400;src:url('${staticFile("fonts/Pretendard-Regular.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:600;src:url('${staticFile("fonts/Pretendard-SemiBold.otf")}') format('opentype');}
@font-face{font-family:'Pretendard';font-style:normal;font-weight:700;src:url('${staticFile("fonts/Pretendard-Bold.otf")}') format('opentype');}
`

// 장면 전체 길이에 걸친 연속 줌. Shorts는 진입·퇴장에만 모션이 있어 그 사이 1.5초가
// 완전히 멈추는데, 릴스에서 정지 화면은 스크롤을 부른다. 여기서 그 구간을 메운다.
// 홀짝으로 인/아웃을 교차해 장면마다 방향이 바뀌게 한다.
// 배율은 항상 1.0 이상 — 1 미만이면 씬 컨테이너(overflow:hidden) 가장자리가 드러난다.
function kenBurnsScale(frame: number, duration: number, index: number): number {
  const zoomIn = index % 2 === 0
  return interpolate(
    frame,
    [0, duration],
    zoomIn ? [1, 1 + KB_AMOUNT] : [1 + KB_AMOUNT, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  )
}

// 전환 전략은 Shorts와 동일(검증된 리듬). 차이는 위 켄번즈가 곱해진다는 것뿐.
function ReelClip({ slide, category, coverImage, duration, index }: {
  slide: Slide; category: string; coverImage: string | null; duration: number; index: number
}) {
  const frame = useCurrentFrame()
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

  // enter [0,ENTER]·exit [duration-EXIT,duration] 창이 겹치면 translateY가 중복 적용됨
  if (duration <= ENTER + EXIT) throw new Error(`duration(${duration}) must be > ENTER+EXIT(${ENTER + EXIT})`)

  const kb = kenBurnsScale(frame, duration, index)
  let style: React.CSSProperties

  if (slide.type === "cover") {
    const enterOp = interpolate(frame, [0, 8], [0, 1], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitX   = interpolate(frame, [duration - EXIT, duration], [0, -80], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      transform: `translateX(${exitX}px) scale(${kb})`,
    }
  } else if (slide.type === "cta") {
    const sc = interpolate(frame, [0, ENTER + 3], [0.94, 1.0], clamp)
    const op = interpolate(frame, [0, ENTER], [0, 1], clamp)
    style = { opacity: op, transform: `scale(${sc * kb})` }
  } else {
    const enterOp = interpolate(frame, [0, ENTER], [0, 1], clamp)
    const enterY  = interpolate(frame, [0, ENTER], [36, 0], clamp)
    const enterSc = interpolate(frame, [0, ENTER], [0.96, 1.0], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitY   = interpolate(frame, [duration - EXIT, duration], [0, -20], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      // enter/exit는 상호 배타적 구간 — 더해도 한쪽만 0이 아님
      transform: `translateY(${enterY + exitY}px) scale(${enterSc * kb})`,
    }
  }

  return (
    <AbsoluteFill style={style}>
      {/* 릴스는 넘길 장이 없으므로 페이지 표시를 끈다 */}
      {renderShortScene(slide, category, frame, duration, { coverImage, showPage: false })}
    </AbsoluteFill>
  )
}

export function ReelComposition({ slides, category, coverImage }: ReelProps) {
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

  const reelSlides = pickReelSlides(slides)
  const durations = reelSlides.map(slideDuration)
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <AbsoluteFill style={{ backgroundColor: VTOKENS.BG }}>
      <style>{FONT_CSS}</style>
      <Bgm />
      {reelSlides.map((slide, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durations[i]}>
          <ReelClip
            slide={slide}
            category={category}
            coverImage={slide.type === "cover" ? coverImage : null}
            duration={durations[i]}
            index={i}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
