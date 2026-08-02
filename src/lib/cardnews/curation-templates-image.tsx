import { TOKENS } from "./templates"
import type { CurationTrendItem } from "./curation-types"

/* 큐레이션 트렌드 장 "이미지 버전" — 텍스트 전용 curation-templates.tsx 와 별개(그건 그대로 둔다).
   레퍼런스(주간 랭킹 큐레이션, Hot 8 Chart 류)를 따른 풀블리드 배치:
     - 카테고리 이미지를 화면 가득
     - 좌상단 워터마크("이번 주 트렌드")
     - 좌하단 서수 랭크(1st/2nd…) + 제목 + 한 줄 요약
     - 우하단 카테고리 영문 워드마크(브랜드 워드마크 자리)
   가독성 최우선: 이미지 밝기와 무관하게 하단 텍스트 존을 강한 스크림 + 글자 그림자로 확실히 눌러
   밝은 이미지에서도 글씨가 묻히지 않게 한다.

   주의(Satori): Fragment 금지 — children 은 배열. 모든 div 는 display:flex.
   textShadow 는 undefined 를 주면 Satori 가 파싱하다 죽으니 "none" 을 쓴다. */

const T = TOKENS
const SHADOW = "0 2px 22px rgba(0,0,0,0.92), 0 1px 3px rgba(0,0,0,0.95)"

// 카테고리 → 영문 워드마크(레퍼런스의 브랜드 워드마크 자리, 우하단)
const CAT_EN: Record<string, string> = {
  "브랜딩": "BRANDING", "퍼포먼스 마케팅": "PERFORMANCE", "CRM": "CRM", "콘텐츠 마케팅": "CONTENT",
  "SEO": "SEO", "소셜 미디어": "SOCIAL", "AI 마케팅": "AI", "소비자 심리": "PSYCHOLOGY",
}
function ordinal(n: number): string {
  const v = n % 100
  return ["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"
}
const bgImg = (image: string): React.CSSProperties => ({
  backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center",
})

export function renderTrendImageSlide(it: CurationTrendItem, page: number, total: number, image: string): React.ReactElement {
  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", position: "relative", fontFamily: T.FONT, ...bgImg(image) }}>
      {/* 1) 전체 살짝 어둡게 — 밝은 이미지의 명도 눌러 대비 확보 */}
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "rgba(8,8,10,0.22)" }} />
      {/* 2) 상단 스크림 — 워터마크 가독성 */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 220, display: "flex", background: "linear-gradient(180deg, rgba(8,8,10,0.55) 0%, rgba(8,8,10,0) 100%)" }} />
      {/* 3) 하단 스크림(강) — 이미지 밝기와 무관하게 텍스트 존을 확실히 어둡게(가독성 최우선) */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 820, display: "flex", background: "linear-gradient(180deg, rgba(8,8,10,0) 0%, rgba(8,8,10,0.20) 30%, rgba(8,8,10,0.78) 62%, rgba(8,8,10,0.96) 100%)" }} />

      {/* 콘텐츠 */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "96px 96px 84px", boxSizing: "border-box" }}>
        {/* 좌상단 워터마크 */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 34, height: 3, background: T.ACCENT, borderRadius: 2 }} />
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.82)", letterSpacing: "0.16em", textShadow: SHADOW }}>이번 주 트렌드</div>
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* 하단 텍스트 블록 */}
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          {/* 서수 랭크 + 우측 카테고리 워드마크 */}
          <div style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
              <div style={{ display: "flex", fontSize: 134, fontWeight: 800, color: T.ACCENT, lineHeight: 1, letterSpacing: "-0.03em", textShadow: SHADOW }}>{it.rank}</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: T.ACCENT, marginLeft: 6, marginTop: 16, textShadow: SHADOW }}>{ordinal(it.rank)}</div>
            </div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800, color: "rgba(255,255,255,0.9)", letterSpacing: "0.1em", marginBottom: 20, textShadow: SHADOW }}>{CAT_EN[it.category] ?? it.category}</div>
          </div>
          {/* 제목 */}
          <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: T.TEXT, lineHeight: 1.22, letterSpacing: "-0.02em", marginTop: 20, maxWidth: 900, wordBreak: "keep-all", textShadow: SHADOW }}>{it.title}</div>
          {/* 한 줄 요약 */}
          <div style={{ display: "flex", fontSize: 38, color: T.BODY, lineHeight: 1.45, marginTop: 16, maxWidth: 900, wordBreak: "keep-all", textShadow: SHADOW }}>{it.summary}</div>
        </div>

        {/* 푸터 */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 40 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textShadow: SHADOW }}>MARKLENS</div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.55)", textShadow: SHADOW }}>{String(page).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
        </div>
      </div>
    </div>
  )
}
