import type { Slide, Cardnews, CoverSlide, FactSlide, WhySlide, ApplySlide, KeywordsSlide, CtaSlide } from "./types"

/* ── 디자인 토큰 (스펙 3.1) — 하나만 바꾸면 전체 반영 ── */
export const TOKENS = {
  BG: "#0A0A0A",
  TEXT: "#FFFFFF",
  BODY: "#EDEDED",
  SUB: "#A1A1A1",
  ACCENT: "#6366F1", // 기존 브랜드 포인트(뉴스레터·공유카드 인디고) 1순위 사용
  PADDING: 96,
  WIDTH: 1080,
  HEIGHT: 1350,
  FONT: "Pretendard",
  SIGNATURE_BRACKETS: false, // 3.4 뷰파인더 모서리 마크 (기본 off)
}

const T = TOKENS

/* ── 공통 조각 ──
   주의: Satori는 Fragment를 단일 익명 요소로 취급해 레이아웃이 깨진다.
   슬라이드 자식은 반드시 배열로 전달할 것. */

// 섹션 라벨 (slides 2~5 상단)
function sectionLabel(text: string) {
  return (
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 32, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.08em" }}>
      {text}
    </div>
  )
}

// 하단 공통 푸터 (3.5)
function footer(page: number, total: number, showPage: boolean) {
  return (
    <div key="footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: T.SUB, letterSpacing: "0.1em" }}>
        MARKLENS
      </div>
      <div style={{ display: "flex", fontSize: 28, color: T.SUB }}>
        {showPage ? `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : ""}
      </div>
    </div>
  )
}

// 뷰파인더 브래킷 (3.4, 옵션)
function brackets() {
  const L = 48, W = 2, C = T.SUB, M = 40
  const common = { position: "absolute" as const, width: L, height: L, display: "flex" }
  return [
    <div key="tl" style={{ ...common, top: M, left: M, borderTop: `${W}px solid ${C}`, borderLeft: `${W}px solid ${C}` }} />,
    <div key="tr" style={{ ...common, top: M, right: M, borderTop: `${W}px solid ${C}`, borderRight: `${W}px solid ${C}` }} />,
    <div key="bl" style={{ ...common, bottom: M, left: M, borderBottom: `${W}px solid ${C}`, borderLeft: `${W}px solid ${C}` }} />,
    <div key="br" style={{ ...common, bottom: M, right: M, borderBottom: `${W}px solid ${C}`, borderRight: `${W}px solid ${C}` }} />,
  ]
}

// 슬라이드 공통 래퍼 — children은 배열 (Fragment 금지)
function frame(children: React.ReactNode[]) {
  const items = T.SIGNATURE_BRACKETS ? [...brackets(), ...children] : children
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
      {items}
    </div>
  )
}

// highlight 단어만 ACCENT로 (cover 헤드라인 한 줄)
function highlightLine(line: string, highlight: string | undefined, key: number) {
  if (!highlight || !line.includes(highlight)) {
    return (
      <div key={key} style={{ display: "flex", color: T.TEXT }}>{line}</div>
    )
  }
  const idx = line.indexOf(highlight)
  const before = line.slice(0, idx)
  const after = line.slice(idx + highlight.length)
  return (
    <div key={key} style={{ display: "flex" }}>
      {before ? <span style={{ color: T.TEXT }}>{before}</span> : null}
      <span style={{ color: T.ACCENT }}>{highlight}</span>
      {after ? <span style={{ color: T.TEXT }}>{after}</span> : null}
    </div>
  )
}

/* ── 슬라이드 6종 (스펙 4) ── */

function coverSlide(s: CoverSlide, category: string, total: number, coverImage?: string | null) {
  // 포토 표지: 대표 이미지 풀블리드 + 다크 그라데이션, 헤드라인 하단 배치
  // img+objectFit은 Satori가 비율을 무시하므로 backgroundSize: cover 사용 (중앙 크롭)
  if (coverImage) {
    return frame([
      <div key="bg" style={{
        position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex",
        backgroundImage: `url(${coverImage})`, backgroundSize: "cover", backgroundPosition: "center",
      }} />,
      <div key="overlay" style={{
        position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex",
        background: "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.45) 30%, rgba(10,10,10,0.62) 55%, rgba(10,10,10,0.95) 100%)",
      }} />,
      <div key="cat" style={{ display: "flex", width: "100%", fontSize: 30, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.08em" }}>
        {category}
      </div>,
      <div key="spacer" style={{ display: "flex", flexGrow: 1 }} />,
      <div key="text" style={{ display: "flex", flexDirection: "column", width: "100%", marginBottom: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, lineHeight: 1.18, letterSpacing: "-0.02em" }}>
          {s.headline.map((line, i) => highlightLine(line, s.highlight, i))}
        </div>
        {s.sub ? (
          <div style={{ display: "flex", fontSize: 36, color: "#C9C9C9", marginTop: 32 }}>{s.sub}</div>
        ) : null}
      </div>,
      footer(1, total, false),
    ])
  }

  // 타이포 표지 (이미지 없을 때)
  return frame([
    <div key="cat" style={{ display: "flex", width: "100%", fontSize: 30, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.08em" }}>
      {category}
    </div>,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center", marginTop: -40 }}>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 96, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
        {s.headline.map((line, i) => highlightLine(line, s.highlight, i))}
      </div>
      {s.sub ? (
        <div style={{ display: "flex", fontSize: 36, color: T.SUB, marginTop: 36 }}>{s.sub}</div>
      ) : null}
    </div>,
    footer(1, total, false),
  ])
}

function factSlide(s: FactSlide, total: number) {
  return frame([
    sectionLabel("무슨 일?"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 46, color: T.BODY, lineHeight: 1.55, letterSpacing: "-0.01em", wordBreak: "keep-all" }}>
        {s.body}
      </div>
      {s.source ? (
        <div style={{ display: "flex", fontSize: 28, color: T.SUB, marginTop: 56 }}>출처 · {s.source}</div>
      ) : null}
    </div>,
    footer(2, total, true),
  ])
}

function whySlide(s: WhySlide, total: number) {
  return frame([
    sectionLabel("왜 중요한가"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 66, fontWeight: 700, color: T.TEXT, lineHeight: 1.3, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
        {s.headline}
      </div>
      <div style={{ display: "flex", fontSize: 40, color: T.BODY, lineHeight: 1.6, marginTop: 44, wordBreak: "keep-all" }}>
        {s.body}
      </div>
    </div>,
    footer(3, total, true),
  ])
}

function applySlide(s: ApplySlide, total: number) {
  return frame([
    sectionLabel("당장 해볼 수 있는 것"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 46, color: T.BODY, lineHeight: 1.6, letterSpacing: "-0.01em", wordBreak: "keep-all" }}>
        {s.body}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: T.SUB, marginTop: 64 }}>
        더 구체적인 활용법은 풀버전에서 →
      </div>
    </div>,
    footer(4, total, true),
  ])
}

function keywordsSlide(s: KeywordsSlide, total: number) {
  return frame([
    sectionLabel("이 뉴스 뒤에 깔린 흐름"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center", gap: 64 }}>
      {s.keywords.map((k, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: T.TEXT, letterSpacing: "-0.01em" }}>
            {k.word}
          </div>
          {k.desc ? (
            <div style={{ display: "flex", fontSize: 32, color: T.SUB, marginTop: 14 }}>{k.desc}</div>
          ) : null}
        </div>
      ))}
    </div>,
    footer(5, total, true),
  ])
}

function ctaSlide(s: CtaSlide, total: number) {
  return frame([
    <div key="spacer" style={{ display: "flex", height: 32 }} />,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 66, fontWeight: 700, color: T.TEXT, lineHeight: 1.3, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
        {s.headline}
      </div>
      <div style={{ display: "flex", fontSize: 40, color: T.BODY, lineHeight: 1.6, marginTop: 44, wordBreak: "keep-all" }}>
        {s.body}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: T.SUB, marginTop: 72 }}>
        매주 월요일 7:30 · MarkLens Weekly
      </div>
    </div>,
    footer(6, total, true),
  ])
}

/* ── 진입점 ── */
export function renderSlide(slide: Slide, category: string, total = 6, opts?: { coverImage?: string | null }): React.ReactElement {
  switch (slide.type) {
    case "cover": return coverSlide(slide, category, total, opts?.coverImage)
    case "fact": return factSlide(slide, total)
    case "why": return whySlide(slide, total)
    case "apply": return applySlide(slide, total)
    case "keywords": return keywordsSlide(slide, total)
    case "cta": return ctaSlide(slide, total)
  }
}

/* ── 디자인 튜닝용 샘플 (demo=1 렌더) ── */
export const SAMPLE_CARDNEWS: Cardnews = {
  category: "AI 마케팅",
  slides: [
    { type: "cover", headline: ["광고 소재,", "이제 AI가", "만든다?"], highlight: "AI", sub: "구글이 진짜로 움직였다" },
    { type: "fact", body: "Google Ads 'Asset Studio'에 멀티모달 AI가 도입됩니다. 광고 소재를 만들고, 조합하고, 테스트하는 과정을 AI가 한 번에 처리합니다.", source: "Google Ads & Commerce Blog" },
    { type: "why", headline: "'소재 노가다'가 사라진다", body: "버전 만들고, 돌려보고, 갈아끼우는 반복 업무를 AI가 흡수합니다. 마케터는 전략에 집중하게 됩니다." },
    { type: "apply", body: "기존 캠페인의 CTR·CVR 데이터를 AI에 학습시키면, 다음 캠페인의 최적 소재를 제안받을 수 있습니다." },
    { type: "keywords", keywords: [
      { word: "크리에이티브 최적화", desc: "소재 생성-테스트-개선의 자동화" },
      { word: "마케팅 자동화", desc: "반복 업무를 시스템이 흡수" },
      { word: "퍼포먼스 마케팅", desc: "데이터 기반 의사결정의 확장" },
    ] },
    { type: "cta", headline: "이 얘기, 면접에서 어떻게 말할까?", body: "\"면접에서 이렇게 말해보세요\" 풀버전은 프로필 링크에서" },
  ],
}
