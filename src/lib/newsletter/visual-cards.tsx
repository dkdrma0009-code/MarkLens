import { TOKENS } from "@/lib/cardnews/templates"

// 뉴스레터 본문 삽입용 가로형(16:9) 타이포 비주얼 카드.
// 카드뉴스 토큰(다크 배경·인디고 ACCENT·Pretendard)을 그대로 재사용. 새 렌더 엔진 만들지 않음.
export const NL_CARD = { WIDTH: 1200, HEIGHT: 675 }
const T = TOKENS

// 인용구 카드 — 핵심 명제 한 문장
export function renderQuoteCard(text: string) {
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "center", backgroundColor: T.BG, padding: 90, fontFamily: T.FONT,
      }}
    >
      <div style={{ display: "flex", fontSize: 140, lineHeight: 0.8, fontWeight: 900, color: T.ACCENT }}>&ldquo;</div>
      <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: T.TEXT, lineHeight: 1.35, letterSpacing: "-1px", marginTop: 12 }}>
        {text.slice(0, 80)}
      </div>
      <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: T.SUB, letterSpacing: "0.1em", marginTop: 40 }}>
        MARKLENS
      </div>
    </div>
  )
}

// 숫자 강조 카드 — 임팩트 수치 하나
export function renderStatCard(number: string, label: string) {
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", backgroundColor: T.BG, padding: 80, fontFamily: T.FONT,
      }}
    >
      <div style={{ display: "flex", fontSize: 200, fontWeight: 900, color: T.ACCENT, lineHeight: 1, letterSpacing: "-4px" }}>
        {number.slice(0, 12)}
      </div>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: T.BODY, marginTop: 24, textAlign: "center" }}>
        {label.slice(0, 40)}
      </div>
    </div>
  )
}
