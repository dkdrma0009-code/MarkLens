// 인사이트 본문 "중간" 뉴스레터 CTA 삽입 위치 계산 (순수 함수 — 테스트 가능).
//
// 스크롤 %가 아니라 본문 문단 수 기준으로 중간 지점을 잡아 글 길이와 무관하게 안정적으로 배치한다.
// 너무 짧은 글엔 넣지 않는다(하단 CTA와 붙어버림).

export interface BodySection {
  id: string      // 섹션 id (summary/takeaways/why/apply/framework/terms/interview/learn)
  paras: number   // 이 섹션의 문단(또는 항목) 수 = 가중치
}

// 이 문단 수 미만이면 중간 CTA 생략(하단과 붙음 방지)
export const MID_CTA_MIN_PARAS = 6
// 섹션 수가 이보다 적으면 생략(중간이라 부를 게 없음)
export const MID_CTA_MIN_SECTIONS = 3

// Prose 와 동일한 규칙으로 문단 수를 센다(\n+ 로 분리). 최소 1.
export function countParas(text: string | null | undefined): number {
  if (!text) return 0
  return text.split(/\n+/).filter(Boolean).length || 1
}

// 존재하는 본문 섹션(순서)과 각 문단 수 → 중간 CTA를 넣을 섹션 id (없으면 null).
// 문단 누적이 절반을 처음 넘는 섹션 "뒤"에 삽입. 단 마지막 섹션 뒤엔 넣지 않는다(하단 CTA와 붙음).
export function midCtaAfterSection(sections: BodySection[]): string | null {
  const total = sections.reduce((s, x) => s + x.paras, 0)
  if (sections.length < MID_CTA_MIN_SECTIONS || total < MID_CTA_MIN_PARAS) return null

  const half = total / 2
  let cum = 0
  for (let i = 0; i < sections.length; i++) {
    cum += sections[i].paras
    if (cum >= half) {
      const idx = Math.min(i, sections.length - 2) // 마지막 섹션 뒤 금지
      return idx >= 0 ? sections[idx].id : null
    }
  }
  return null
}
