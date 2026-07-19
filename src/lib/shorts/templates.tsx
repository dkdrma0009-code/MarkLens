import { interpolate, spring } from "remotion"
import type { Slide, CoverSlide, FactSlide, WhySlide, ApplySlide, KeywordsSlide, CtaSlide } from "@/lib/cardnews/types"

/* ── 숏츠(9:16) 디자인 토큰 — 카드뉴스와 색은 공유, 치수만 세로용 ── */
export const VTOKENS = {
  BG: "#0A0A0A",
  TEXT: "#FFFFFF",
  BODY: "#EDEDED",
  SUB: "#A1A1A1",
  ACCENT: "#6366F1",
  PADDING: 110,
  WIDTH: 1080,
  HEIGHT: 1920,
  FONT: "Pretendard",
}

const T = VTOKENS
const FPS = 30
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }

// 모든 장면 공용 루트 컨테이너 스타일 — 디자인 토큰 변경이 전 장면에 자동 반영됨
const CONTAINER_STYLE: React.CSSProperties = {
  width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column",
  background: T.BG, padding: T.PADDING, fontFamily: T.FONT, position: "relative", overflow: "hidden",
}

// 단방향 보간 (clamp 기본)
function lerp(f: number, from: [number, number], to: [number, number]) {
  return interpolate(f, from, to, clamp)
}

// 빠르고 절제된 스프링 (0→1)
function quickSpring(f: number, delay = 0) {
  return spring({ frame: f - delay, fps: FPS, config: { damping: 20, stiffness: 220, mass: 0.7 } })
}

// 라벨 등장 fade — 4개 body 장면에서 동일. 타이밍 조정은 여기만 수정.
function labelFadeOp(frame: number) {
  return lerp(frame, [0, 8], [0, 1])
}

// 하단 푸터
// showPage=false는 릴스용 — 자동재생 영상에는 넘길 장이 없어 페이지 표시가 의미 없고,
// 릴스는 슬라이드를 골라 쓰므로 카드뉴스 기준 번호(n/6)가 맞지도 않는다.
function footer(page: number, total: number, showPage = true) {
  return (
    <div key="footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: T.SUB, letterSpacing: "0.12em" }}>MARKLENS</div>
      {showPage && <div style={{ display: "flex", fontSize: 38, color: T.SUB }}>{`${page} / ${total}`}</div>}
    </div>
  )
}

// 다크 배경 위 ambient glow — 항상 미세하게 움직여 정지 배경 방지
function ambientOrb(frame: number, duration: number) {
  const orbY = lerp(frame, [0, duration], [0, -80])
  const orbScale = lerp(frame, [0, duration], [1.0, 1.12])
  return (
    <div key="orb" style={{
      position: "absolute",
      top: 600 + orbY,
      left: -180,
      width: 1200,
      height: 1200,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)",
      filter: "blur(80px)",
      transform: `scale(${orbScale})`,
      transformOrigin: "center center",
      display: "flex",
    }} />
  )
}

// 세로 프레임 래퍼 (ambient orb 포함)
function wrap(frame: number, duration: number, children: React.ReactNode[]) {
  return (
    <div style={CONTAINER_STYLE}>
      {ambientOrb(frame, duration)}
      {children}
    </div>
  )
}

// highlight 단어만 ACCENT 색으로
function highlightLine(line: string, highlight: string | undefined, key: number, extraStyle?: React.CSSProperties) {
  const base: React.CSSProperties = { display: "flex", color: T.TEXT, ...extraStyle }
  if (!highlight || !line.includes(highlight)) {
    return <div key={key} style={base}>{line}</div>
  }
  const idx = line.indexOf(highlight)
  return (
    <div key={key} style={base}>
      <span>
        {line.slice(0, idx)}
        <span style={{ color: T.ACCENT }}>{highlight}</span>
        {line.slice(idx + highlight.length)}
      </span>
    </div>
  )
}

/* ── 6종 장면 ── */

