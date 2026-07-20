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
import { renderFullbleedScene } from "../lib/shorts/fullbleed"
import { renderEditorialScene } from "../lib/shorts/editorial"
import { renderCinematicScene } from "../lib/shorts/cinematic"
import { Bgm } from "./bgm"
import type { Slide } from "../lib/cardnews/types"
import type { ReelPhotos } from "../lib/shorts/reel-photos"

export const FPS = 30

const ENTER = 12         // 진입 (0.4s) — 전환 리듬은 검증된 값이라 고정
const EXIT = 10          // 퇴장 (0.33s)

// 어드민에서 조절 가능한 연출값. 기사별로 저장하며, 미지정 항목은 아래 기본값을 쓴다.
// ⚠️ Player 미리보기와 Lambda 렌더가 **같은 값**을 받아야 한다. 한쪽만 바뀌면
//    미리보기가 결과와 달라져 미리보기의 존재 의미가 없어진다.
export type ReelSettings = {
  slideTypes: Slide["type"][]  // 사용할 장면과 순서
  slideSeconds: number         // 일반 장면 길이(초)
  ctaSeconds: number           // CTA 장면 길이(초)
  kenBurns: number             // 켄번즈 드리프트 진폭 (0 = 끔)
  // text      — 검정 배경 + 좌측 정렬 (카드뉴스 씬 재사용, 표지만 사진)
  // editorial — DESIGN_PROMPT.md 디자인 시스템: 흰 배경, 흑백만, 사진 없음
  // fullbleed — 장면마다 Unsplash 사진이 화면을 채움
  // cinematic — make-cinematic-photo-reel 스킬의 룩: 필름 그레이딩·그레인·비네트·
  //             팬 포함 켄번즈·중앙 타이틀 카드·검정 페이드
  layout: "text" | "editorial" | "fullbleed" | "cinematic"
}

// 릴스는 시청 유지가 도달을 만든다. Shorts와 달리 정보 나열 장면(fact·keywords)을
// 빼고 후킹 → 의미 → 실전 → 구독 흐름만 남긴다. 읽어야 하는 장면은 카드뉴스가 맡는다.
// 켄번즈는 텍스트 장면이라 4~5%면 충분하고, 더 키우면 글자가 흔들려 읽기 어렵다.
export const DEFAULT_REEL_SETTINGS: ReelSettings = {
  slideTypes: ["cover", "why", "apply", "cta"],
  slideSeconds: 2.2,
  ctaSeconds: 3.0,
  kenBurns: 0.045,
  layout: "text",
}

export type ReelProps = {
  slides: Slide[]
  category: string
  coverImage: string | null // data URI 또는 URL (text 레이아웃의 표지 1장)
  settings?: Partial<ReelSettings>
  // fullbleed 레이아웃의 장면별 배경 사진. 미리보기와 렌더가 **같은 객체**를 써야
  // 한다 — 각자 Unsplash를 조회하면 다른 사진이 나온다.
  photos?: ReelPhotos
}

export const defaultReelProps: ReelProps = { slides: [], category: "마케팅", coverImage: null }

export function resolveSettings(s?: Partial<ReelSettings>): ReelSettings {
  return { ...DEFAULT_REEL_SETTINGS, ...s }
}

// slideTypes 순서대로 정렬한다 — 단순 filter는 원본 배열 순서를 따르므로
// 어드민에서 장면 순서를 바꿔도 반영되지 않는다.
export function pickReelSlides(slides: Slide[], settings?: Partial<ReelSettings>): Slide[] {
  const { slideTypes } = resolveSettings(settings)
  return slideTypes
    .map(t => slides.find(s => s.type === t))
    .filter((s): s is Slide => s !== undefined)
}

function slideDuration(s: Slide, cfg: ReelSettings): number {
  const sec = s.type === "cta" ? cfg.ctaSeconds : cfg.slideSeconds
  return Math.max(ENTER + EXIT + 1, Math.round(sec * FPS))
}

// 길이 계산은 여기 하나뿐이어야 한다. Player 미리보기도 이걸 쓴다 —
// 각자 계산하면 조절값에 따라 미리보기와 렌더 길이가 어긋난다.
export function calcReelDurationInFrames(slides: Slide[], settings?: Partial<ReelSettings>): number {
  const cfg = resolveSettings(settings)
  return Math.max(
    pickReelSlides(slides, settings).reduce((a, s) => a + slideDuration(s, cfg), 0),
    1,
  )
}

