import { TOKENS, TYPO } from "./templates"
import type { CurationTrendItem } from "./curation-types"

/* 큐레이션 "밝은 에디토리얼" 레이아웃 — lit_official_kr(Hot 8 Chart) 레퍼런스 재현.
   기존 다크 템플릿(curation-templates.tsx 텍스트 / curation-templates-image.tsx 풀블리드)은
   건드리지 않는다. 여기서 3가지 이미지-충전 방식을 비교 렌더한다.

   공통: 크림 배경(#F5F5F3), 검정 미니멀 타이포, 여백 크게, 인디고는 포인트로만.
   Satori 주의: Fragment 금지(children 배열), 모든 div display:flex, textShadow 미사용. */

const W = TOKENS.WIDTH
const H = TOKENS.HEIGHT
const FONT = TOKENS.FONT

const C = {
  BG: "#F5F5F3",
  INK: "#141414",
  SUB: "#5b5b5b",
  MUTED: "#8a8a8a",
  LINE: "#e3e1dc",
  ACCENT: "#4f46e5",
  CARD: "#eceae5",
}

// 에디토리얼 전용 크기(px) — 현재 값 그대로 상수화. 행간·자간은 TYPO(몽타주)로 매핑.
// 키커·메타·번호·CTA 는 몽타주 무정의 역할이라 기존 트래킹 유지하고 크기만 토큰화.
const ESIZE = {
  coverHeadline: 74, headline: 68, outroHeadline: 72,  // DISPLAY
  listTitle: 34,                                        // TITLE
  summary: 32, body: 34, featureSummary: 30,            // BODY 계열
  kicker: 24, meta: 22, rowKey: 20, listCat: 19,        // 키커·메타(트래킹 유지)
  rank: 40, rowVal: 28, cta: 30,                        // 번호·값·CTA
} as const

const CAT_EN: Record<string, string> = {
  "브랜딩": "BRANDING", "퍼포먼스 마케팅": "PERFORMANCE", "CRM": "CRM", "콘텐츠 마케팅": "CONTENT",
  "SEO": "SEO", "소셜 미디어": "SOCIAL", "AI 마케팅": "AI", "소비자 심리": "PSYCHOLOGY",
}

export interface EditorialCtx {
  page: number
  total: number
  date: string   // 예: "2026.08.03"
  source: string // 예: "Campaign Brief"
}

// 둥근 이미지 타일 (overflow hidden 컨테이너 + cover img)
function tile(src: string, style: React.CSSProperties): React.ReactElement {
  return (
    <div style={{ display: "flex", overflow: "hidden", borderRadius: 18, background: C.CARD, ...style }}>
      <img src={src} width="100%" height="100%" style={{ objectFit: "cover" }} />
    </div>
  )
}

// 좌상단 헤더(뱃지+제목+설명) — 3방식 공통
function header(item: CurationTrendItem, ctx: EditorialCtx): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: C.ACCENT }} />
        <div style={{ display: "flex", fontSize: ESIZE.meta, fontWeight: 700, color: C.INK, letterSpacing: "0.14em" }}>
          {CAT_EN[item.category] ?? item.category}
        </div>
        <div style={{ display: "flex", fontSize: ESIZE.meta, color: C.MUTED, letterSpacing: "0.1em" }}>
          · {String(ctx.page).padStart(2, "0")} / {String(ctx.total).padStart(2, "0")}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: ESIZE.headline, fontWeight: 800, color: C.INK, ...TYPO.DISPLAY, wordBreak: "keep-all" }}>
        {item.title}
      </div>
      <div style={{ display: "flex", fontSize: ESIZE.summary, color: C.SUB, ...TYPO.BODY, marginTop: 24, wordBreak: "keep-all" }}>
        {item.summary}
      </div>
    </div>
  )
}