function coverScene(s: CoverSlide, category: string, frame: number, duration: number, coverImage?: string | null, showPage = true) {
  // 카테고리 라벨 fade-in
  const catOp = lerp(frame, [0, 8], [0, 1])

  // 헤드라인 각 줄 스프링 스태거 (0.4s 안에 완료)
  const lineProps = s.headline.map((_, i) => {
    const sp = quickSpring(frame, i * 8)
    return { op: sp, y: lerp(sp, [0, 1], [40, 0]) }
  })

  // sub 텍스트: 헤드라인 완료 후 등장
  const subDelay = s.headline.length * 8 + 4
  const subOp = lerp(frame, [subDelay, subDelay + 10], [0, 1])
  const subY = lerp(frame, [subDelay, subDelay + 10], [16, 0])

  if (coverImage) {
    // Ken Burns — 배경 이미지 서서히 줌
    const kbScale = lerp(frame, [0, duration], [1.0, 1.07])
    const BAND = 980
    return (
      <div style={CONTAINER_STYLE}>
        {/* Ken Burns 배경 이미지.
            줌은 BAND 높이 창(overflow:hidden) 안에서만 일어나야 한다. 창 없이 이미지에
            직접 scale을 걸면 하단 경계가 BAND 아래로 밀려나(980→1048) 고정 위치인
            아래 그라디언트를 벗어나고, 페이드 없이 잘린 사진 끝이 그대로 드러난다. */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: T.WIDTH, height: BAND,
          display: "flex", overflow: "hidden",
        }}>
          <div style={{
            width: "100%", height: "100%", display: "flex",
            backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center",
            transform: `scale(${kbScale})`, transformOrigin: "center top",
          }} />
        </div>
        <div style={{
          position: "absolute", top: BAND - 380, left: 0, width: T.WIDTH, height: 380, display: "flex",
          background: "linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 55%, rgba(10,10,10,1) 100%)",
        }} />
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", width: "100%", marginBottom: 64 }}>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", marginBottom: 32, opacity: catOp }}>{category}</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 116, fontWeight: 700, lineHeight: 1.16, letterSpacing: "-0.02em" }}>
            {s.headline.map((line, i) => highlightLine(line, s.highlight, i, {
              opacity: lineProps[i].op,
              transform: `translateY(${lineProps[i].y}px)`,
            }))}
          </div>
          {s.sub ? <div style={{ display: "flex", fontSize: 46, color: "#C9C9C9", marginTop: 40, opacity: subOp, transform: `translateY(${subY}px)` }}>{s.sub}</div> : null}
        </div>
        {footer(1, 6, showPage)}
      </div>
    )
  }

  // 이미지 없는 표지 — ambient orb 배경
  return (
    <div style={CONTAINER_STYLE}>
      {ambientOrb(frame, duration)}
      <div style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", opacity: catOp }}>{category}</div>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 124, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          {s.headline.map((line, i) => highlightLine(line, s.highlight, i, {
            opacity: lineProps[i].op,
            transform: `translateY(${lineProps[i].y}px)`,
          }))}
        </div>
        {s.sub ? <div style={{ display: "flex", fontSize: 48, color: T.SUB, marginTop: 48, opacity: subOp, transform: `translateY(${subY}px)` }}>{s.sub}</div> : null}
      </div>
      {footer(1, 6, showPage)}
    </div>
  )
}

function factScene(s: FactSlide, frame: number, duration: number, showPage = true) {
  // 라벨 → 본문 → 출처 순서로 등장
  const labelOp = labelFadeOp(frame)
  const bodyOp  = lerp(frame, [8, 18], [0, 1])
  const bodyY   = lerp(frame, [8, 18], [20, 0])
  const srcOp   = lerp(frame, [16, 24], [0, 1])

  return wrap(frame, duration, [
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", opacity: labelOp }}>
      {s.label ?? "무슨 일?"}
    </div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 64, color: T.TEXT, lineHeight: 1.5, letterSpacing: "-0.01em", wordBreak: "keep-all", opacity: bodyOp, transform: `translateY(${bodyY}px)` }}>
        {s.body}
      </div>
      {s.source
        ? <div style={{ display: "flex", fontSize: 38, color: T.SUB, marginTop: 64, opacity: srcOp }}>출처 · {s.source}</div>
        : null}
    </div>,
    footer(2, 6, showPage),
  ])
}

