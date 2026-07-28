import { TOKENS } from "./templates"
import type { CurationSlide, CurationIntroSlide, CurationTrendSlide, CurationOutroSlide } from "./curation-types"
import { CURATION_SLIDE_COUNT } from "./curation-types"

/* 주간 트렌드 큐레이션 렌더 — 기존 카드뉴스(templates.tsx)와 별개 파일.
   색·폰트·여백 톤은 TOKENS 를 그대로 재사용(다크 BG·인디고·Pretendard·4:5·padding 96).
   sectionLabel·footer·frame·highlightLine 은 templates.tsx 를 수정하지 않기 위해 여기서
   같은 패턴으로 재구현한다(값은 TOKENS 공유).

   주의(Satori): Fragment 금지 — children 은 배열로. 모든 div 는 display:flex. */

const T = TOKENS

// 섹션 라벨 (인디고, letter-spacing) — templates.tsx 의 sectionLabel 과 동일 패턴
function sectionLabel(text: string) {
  return (
    <div key="label" style={{ display: "flex", width: "100%", fontSize: 32, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.08em" }}>
      {text}
    </div>
  )
}

// 하단 공통 푸터 — 페이지 표기는 큐레이션 총 7장 기준(01/07)
function footer(page: number, total: number, showPage: boolean) {
  return (
    <div key="footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: T.SUB, letterSpacing: "0.1em" }}>MARKLENS</div>
      <div style={{ display: "flex", fontSize: 28, color: T.SUB }}>
        {showPage ? `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : ""}
      </div>
    </div>
  )
}

// 슬라이드 공통 래퍼 — children 은 배열
function frame(children: React.ReactNode[]) {
  return (
    <div style={{
      width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column",
      background: T.BG, padding: T.PADDING, fontFamily: T.FONT, position: "relative",
    }}>
      {children}
    </div>
  )
}

// highlight 단어만 ACCENT 로 (한 줄) — templates.tsx 와 동일 패턴
function highlightLine(line: string, highlight: string | undefined, key: number) {
  if (!highlight || !line.includes(highlight)) {
    return <div key={key} style={{ display: "flex", color: T.TEXT }}>{line}</div>
  }
  const idx = line.indexOf(highlight)
  const before = line.slice(0, idx), after = line.slice(idx + highlight.length)
  // whiteSpace:pre — Satori flex 가 span 경계의 공백을 collapse 해 "트렌드 5"가 "트렌드5"로
  // 붙는 것을 막는다.
  return (
    <div key={key} style={{ display: "flex" }}>
      {before ? <span style={{ color: T.TEXT, whiteSpace: "pre" }}>{before}</span> : null}
      <span style={{ color: T.ACCENT, whiteSpace: "pre" }}>{highlight}</span>
      {after ? <span style={{ color: T.TEXT, whiteSpace: "pre" }}>{after}</span> : null}
    </div>
  )
}

// 카테고리 뱃지 (인디고 아웃라인 pill)
function categoryBadge(category: string) {
  return (
    <div style={{
      display: "flex", alignItems: "center", alignSelf: "flex-start",
      border: `2px solid ${T.ACCENT}`, borderRadius: 999, padding: "10px 24px",
      fontSize: 30, fontWeight: 600, color: T.ACCENT,
    }}>
      {category}
    </div>
  )
}

/* ── intro (표지) — 기존 cover 톤 계승: 큰 타이포 + 인디고 saveHook 강조 ── */
function introSlide(s: CurationIntroSlide, total: number) {
  return frame([
    sectionLabel("이번 주 마케팅 트렌드"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center", marginTop: -20 }}>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 96, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
        {s.headline.map((line, i) => highlightLine(line, s.highlight, i))}
      </div>
      {/* saveHook — 인디고 pill 로 강조(저장 유도) */}
      <div style={{
        display: "flex", alignItems: "center", alignSelf: "flex-start", marginTop: 48,
        background: "rgba(99,102,241,0.14)", border: `2px solid ${T.ACCENT}`, borderRadius: 999,
        padding: "14px 28px", fontSize: 34, fontWeight: 700, color: "#A5B4FC",
      }}>
        {s.saveHook}
      </div>
    </div>,
    footer(1, total, false),
  ])
}

/* ── trend ×5 — 변주 핵심: rank(크게·인디고) 앵커 + 제목 + 한 줄 요약 + 카테고리 뱃지, 좌측정렬 ── */
function trendSlide(s: CurationTrendSlide, page: number, total: number) {
  const it = s.item
  return frame([
    sectionLabel("이번 주 트렌드"),
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      {/* rank 앵커 — 크게, 인디고 */}
      <div style={{ display: "flex", fontSize: 190, fontWeight: 700, color: T.ACCENT, lineHeight: 1, letterSpacing: "-0.03em" }}>
        {String(it.rank).padStart(2, "0")}
      </div>
      {/* 제목 — 기존보다 낮춘 타이포 */}
      <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: T.TEXT, lineHeight: 1.25, letterSpacing: "-0.02em", marginTop: 28, wordBreak: "keep-all" }}>
        {it.title}
      </div>
      {/* 한 줄 요약 */}
      <div style={{ display: "flex", fontSize: 40, color: T.BODY, lineHeight: 1.5, marginTop: 24, wordBreak: "keep-all" }}>
        {it.summary}
      </div>
      {/* 카테고리 뱃지 */}
      <div style={{ display: "flex", marginTop: 40 }}>
        {categoryBadge(it.category)}
      </div>
    </div>,
    footer(page, total, true),
  ])
}

/* ── outro (마무리) — 기존 cta 톤 계승: 프로필/뉴스레터 유도 ── */
function outroSlide(s: CurationOutroSlide, total: number) {
  return frame([
    <div key="spacer" style={{ display: "flex", height: 32 }} />,
    <div key="mid" style={{ display: "flex", flexDirection: "column", width: "100%", flexGrow: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: 66, fontWeight: 700, color: T.TEXT, lineHeight: 1.3, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
        {s.headline}
      </div>
      <div style={{ display: "flex", fontSize: 40, color: T.BODY, lineHeight: 1.6, marginTop: 44, wordBreak: "keep-all" }}>
        {s.body}
      </div>
      {/* cta — 인디고 pill 로 강조 */}
      <div style={{
        display: "flex", alignItems: "center", alignSelf: "flex-start", marginTop: 64,
        background: "rgba(99,102,241,0.14)", border: `2px solid ${T.ACCENT}`, borderRadius: 999,
        padding: "16px 32px", fontSize: 36, fontWeight: 700, color: "#A5B4FC",
      }}>
        {s.cta}
      </div>
    </div>,
    footer(total, total, true),
  ])
}

/* ── 진입점 ── page 는 1..total(7). intro=1, trend=2..6, outro=7. */
export function renderCurationSlide(slide: CurationSlide, page: number, total = CURATION_SLIDE_COUNT): React.ReactElement {
  switch (slide.type) {
    case "intro": return introSlide(slide, total)
    case "trend": return trendSlide(slide, page, total)
    case "outro": return outroSlide(slide, total)
  }
}

/* ── 레이아웃 튜닝용 더미(생성 로직 전, 미리보기용) ── */
export const SAMPLE_CURATION: { slides: CurationSlide[] } = {
  slides: [
    { type: "intro", headline: ["이번 주 저장할", "마케팅 트렌드 5"], highlight: "5", saveHook: "지금 저장 안 하면 못 찾아요" },
    { type: "trend", item: { rank: 1, title: "AI 광고 소재 자동 생성 시대", summary: "구글 애즈가 멀티모달 AI로 소재를 만든다", category: "AI 마케팅" } },
    { type: "trend", item: { rank: 2, title: "숏폼, 이제 검색의 입구", summary: "MZ는 구글 대신 릴스로 검색한다", category: "소셜 미디어" } },
    { type: "trend", item: { rank: 3, title: "리텐션이 신규보다 싸다", summary: "이탈 막는 CRM 한 방이 광고비를 이긴다", category: "CRM" } },
    { type: "trend", item: { rank: 4, title: "E-E-A-T가 SEO를 흔든다", summary: "경험·전문성 없는 콘텐츠는 밀린다", category: "SEO" } },
    { type: "trend", item: { rank: 5, title: "가격보다 '의미'를 판다", summary: "브랜드 서사가 전환율을 바꾼다", category: "브랜딩" } },
    { type: "outro", headline: "매주 이렇게 정리해요", body: "월요일마다 한 주의 마케팅 트렌드를 큐레이션합니다. 놓치기 싫다면.", cta: "프로필 링크 → 뉴스레터 구독" },
  ],
}
