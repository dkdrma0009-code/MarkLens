import { interpolate, spring } from "remotion"
import type { Slide } from "@/lib/cardnews/types"
import type { ReelPhoto } from "@/lib/shorts/reel-photos"
// Remotion 번들러(webpack)는 tsconfig의 @/ 별칭을 해석하지 못한다. 타입 임포트는
// 컴파일 시 지워져 무해하지만, 값 임포트는 반드시 상대경로여야 한다.
import { VTOKENS } from "./templates"

/* ── 풀블리드 릴스 장면 ──
   사진이 프레임을 꽉 채우고 텍스트가 그 위에 얹힌다. 기존 릴스컷(검정 배경 + 좌측
   정렬 텍스트)과 달리 빈 공간이 구조적으로 생기지 않는다.
   가독성은 사진 위 어둠 처리로만 확보한다 — 카드나 박스를 얹으면 풀블리드의 의미가 없다. */

const T = VTOKENS
const FPS = 30
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

const CONTAINER: React.CSSProperties = {
  width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column",
  background: T.BG, fontFamily: T.FONT, position: "relative", overflow: "hidden",
}

const PAD = 96

function quickSpring(frame: number, delay = 0) {
  return spring({ frame: frame - delay, fps: FPS, config: { damping: 20, stiffness: 220, mass: 0.7 } })
}

// 사진 위 텍스트 가독성 — 상하 어둠 + 전체 톤다운.
// 사진마다 밝기가 제각각이라 고정 오버레이로는 부족해서 3겹으로 눌러준다.
function scrim() {
  return [
    <div key="tone" style={{
      position: "absolute", inset: 0, display: "flex",
      background: "rgba(8,8,10,0.42)",
    }} />,
    <div key="top" style={{
      position: "absolute", top: 0, left: 0, width: T.WIDTH, height: 620, display: "flex",
      background: "linear-gradient(180deg, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0) 100%)",
    }} />,
    <div key="bottom" style={{
      position: "absolute", bottom: 0, left: 0, width: T.WIDTH, height: 1100, display: "flex",
      background: "linear-gradient(0deg, rgba(8,8,10,0.94) 12%, rgba(8,8,10,0.55) 55%, rgba(8,8,10,0) 100%)",
    }} />,
  ]
}

// 배경 사진. 켄번즈를 **사진에만** 건다 — 장면 전체에 걸면 가장자리에 붙은
// 크레딧·워드마크가 확대되며 화면 밖으로 잘려 나간다.
// 사진이 없으면 단색 — 검색 실패해도 렌더는 계속돼야 한다.
function background(kb: number, photo?: ReelPhoto) {
  if (!photo) {
    return <div key="bg" style={{
      position: "absolute", inset: 0, display: "flex",
      background: "linear-gradient(160deg, #16161c 0%, #0A0A0A 60%)",
    }} />
  }
  return <div key="bg" style={{
    position: "absolute", inset: 0, display: "flex", overflow: "hidden",
  }}>
    <div style={{
      width: "100%", height: "100%", display: "flex",
      backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center",
      transform: `scale(${kb})`,
    }} />
  </div>
}

// 작가 크레딧 — Unsplash API 가이드라인상 표기 필요. 눈에 거슬리지 않게 최소 크기로.
function credit(photo?: ReelPhoto) {
  if (!photo) return null
  return (
    <div key="credit" style={{
      position: "absolute", bottom: 28, right: PAD, display: "flex",
      fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: "0.02em",
    }}>
      {`Photo: ${photo.credit} / Unsplash`}
    </div>
  )
}

function wordmark() {
  return (
    <div key="wm" style={{
      position: "absolute", bottom: 28, left: PAD, display: "flex",
      fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.14em",
    }}>
      MARKLENS
    </div>
  )
}

function label(text: string, frame: number) {
  return (
    <div key="label" style={{
      display: "flex", fontSize: 40, fontWeight: 600, color: "#A5B4FC",
      letterSpacing: "0.08em", opacity: interpolate(frame, [0, 8], [0, 1], clamp),
    }}>
      {text}
    </div>
  )
}

// 본문 블록 — 하단 정렬. 사진의 주제가 위쪽에 오는 경우가 많아 아래를 텍스트에 내준다.
function shell(children: React.ReactNode[], kb: number, photo?: ReelPhoto) {
  return (
    <div style={CONTAINER}>
      {background(kb, photo)}
      {scrim()}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        justifyContent: "flex-end", padding: PAD, paddingBottom: 150,
      }}>
        {children}
      </div>
      {wordmark()}
      {credit(photo)}
    </div>
  )
}