function whyScene(s: WhySlide, frame: number, duration: number, showPage = true) {
  const labelOp = labelFadeOp(frame)

  // 헤드라인 단어 단위 스프링 스태거
  const words = s.headline.split(" ").filter(Boolean)
  const wordProps = words.map((_, i) => {
    const sp = quickSpring(frame, 6 + i * 5)
    return { op: sp, y: lerp(sp, [0, 1], [24, 0]) }
  })

  // 본문: 헤드라인 완료 후 등장 (고정 타이밍)
  const bodyOp = lerp(frame, [18, 28], [0, 1])
  const bodyY  = lerp(frame, [18, 28], [16, 0])

  return wrap(frame, duration, [
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", opacity: labelOp }}>
      {s.label ?? "왜 중요한가"}
    </div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 10px", fontSize: 88, fontWeight: 700, color: T.TEXT, lineHeight: 1.28, letterSpacing: "-0.02em" }}>
        {words.map((w, i) => (
          <span key={i} style={{ display: "inline-flex", opacity: wordProps[i].op, transform: `translateY(${wordProps[i].y}px)` }}>
            {w}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 56, color: T.BODY, lineHeight: 1.55, marginTop: 56, wordBreak: "keep-all", opacity: bodyOp, transform: `translateY(${bodyY}px)` }}>
        {s.body}
      </div>
    </div>,
    footer(3, 6, showPage),
  ])
}

function applyScene(s: ApplySlide, frame: number, duration: number, showPage = true) {
  const labelOp = labelFadeOp(frame)
  // 실천 포인트 — 스프링 스케일인으로 강조
  const sp     = quickSpring(frame, 8)
  const bodyOp = sp
  const bodySc = lerp(sp, [0, 1], [0.93, 1.0])

  return wrap(frame, duration, [
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", opacity: labelOp }}>
      {s.label ?? "당장 해볼 수 있는 것"}
    </div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 64, color: T.BODY, lineHeight: 1.55, letterSpacing: "-0.01em", wordBreak: "keep-all", opacity: bodyOp, transform: `scale(${bodySc})`, transformOrigin: "left center" }}>
        {s.body}
      </div>
    </div>,
    footer(4, 6, showPage),
  ])
}

function keywordsScene(s: KeywordsSlide, frame: number, duration: number, showPage = true) {
  const labelOp = labelFadeOp(frame)

  return wrap(frame, duration, [
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", opacity: labelOp }}>
      {s.label ?? "핵심 포인트"}
    </div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center", gap: 80 }}>
      {s.keywords.map((k, i) => {
        // 각 키워드 row: 좌측에서 슬라이드인 스태거
        const rowSp = quickSpring(frame, 6 + i * 10)
        const rowOp = rowSp
        const rowX  = lerp(rowSp, [0, 1], [40, 0])
        // 단어 자체: scale 스프링 강조
        const wordSc = lerp(rowSp, [0, 1], [0.85, 1.0])
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", opacity: rowOp, transform: `translateX(${rowX}px)` }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: T.TEXT, letterSpacing: "-0.01em", transform: `scale(${wordSc})`, transformOrigin: "left center" }}>
              {k.word}
            </div>
            {k.desc ? <div style={{ display: "flex", fontSize: 42, color: T.SUB, marginTop: 18 }}>{k.desc}</div> : null}
          </div>
        )
      })}
    </div>,
    footer(5, 6, showPage),
  ])
}

