import { INTERVIEW_QUESTIONS, TOTAL_QUESTIONS } from "./interview-questions"

export const SHEET_W = 1080
export const SHEET_H = 3950 // 콘텐츠보다 넉넉히 (하단 여백 허용, 클리핑 방지)

// 리드마그넷 "마케팅 면접 질문" 치트시트 — Satori 렌더(한글 완벽), 이후 pdf-lib가 이미지로 PDF화
export function renderInterviewSheet() {
  let n = 0
  return (
    <div style={{ width: SHEET_W, height: SHEET_H, display: "flex", flexDirection: "column", background: "#0A0A0A", padding: 72, fontFamily: "Pretendard" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#A1A1A1", letterSpacing: "0.12em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 74, fontWeight: 700, color: "#FFFFFF", marginTop: 26, letterSpacing: "-0.02em" }}>{`마케팅 면접 질문 ${TOTAL_QUESTIONS}선`}</div>
        <div style={{ display: "flex", fontSize: 30, color: "#C9C9C9", marginTop: 18 }}>취준생·주니어 마케터를 위한 실전 면접 질문 모음</div>
        <div style={{ display: "flex", fontSize: 24, color: "#6366F1", fontWeight: 600, marginTop: 12 }}>소리 내어 답하는 연습 → marklens.site/interview</div>
      </div>

      {/* 섹션 */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
        {INTERVIEW_QUESTIONS.map((sec, si) => (
          <div key={si} style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", width: 6, height: 28, background: "#6366F1", marginRight: 14 }} />
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#FFFFFF" }}>{sec.section}</div>
            </div>
            {sec.questions.map((q, qi) => {
              n++
              return (
                <div key={qi} style={{ display: "flex", marginBottom: 11 }}>
                  <div style={{ display: "flex", width: 46, flexShrink: 0, fontSize: 24, fontWeight: 700, color: "#6366F1" }}>{String(n).padStart(2, "0")}</div>
                  <div style={{ display: "flex", flex: 1, fontSize: 26, color: "#EDEDED", lineHeight: 1.4 }}>{q}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ display: "flex", fontSize: 22, color: "#A1A1A1" }}>트렌드를 실전으로 바꾸는 마크렌즈 · marklens.site</div>
    </div>
  )
}
