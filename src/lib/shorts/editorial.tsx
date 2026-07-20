import { interpolate } from "remotion"
import type { Slide } from "@/lib/cardnews/types"

/* ── 에디토리얼 릴스 장면 ──
   DESIGN_PROMPT.md 의 디자인 시스템을 그대로 따른다.

   금지(문서 명시): 그라디언트, 화려한 색상(파랑·보라), 과도한 그림자, 스톡 이미지
   지향: 넉넉한 여백, 강한 타이포그래피로 계층 표현, 얇은 border 로 구분

   그래서 색은 흑백·뉴트럴 그레이만 쓰고 사진을 일절 쓰지 않는다. 계층은 오직
   글자 크기·굵기·여백으로만 만든다. 기존 릴스컷(검정 배경 + 인디고 액센트)과
   달리 흰 배경이라 어두운 릴스 피드에서 대비로 눈에 띈다. */

const C = {
  BG: "#FFFFFF",
  FG: "#0A0A0A",
  MUTED_FG: "#737373",
  BORDER: "#E5E5E5",
}

const W = 1080
const H = 1920
const PAD = 110

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

const CONTAINER: React.CSSProperties = {
  width: W, height: H, display: "flex", flexDirection: "column",
  background: C.BG, fontFamily: "Pretendard", position: "relative", overflow: "hidden",
  padding: PAD,
}

// 라벨 — uppercase + 넓은 자간. 한글은 uppercase가 무의미하므로 자간으로만 처리한다.
function label(text: string, frame: number) {
  return (
    <div key="label" style={{
      display: "flex", fontSize: 30, fontWeight: 600, color: C.MUTED_FG,
      letterSpacing: "0.08em", opacity: interpolate(frame, [0, 8], [0, 1], clamp),
    }}>
      {text}
    </div>
  )
}

// 얇은 구분선 — 섹션 분리용. 그림자 대신 이걸로 계층을 만든다.
function rule(frame: number, delay = 4) {
  return (
    <div key="rule" style={{
      display: "flex", width: interpolate(frame, [delay, delay + 14], [0, W - PAD * 2], clamp),
      height: 1, background: C.BORDER, marginTop: 26, marginBottom: 40,
    }} />
  )
}

function footer(showSite = false) {
  return (
    <div key="footer" style={{
      position: "absolute", bottom: PAD, left: PAD, width: W - PAD * 2,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: C.MUTED_FG, letterSpacing: "0.12em" }}>
        MARKLENS
      </div>
      {showSite && (
        <div style={{ display: "flex", fontSize: 26, color: C.MUTED_FG, letterSpacing: "0.02em" }}>
          marklens.site
        </div>
      )}
    </div>
  )
}

function shell(children: React.ReactNode[], showSite = false) {
  return (
    <div style={CONTAINER}>
      <div style={{
        display: "flex", flexDirection: "column", width: W - PAD * 2, flexGrow: 1, justifyContent: "center",
      }}>
        {children}
      </div>
      {footer(showSite)}
    </div>
  )
}

// 표지 — 타이포그래피가 전부. 줄마다 순차 등장하되 튀지 않게 페이드+미세 이동만.
function coverScene(s: Extract<Slide, { type: "cover" }>, category: string, frame: number) {
  const lines = s.headline.map((_, i) => {
    const t = i * 6
    return {
      op: interpolate(frame, [t, t + 12], [0, 1], clamp),
      y: interpolate(frame, [t, t + 12], [26, 0], clamp),
    }
  })
  const subDelay = s.headline.length * 6 + 8

  return shell([
    label(category, frame),
    rule(frame),
    <div key="head" style={{
      display: "flex", flexDirection: "column", fontSize: 112, fontWeight: 600,
      lineHeight: 1.18, letterSpacing: "-0.03em", color: C.FG,
    }}>
      {s.headline.map((line, i) => (
        <div key={i} style={{
          display: "flex", opacity: lines[i].op, transform: `translateY(${lines[i].y}px)`,
        }}>
          {line}
        </div>
      ))}
    </div>,
    s.sub ? (
      <div key="sub" style={{
        display: "flex", fontSize: 44, color: C.MUTED_FG, lineHeight: 1.6, marginTop: 40,
        opacity: interpolate(frame, [subDelay, subDelay + 12], [0, 1], clamp),
      }}>
        {s.sub}
      </div>
    ) : <div key="sub" style={{ display: "flex" }} />,
  ])
}

function bodyScene(labelText: string, headline: string | null, body: string, frame: number) {
  return shell([
    label(labelText, frame),
    rule(frame),
    headline ? (
      <div key="head" style={{
        display: "flex", fontSize: 82, fontWeight: 600, color: C.FG, lineHeight: 1.24,
        letterSpacing: "-0.025em", wordBreak: "keep-all", marginBottom: 36,
        opacity: interpolate(frame, [4, 16], [0, 1], clamp),
        transform: `translateY(${interpolate(frame, [4, 16], [24, 0], clamp)}px)`,
      }}>
        {headline}
      </div>
    ) : <div key="head" style={{ display: "flex" }} />,
    <div key="body" style={{
      display: "flex", fontSize: 54, color: headline ? C.MUTED_FG : C.FG, lineHeight: 1.7,
      letterSpacing: "-0.01em", wordBreak: "keep-all",
      opacity: interpolate(frame, [10, 22], [0, 1], clamp),
      transform: `translateY(${interpolate(frame, [10, 22], [18, 0], clamp)}px)`,
    }}>
      {body}
    </div>,
  ])
}

function ctaScene(s: Extract<Slide, { type: "cta" }>, frame: number) {
  return shell([
    <div key="head" style={{
      display: "flex", fontSize: 88, fontWeight: 600, color: C.FG, lineHeight: 1.22,
      letterSpacing: "-0.03em", wordBreak: "keep-all",
      opacity: interpolate(frame, [0, 14], [0, 1], clamp),
      transform: `translateY(${interpolate(frame, [0, 14], [26, 0], clamp)}px)`,
    }}>
      {s.headline}
    </div>,
    <div key="body" style={{
      display: "flex", fontSize: 48, color: C.MUTED_FG, lineHeight: 1.65, marginTop: 34,
      wordBreak: "keep-all", opacity: interpolate(frame, [12, 24], [0, 1], clamp),
    }}>
      {s.body}
    </div>,
  ], true)
}

export function renderEditorialScene(
  slide: Slide, category: string, frame: number,
): React.ReactElement {
  switch (slide.type) {
    case "cover":    return coverScene(slide, category, frame)
    case "fact":     return bodyScene(slide.label ?? "무슨 일?", null, slide.body, frame)
    case "why":      return bodyScene(slide.label ?? "왜 중요한가", slide.headline, slide.body, frame)
    case "apply":    return bodyScene(slide.label ?? "당장 해볼 수 있는 것", null, slide.body, frame)
    case "keywords": return bodyScene(
      slide.label ?? "이 뉴스 뒤에 깔린 흐름", null,
      slide.keywords.map(k => k.desc ? `${k.word} — ${k.desc}` : k.word).join("\n"),
      frame,
    )
    case "cta":      return ctaScene(slide, frame)
  }
}