function ctaScene(s: CtaSlide, frame: number, duration: number, showPage = true) {
  // 헤드라인: 스프링 진입
  const headSp = quickSpring(frame, 0)
  const headOp = headSp
  const headY  = lerp(headSp, [0, 1], [30, 0])

  // 본문: 헤드라인 안정 후 등장
  const bodyOp = lerp(frame, [12, 22], [0, 1])
  const bodyY  = lerp(frame, [12, 22], [16, 0])

  // marklens.site: 마지막에 등장
  const accentOp = lerp(frame, [20, 30], [0, 1])

  return wrap(frame, duration, [
    <div key="spacer" style={{ display: "flex", height: 40 }} />,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: T.TEXT, lineHeight: 1.28, letterSpacing: "-0.02em", wordBreak: "keep-all", opacity: headOp, transform: `translateY(${headY}px)` }}>
        {s.headline}
      </div>
      <div style={{ display: "flex", fontSize: 56, color: T.BODY, lineHeight: 1.55, marginTop: 56, wordBreak: "keep-all", opacity: bodyOp, transform: `translateY(${bodyY}px)` }}>
        {s.body}
      </div>
      <div style={{ display: "flex", fontSize: 46, color: T.ACCENT, fontWeight: 600, marginTop: 88, opacity: accentOp }}>
        marklens.site
      </div>
    </div>,
    footer(6, 6, showPage),
  ])
}

/* ── 캠페인 논평/큐레이션 프레임 (BARK 스타일: 풀블리드 이미지 + 오버레이 텍스트) ── */
export function renderCampaignFrame(opts: {
  image: string | null
  category: string
  headline: string   // 상단 후킹 헤드라인 (보통 insight.hook)
  caption: string    // 하단 논평 자막 한 줄 (MarkLens 분석)
  source: string     // 출처 매체명
  transparent?: boolean // true면 배경/이미지 생략(투명) — Shotstack 합성용 오버레이
}): React.ReactElement {
  const { image, category, headline, caption, source, transparent } = opts
  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", position: "relative", background: transparent ? "transparent" : T.BG, fontFamily: T.FONT }}>
      {image && !transparent ? (
        <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex", backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : null}
      <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: 760, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: T.WIDTH, height: 680, display: "flex", background: "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", padding: T.PADDING }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#fff", letterSpacing: "0.18em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", marginTop: 26 }}>{category}</div>
        <div style={{ display: "flex", width: 880, marginTop: 36, fontSize: 92, fontWeight: 700, color: "#fff", lineHeight: 1.22, letterSpacing: "-0.02em", textAlign: "center", wordBreak: "keep-all" }}>
          {headline}
        </div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", width: 900, fontSize: 52, fontWeight: 600, color: "#fff", lineHeight: 1.45, textAlign: "center", wordBreak: "keep-all", marginBottom: 30 }}>
          {caption}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.78)" }}>출처 · {source}</div>
      </div>
    </div>
  )
}

