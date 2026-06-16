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

// 상단 섹션 라벨
function label(text: string) {
  return (
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em" }}>
      {text}
    </div>
  )
}

// 하단 푸터 (브랜드 + 진행도)
function footer(page: number, total: number) {
  return (
    <div key="footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: T.SUB, letterSpacing: "0.12em" }}>MARKLENS</div>
      <div style={{ display: "flex", fontSize: 38, color: T.SUB }}>{`${page} / ${total}`}</div>
    </div>
  )
}

// 세로 프레임 래퍼 — children은 배열 (Satori Fragment 금지)
function frame(children: React.ReactNode[]) {
  return (
    <div
      style={{
        width: T.WIDTH,
        height: T.HEIGHT,
        display: "flex",
        flexDirection: "column",
        background: T.BG,
        padding: T.PADDING,
        fontFamily: T.FONT,
        position: "relative",
      }}
    >
      {children}
    </div>
  )
}

// highlight 단어만 ACCENT 색으로. 한 줄을 별도 flex 아이템으로 쪼개면 Chrome(Remotion)에서
// 각 아이템이 제멋대로 줄바꿈돼 깨지므로, 단일 텍스트 흐름 안에 inline span으로만 색을 준다.
function highlightLine(line: string, highlight: string | undefined, key: number) {
  if (!highlight || !line.includes(highlight)) {
    return <div key={key} style={{ display: "flex", color: T.TEXT }}>{line}</div>
  }
  const idx = line.indexOf(highlight)
  return (
    <div key={key} style={{ display: "flex", color: T.TEXT }}>
      <span>
        {line.slice(0, idx)}
        <span style={{ color: T.ACCENT }}>{highlight}</span>
        {line.slice(idx + highlight.length)}
      </span>
    </div>
  )
}

/* ── 6종 장면 (카드뉴스와 동일 데이터, 9:16 레이아웃) ── */

function coverScene(s: CoverSlide, category: string, coverImage?: string | null) {
  if (coverImage) {
    const BAND = 980 // 상단 이미지 밴드 (1080×980)
    return frame([
      <div key="img" style={{
        position: "absolute", top: 0, left: 0, width: T.WIDTH, height: BAND, display: "flex",
        backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center",
      }} />,
      <div key="fade" style={{
        position: "absolute", top: BAND - 380, left: 0, width: T.WIDTH, height: 380, display: "flex",
        background: "linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 55%, rgba(10,10,10,1) 100%)",
      }} />,
      <div key="spacer" style={{ display: "flex", flexGrow: 1 }} />,
      <div key="text" style={{ display: "flex", flexDirection: "column", width: "100%", marginBottom: 64 }}>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", marginBottom: 32 }}>{category}</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 116, fontWeight: 700, lineHeight: 1.16, letterSpacing: "-0.02em" }}>
          {s.headline.map((line, i) => highlightLine(line, s.highlight, i))}
        </div>
        {s.sub ? <div style={{ display: "flex", fontSize: 46, color: "#C9C9C9", marginTop: 40 }}>{s.sub}</div> : null}
      </div>,
      footer(1, 6),
    ])
  }
  return frame([
    <div key="cat" style={{ display: "flex", width: "100%", fontSize: 42, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em" }}>{category}</div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 124, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
        {s.headline.map((line, i) => highlightLine(line, s.highlight, i))}
      </div>
      {s.sub ? <div style={{ display: "flex", fontSize: 48, color: T.SUB, marginTop: 48 }}>{s.sub}</div> : null}
    </div>,
    footer(1, 6),
  ])
}

function factScene(s: FactSlide) {
  return frame([
    label(s.label ?? "무슨 일?"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 64, color: T.TEXT, lineHeight: 1.5, letterSpacing: "-0.01em", wordBreak: "keep-all" }}>{s.body}</div>
      {s.source ? <div style={{ display: "flex", fontSize: 38, color: T.SUB, marginTop: 64 }}>출처 · {s.source}</div> : null}
    </div>,
    footer(2, 6),
  ])
}

function whyScene(s: WhySlide) {
  return frame([
    label(s.label ?? "왜 중요한가"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: T.TEXT, lineHeight: 1.28, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>{s.headline}</div>
      <div style={{ display: "flex", fontSize: 56, color: T.BODY, lineHeight: 1.55, marginTop: 56, wordBreak: "keep-all" }}>{s.body}</div>
    </div>,
    footer(3, 6),
  ])
}

function applyScene(s: ApplySlide) {
  return frame([
    label(s.label ?? "당장 해볼 수 있는 것"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 64, color: T.BODY, lineHeight: 1.55, letterSpacing: "-0.01em", wordBreak: "keep-all" }}>{s.body}</div>
    </div>,
    footer(4, 6),
  ])
}

function keywordsScene(s: KeywordsSlide) {
  return frame([
    label(s.label ?? "핵심 포인트"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center", gap: 80 }}>
      {s.keywords.map((k, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: T.TEXT, letterSpacing: "-0.01em" }}>{k.word}</div>
          {k.desc ? <div style={{ display: "flex", fontSize: 42, color: T.SUB, marginTop: 18 }}>{k.desc}</div> : null}
        </div>
      ))}
    </div>,
    footer(5, 6),
  ])
}