function footer(ctx: EditorialCtx): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.LINE}` }}>
      <div style={{ display: "flex", fontSize: ESIZE.kicker, fontWeight: 700, color: C.INK, letterSpacing: "0.12em" }}>MARKLENS</div>
      <div style={{ display: "flex", fontSize: ESIZE.meta, color: C.MUTED }}>{ctx.source} · {ctx.date}</div>
    </div>
  )
}

function frame(children: React.ReactElement[]): React.ReactElement {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: C.BG, fontFamily: FONT, padding: "72px 68px 60px", boxSizing: "border-box" }}>
      {children}
    </div>
  )
}

/* ── 방식 1·2: 4장 이미지 격자 (좌 큰 대표 + 우 3장 세로) ──
   방식1은 rep=아티클·grid=스톡, 방식2는 전부 스톡(서로 다른 컷). 레이아웃 동일. */
export function renderTrendEditorialGrid(
  item: CurationTrendItem, ctx: EditorialCtx, images: { rep: string; grid: string[] },
): React.ReactElement {
  return frame([
    header(item, ctx),
    <div key="media" style={{ display: "flex", flexDirection: "row", flexGrow: 1, gap: 20, marginTop: 44 }}>
      {tile(images.rep, { flex: 1.75 })}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
        {tile(images.grid[0] ?? images.rep, { flex: 1 })}
        {tile(images.grid[1] ?? images.rep, { flex: 1 })}
        {tile(images.grid[2] ?? images.rep, { flex: 1 })}
      </div>
    </div>,
    footer(ctx),
  ])
}

/* ── 표지: Hot 8 Chart식 — 크림 배경에 트렌드 5개 목록 미리보기(번호+제목+썸네일) ── */
export function renderCurationCoverEditorial(opts: {
  kicker: string
  headline: string[]
  highlight?: string
  date: string
  items: { rank: number; title: string; category: string; thumb: string }[]
}): React.ReactElement {
  const { kicker, headline, highlight, date, items } = opts

  const titleLine = (line: string, key: number): React.ReactElement => {
    if (highlight && line.includes(highlight)) {
      const idx = line.lastIndexOf(highlight)
      const spans: React.ReactElement[] = []
      const before = line.slice(0, idx)
      const after = line.slice(idx + highlight.length)
      if (before) spans.push(<div key="b" style={{ display: "flex" }}>{before}</div>)
      spans.push(<div key="h" style={{ display: "flex", color: C.ACCENT }}>{highlight}</div>)
      if (after) spans.push(<div key="a" style={{ display: "flex" }}>{after}</div>)
      return <div key={key} style={{ display: "flex", flexDirection: "row" }}>{spans}</div>
    }
    return <div key={key} style={{ display: "flex" }}>{line}</div>
  }

  return frame([
    <div key="head" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: C.ACCENT }} />
        <div style={{ display: "flex", fontSize: ESIZE.kicker, fontWeight: 700, color: C.INK, letterSpacing: "0.14em" }}>{kicker}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: ESIZE.coverHeadline, fontWeight: 800, color: C.INK, ...TYPO.DISPLAY }}>
        {headline.map((l, i) => titleLine(l, i))}
      </div>
    </div>,
    <div key="list" style={{ display: "flex", flexDirection: "column", flexGrow: 1, marginTop: 44 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "row", alignItems: "center", flex: 1, gap: 24, borderTop: i > 0 ? `1px solid ${C.LINE}` : "0px solid transparent" }}>
          <div style={{ display: "flex", width: 58, fontSize: ESIZE.rank, fontWeight: 800, color: C.INK }}>{it.rank}</div>
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingRight: 16 }}>
            <div style={{ display: "flex", fontSize: ESIZE.listCat, color: C.MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>{CAT_EN[it.category] ?? it.category}</div>
            <div style={{ display: "flex", fontSize: ESIZE.listTitle, fontWeight: 700, color: C.INK, ...TYPO.TITLE, wordBreak: "keep-all" }}>{it.title}</div>
          </div>
          {tile(it.thumb, { width: 116, height: 116, flexShrink: 0, borderRadius: 14 })}
        </div>
      ))}
    </div>,
    <div key="foot" style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.LINE}` }}>
      <div style={{ display: "flex", fontSize: ESIZE.kicker, fontWeight: 700, color: C.INK, letterSpacing: "0.12em" }}>MARKLENS</div>
      <div style={{ display: "flex", fontSize: ESIZE.meta, color: C.MUTED }}>주간 트렌드 · {date}</div>
    </div>,
  ])
}

/* ── outro: 같은 크림 톤 구독 유도 ── */
export function renderOutroEditorial(opts: {
  headline: string; body: string; cta: string; date: string; thumbs: string[]
}): React.ReactElement {
  const { headline, body, cta, date, thumbs } = opts
  return frame([
    <div key="head" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 28 }}>
      <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, background: C.ACCENT }} />
      <div style={{ display: "flex", fontSize: ESIZE.kicker, fontWeight: 700, color: C.INK, letterSpacing: "0.14em" }}>MARKLENS WEEKLY</div>
    </div>,
    <div key="body" style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: ESIZE.outroHeadline, fontWeight: 800, color: C.INK, ...TYPO.DISPLAY, wordBreak: "keep-all" }}>{headline}</div>
      <div style={{ display: "flex", fontSize: ESIZE.body, color: C.SUB, ...TYPO.BODY, marginTop: 28, maxWidth: 820, wordBreak: "keep-all" }}>{body}</div>
      <div style={{ display: "flex", marginTop: 44 }}>
        <div style={{ display: "flex", background: C.ACCENT, color: "#fff", fontSize: ESIZE.cta, fontWeight: 700, padding: "24px 36px", borderRadius: 999 }}>{cta}</div>
      </div>
    </div>,
    <div key="thumbs" style={{ display: "flex", flexDirection: "row", gap: 16, marginBottom: 28 }}>
      {thumbs.slice(0, 5).map((t) => tile(t, { width: 176, height: 132, flexShrink: 0, borderRadius: 12 }))}
    </div>,
    footer({ page: 7, total: 7, date, source: "주간 트렌드" }),
  ])
}

/* ── 방식 3: 대표 이미지 1장 크게 + 데이터/텍스트 블록 ── */
export function renderTrendEditorialFeature(
  item: CurationTrendItem, ctx: EditorialCtx, image: string,
): React.ReactElement {
  const rows: [string, string][] = [
    ["카테고리", CAT_EN[item.category] ?? item.category],
    ["출처", ctx.source],
    ["발행", ctx.date],
  ]
  return frame([
    header(item, ctx),
    <div key="media" style={{ display: "flex", flexDirection: "row", flexGrow: 1, gap: 24, marginTop: 44 }}>
      {tile(image, { flex: 1.6 })}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", background: C.CARD, borderRadius: 18, padding: "32px 32px", gap: 20, flexGrow: 1 }}>
          {rows.map(([k, v], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", fontSize: ESIZE.rowKey, color: C.MUTED, letterSpacing: "0.1em" }}>{k}</div>
              <div style={{ display: "flex", fontSize: ESIZE.rowVal, fontWeight: 700, color: C.INK }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", background: C.ACCENT, borderRadius: 18, padding: "28px 28px" }}>
          <div style={{ display: "flex", fontSize: ESIZE.rowKey, color: "rgba(255,255,255,0.72)", letterSpacing: "0.1em", marginBottom: 8 }}>THIS WEEK</div>
          <div style={{ display: "flex", fontSize: ESIZE.featureSummary, fontWeight: 700, color: "#fff", lineHeight: 1.3, wordBreak: "keep-all" }}>{item.summary}</div>
        </div>
      </div>
    </div>,
    footer(ctx),
  ])
}