/* ── AI 광고 매거진 패키징 (ai.favmag 레퍼런스 문법) ── */
export function renderAdOverlay(opts: {
  masthead?: string
  tagline?: string
  headline1: string
  headline2?: string
  highlight?: string
  handle?: string
}): React.ReactElement {
  const { masthead = "MarkLens", tagline, headline1, headline2, highlight, handle = "@marklens.site" } = opts

  function hl(line: string, key: number) {
    if (!highlight || !line.includes(highlight)) {
      return <div key={key} style={{ display: "flex", color: "#fff" }}>{line}</div>
    }
    const i = line.indexOf(highlight)
    return (
      <div key={key} style={{ display: "flex" }}>
        {line.slice(0, i) ? <span style={{ color: "#fff" }}>{line.slice(0, i)}</span> : null}
        <span style={{ color: T.ACCENT }}>{highlight}</span>
        {line.slice(i + highlight.length) ? <span style={{ color: "#fff" }}>{line.slice(i + highlight.length)}</span> : null}
      </div>
    )
  }

  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", background: "transparent", fontFamily: T.FONT }}>
      <div style={{ width: T.WIDTH, height: 470, display: "flex", flexDirection: "column", alignItems: "center", background: "#0A0A0A", paddingTop: 96 }}>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#F2F0EB", fontFamily: "Playfair", letterSpacing: "0.04em" }}>
          {masthead}
        </div>
        {tagline ? (
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, fontStyle: "italic", color: T.SUB, fontFamily: "Playfair", marginTop: 14, letterSpacing: "0.03em" }}>
            {tagline}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, fontSize: 58, fontWeight: 700, lineHeight: 1.32, letterSpacing: "-0.01em", textAlign: "center", wordBreak: "keep-all", fontFamily: "Pretendard" }}>
          {[headline1, headline2].filter(Boolean).map((line, i) => hl(line as string, i))}
        </div>
      </div>
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ width: T.WIDTH, height: 190, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0A0A0A", paddingLeft: T.PADDING, paddingRight: T.PADDING }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: T.SUB, letterSpacing: "0.14em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 32, color: T.SUB }}>{handle}</div>
      </div>
    </div>
  )
}

/* 엔드카드: 실제 제품컷 + 카피 + 스펙광고 고지 */
export function renderAdEndcard(opts: {
  image: string | null
  imageDims?: { width: number; height: number } | null
  title?: string
  sub?: string
  handle?: string
}): React.ReactElement {
  const { image, imageDims, title = "이 광고, AI로 만들었습니다", sub, handle = "@marklens.site" } = opts
  const box = { width: 560, height: 760 }
  if (imageDims && imageDims.width > 0 && imageDims.height > 0) {
    const scale = Math.min(560 / imageDims.width, 760 / imageDims.height)
    box.width = Math.round(imageDims.width * scale)
    box.height = Math.round(imageDims.height * scale)
  }
  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", background: T.BG, fontFamily: T.FONT, paddingTop: 200, paddingBottom: 110 }}>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: "#F2F0EB", fontFamily: "Playfair", letterSpacing: "0.04em" }}>MarkLens</div>
      {image ? (
        <div style={{ display: "flex", width: 560, height: 760, marginTop: 90, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", width: box.width, height: box.height, backgroundImage: `url(${image})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexGrow: 1 }} />
      )}
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#fff", marginTop: 90, textAlign: "center", wordBreak: "keep-all", lineHeight: 1.3, fontFamily: "Pretendard" }}>{title}</div>
      {sub ? (
        <div style={{ display: "flex", fontSize: 40, color: T.BODY, marginTop: 28, textAlign: "center", wordBreak: "keep-all", fontFamily: "Pretendard" }}>{sub}</div>
      ) : null}
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ display: "flex", fontSize: 30, color: T.SUB }}>AI 스펙 광고 (팬메이드) · 브랜드 공식 광고가 아닙니다</div>
      <div style={{ display: "flex", fontSize: 34, color: T.ACCENT, fontWeight: 600, marginTop: 22 }}>{handle} · 매주 월요일 7:30</div>
    </div>
  )
}

/* ── 진입점 ── */
export function renderShortScene(
  slide: Slide,
  category: string,
  frame: number,
  duration: number,
  // showPage 미지정 시 true — 기존 숏츠 출력은 그대로 유지된다.
  opts?: { coverImage?: string | null; showPage?: boolean },
): React.ReactElement {
  const showPage = opts?.showPage ?? true
  switch (slide.type) {
    case "cover":    return coverScene(slide, category, frame, duration, opts?.coverImage, showPage)
    case "fact":     return factScene(slide, frame, duration, showPage)
    case "why":      return whyScene(slide, frame, duration, showPage)
    case "apply":    return applyScene(slide, frame, duration, showPage)
    case "keywords": return keywordsScene(slide, frame, duration, showPage)
    case "cta":      return ctaScene(slide, frame, duration, showPage)
  }
}