function ctaScene(s: CtaSlide) {
  return frame([
    <div key="spacer" style={{ display: "flex", height: 40 }} />,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: T.TEXT, lineHeight: 1.28, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>{s.headline}</div>
      <div style={{ display: "flex", fontSize: 56, color: T.BODY, lineHeight: 1.55, marginTop: 56, wordBreak: "keep-all" }}>{s.body}</div>
      <div style={{ display: "flex", fontSize: 46, color: T.ACCENT, fontWeight: 600, marginTop: 88 }}>marklens.site</div>
    </div>,
    footer(6, 6),
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
      {/* 배경 이미지 풀블리드 (오버레이 모드에선 Shotstack이 깔므로 생략) */}
      {image && !transparent ? (
        <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex", backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : null}
      {/* 상단/하단 가독성 그라데이션 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: 760, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: T.WIDTH, height: 680, display: "flex", background: "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0) 100%)" }} />
      {/* 콘텐츠 */}
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

/* ── AI 광고 매거진 패키징 (ai.favmag 레퍼런스 문법) ──
   오버레이: 상하 레터박스 + 세리프 마스트헤드 + 헤드라인. 중앙은 투명 → CapCut/Shotstack에서 영상 위에 얹음 */
export function renderAdOverlay(opts: {
  masthead?: string    // 기본 "MarkLens"
  tagline?: string     // 이탤릭 세리프 한 줄 (예: "1 image + 1 prompt = 24s spec ad")
  headline1: string    // 한글 헤드라인 1줄
  headline2?: string   // 2줄째 (강조 줄)
  highlight?: string   // 헤드라인 내 강조 단어
  handle?: string      // 하단 핸들 (기본 @marklens.site)
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
      {/* 상단 레터박스 — 마스트헤드 + 태그라인 + 헤드라인 */}
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
      {/* 중앙 투명 — 영상 노출 영역 */}
      <div style={{ display: "flex", flexGrow: 1 }} />
      {/* 하단 레터박스 */}
      <div style={{ width: T.WIDTH, height: 190, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0A0A0A", paddingLeft: T.PADDING, paddingRight: T.PADDING }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: T.SUB, letterSpacing: "0.14em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 32, color: T.SUB }}>{handle}</div>
      </div>
    </div>
  )
}

/* 엔드카드: 실제 제품컷 + 카피 + 스펙광고 고지 — 영상 마지막 2~3초용 풀프레임 */
export function renderAdEndcard(opts: {
  image: string | null   // 실제 제품 사진 (data URI)
  imageDims?: { width: number; height: number } | null // 원본 픽셀 크기 (contain 박스 계산용)
  title?: string         // 기본 "이 광고, AI로 만들었습니다"
  sub?: string           // 보조 카피
  handle?: string
}): React.ReactElement {
  const { image, imageDims, title = "이 광고, AI로 만들었습니다", sub, handle = "@marklens.site" } = opts
  // Satori는 backgroundSize:"contain"을 지원하지 않는다 — 원본 비율로 560×760 안에 맞는 박스를 직접 계산
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
export function renderShortScene(slide: Slide, category: string, opts?: { coverImage?: string | null }): React.ReactElement {
  switch (slide.type) {
    case "cover": return coverScene(slide, category, opts?.coverImage)
    case "fact": return factScene(slide)
    case "why": return whyScene(slide)
    case "apply": return applyScene(slide)
    case "keywords": return keywordsScene(slide)
    case "cta": return ctaScene(slide)
  }
}