function coverScene(s: Extract<Slide, { type: "cover" }>, category: string, frame: number, kb: number, photo?: ReelPhoto) {
  const lines = s.headline.map((_, i) => {
    const sp = quickSpring(frame, i * 7)
    return { op: sp, y: interpolate(sp, [0, 1], [52, 0], clamp) }
  })
  const subDelay = s.headline.length * 7 + 6
  const subOp = interpolate(frame, [subDelay, subDelay + 10], [0, 1], clamp)

  return shell([
    <div key="cat" style={{
      display: "flex", fontSize: 40, fontWeight: 600, color: "#A5B4FC",
      letterSpacing: "0.08em", marginBottom: 28, opacity: interpolate(frame, [0, 8], [0, 1], clamp),
    }}>
      {category}
    </div>,
    <div key="head" style={{
      display: "flex", flexDirection: "column", fontSize: 118, fontWeight: 700,
      lineHeight: 1.14, letterSpacing: "-0.03em", color: "#fff",
    }}>
      {s.headline.map((line, i) => {
        const hl = s.highlight && line.includes(s.highlight) ? s.highlight : null
        return (
          <div key={i} style={{ display: "flex", opacity: lines[i].op, transform: `translateY(${lines[i].y}px)` }}>
            {hl ? (
              <span>
                {line.slice(0, line.indexOf(hl))}
                <span style={{ color: "#818CF8" }}>{hl}</span>
                {line.slice(line.indexOf(hl) + hl.length)}
              </span>
            ) : line}
          </div>
        )
      })}
    </div>,
    s.sub ? (
      <div key="sub" style={{
        display: "flex", fontSize: 46, color: "rgba(255,255,255,0.72)", marginTop: 32, opacity: subOp,
      }}>
        {s.sub}
      </div>
    ) : <div key="sub" style={{ display: "flex" }} />,
  ], kb, photo)
}

// 본문형 장면 (fact·why·apply·keywords) — 라벨 + 헤드라인(있으면) + 본문.
// 헤드라인이 없는 apply도 라벨이 앵커 역할을 하도록 라벨을 키웠다.
function bodyScene(
  labelText: string, headline: string | null, body: string, frame: number, kb: number, photo?: ReelPhoto,
) {
  const sp = quickSpring(frame, 6)
  const bodyY = interpolate(sp, [0, 1], [30, 0], clamp)

  return shell([
    label(labelText, frame),
    headline ? (
      <div key="head" style={{
        display: "flex", fontSize: 84, fontWeight: 700, color: "#fff", lineHeight: 1.22,
        letterSpacing: "-0.025em", marginTop: 22, wordBreak: "keep-all",
        opacity: sp, transform: `translateY(${bodyY}px)`,
      }}>
        {headline}
      </div>
    ) : <div key="head" style={{ display: "flex" }} />,
    <div key="body" style={{
      display: "flex", fontSize: 60, color: "rgba(255,255,255,0.88)", lineHeight: 1.5,
      marginTop: headline ? 34 : 26, wordBreak: "keep-all",
      opacity: interpolate(frame, [10, 22], [0, 1], clamp),
      transform: `translateY(${interpolate(frame, [10, 22], [18, 0], clamp)}px)`,
    }}>
      {body}
    </div>,
  ], kb, photo)
}

function ctaScene(s: Extract<Slide, { type: "cta" }>, frame: number, kb: number, photo?: ReelPhoto) {
  const sp = quickSpring(frame, 0)
  return shell([
    <div key="head" style={{
      display: "flex", fontSize: 92, fontWeight: 700, color: "#fff", lineHeight: 1.2,
      letterSpacing: "-0.03em", wordBreak: "keep-all",
      opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [34, 0], clamp)}px)`,
    }}>
      {s.headline}
    </div>,
    <div key="body" style={{
      display: "flex", fontSize: 54, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginTop: 30,
      wordBreak: "keep-all", opacity: interpolate(frame, [12, 22], [0, 1], clamp),
    }}>
      {s.body}
    </div>,
    <div key="site" style={{
      display: "flex", fontSize: 46, fontWeight: 600, color: "#818CF8", marginTop: 46,
      opacity: interpolate(frame, [20, 30], [0, 1], clamp),
    }}>
      marklens.site
    </div>,
  ], kb, photo)
}

export function renderFullbleedScene(
  slide: Slide, category: string, frame: number, kb: number, photo?: ReelPhoto,
): React.ReactElement {
  switch (slide.type) {
    case "cover":    return coverScene(slide, category, frame, kb, photo)
    case "fact":     return bodyScene(slide.label ?? "무슨 일?", null, slide.body, frame, kb, photo)
    case "why":      return bodyScene(slide.label ?? "왜 중요한가", slide.headline, slide.body, frame, kb, photo)
    case "apply":    return bodyScene(slide.label ?? "당장 해볼 수 있는 것", null, slide.body, frame, kb, photo)
    case "keywords": return bodyScene(
      slide.label ?? "이 뉴스 뒤에 깔린 흐름", null,
      slide.keywords.map(k => k.desc ? `${k.word} — ${k.desc}` : k.word).join("\n"),
      frame, kb, photo,
    )
    case "cta":      return ctaScene(slide, frame, kb, photo)
  }
}