export const calcReelMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: calcReelDurationInFrames(props.slides, props.settings),
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
function kenBurnsScale(frame: number, duration: number, index: number, amount: number): number {
  if (amount <= 0) return 1
  const zoomIn = index % 2 === 0
  return interpolate(
    frame,
    [0, duration],
    zoomIn ? [1, 1 + amount] : [1 + amount, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  )
}

// 전환 전략은 Shorts와 동일(검증된 리듬). 차이는 위 켄번즈가 곱해진다는 것뿐.
function ReelClip({ slide, category, coverImage, duration, index, kenBurns, layout, photo, isFirst, isLast }: {
  slide: Slide; category: string; coverImage: string | null
  duration: number; index: number; kenBurns: number
  layout: ReelSettings["layout"]; photo?: ReelPhotos[Slide["type"]]
  isFirst: boolean; isLast: boolean
}) {
  const frame = useCurrentFrame()
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

  // enter [0,ENTER]·exit [duration-EXIT,duration] 창이 겹치면 translateY가 중복 적용됨
  if (duration <= ENTER + EXIT) throw new Error(`duration(${duration}) must be > ENTER+EXIT(${ENTER + EXIT})`)

  const kb = kenBurnsScale(frame, duration, index, kenBurns)
  // fullbleed는 켄번즈를 배경 사진에만 건다(장면 안에서 처리). 장면 전체를 확대하면
  // 가장자리에 붙은 크레딧·워드마크가 화면 밖으로 잘린다.
  const sceneKb = layout === "fullbleed" || layout === "cinematic" ? 1 : kb
  let style: React.CSSProperties

  // cinematic 은 켄번즈·타이틀 페이드·검정 페이드를 장면 안에서 모두 처리한다.
  // 바깥에서 전환을 또 걸면 이중으로 적용돼 원본 스킬의 리듬이 깨진다.
  if (layout === "cinematic") {
    return (
      <AbsoluteFill>
        {renderCinematicScene(slide, category, frame, duration, FPS, index, isFirst, isLast, photo)}
      </AbsoluteFill>
    )
  }

  if (slide.type === "cover") {
    const enterOp = interpolate(frame, [0, 8], [0, 1], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitX   = interpolate(frame, [duration - EXIT, duration], [0, -80], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      transform: `translateX(${exitX}px) scale(${sceneKb})`,
    }
  } else if (slide.type === "cta") {
    const sc = interpolate(frame, [0, ENTER + 3], [0.94, 1.0], clamp)
    const op = interpolate(frame, [0, ENTER], [0, 1], clamp)
    style = { opacity: op, transform: `scale(${sc * sceneKb})` }
  } else {
    const enterOp = interpolate(frame, [0, ENTER], [0, 1], clamp)
    const enterY  = interpolate(frame, [0, ENTER], [36, 0], clamp)
    const enterSc = interpolate(frame, [0, ENTER], [0.96, 1.0], clamp)
    const exitOp  = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
    const exitY   = interpolate(frame, [duration - EXIT, duration], [0, -20], clamp)
    style = {
      opacity: Math.min(enterOp, exitOp),
      // enter/exit는 상호 배타적 구간 — 더해도 한쪽만 0이 아님
      transform: `translateY(${enterY + exitY}px) scale(${enterSc * sceneKb})`,
    }
  }

  return (
    <AbsoluteFill style={style}>
      {/* 릴스는 넘길 장이 없으므로 페이지 표시를 끈다 (text 레이아웃 한정 —
          fullbleed는 애초에 페이지 표시가 없다) */}
      {layout === "fullbleed"
        ? renderFullbleedScene(slide, category, frame, kb, photo)
        : layout === "editorial"
          ? renderEditorialScene(slide, category, frame)
          : renderShortScene(slide, category, frame, duration, { coverImage, showPage: false })}
    </AbsoluteFill>
  )
}

export function ReelComposition({ slides, category, coverImage, settings, photos }: ReelProps) {
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

  const cfg = resolveSettings(settings)
  const reelSlides = pickReelSlides(slides, settings)
  const durations = reelSlides.map(s => slideDuration(s, cfg))
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0))
  // 바탕색은 레이아웃을 따라간다 — 장면이 opacity로 전환되는 동안 이 색이 비친다.
  // 흰 배경 에디토리얼에 검정 바탕을 두면 전환마다 검정으로 깜빡인다.
  return (
    <AbsoluteFill style={{ backgroundColor: cfg.layout === "editorial" ? "#FFFFFF" : VTOKENS.BG }}>
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
            kenBurns={cfg.kenBurns}
            layout={cfg.layout}
            photo={photos?.[slide.type]}
            isFirst={i === 0}
            isLast={i === reelSlides.length - 1}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
