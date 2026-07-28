// 주간 트렌드 큐레이션 — 기존 6장 인사이트 카드뉴스(types.ts)와 완전히 별개의 종류.
//
// 기존 Slide 유니온·SLIDE_ORDER·validate.ts 는 이 파일에서 import 하지도, 수정하지도
// 않는다(기존 카드뉴스 무손상 보장). discriminant 값도 "intro"|"trend"|"outro" 로
// 기존(cover/fact/why/apply/keywords/cta)과 겹치지 않아, 두 세계가 섞여도 서로의
// 검증/렌더 스위치에 걸리지 않는다.
//
// 구성: 표지 1장 + 트렌드 5장 + 마무리 1장 = 7장.
// (렌더·생성은 다음 단계. 이 파일은 데이터 구조/타입/자체 검증까지만.)

import { CATEGORY_META } from "@/lib/category"

/* ── 상수 ── */

export const CURATION_TREND_COUNT = 5
export const CURATION_SLIDE_COUNT = CURATION_TREND_COUNT + 2 // 표지 + 트렌드5 + 마무리 = 7

// 큐레이션 종류(주기). 지금은 주간만. 나중에 monthly 등으로 확장할 자리.
export const CURATION_KINDS = ["weekly-trend"] as const
export type CurationKind = (typeof CURATION_KINDS)[number]

// 렌더 단계에서 확정·튜닝할 잠정 글자수 상한(디자인 오버플로 방지의 밑그림).
// 지금은 자체 검증이 이 값을 쓰지만, 실제 템플릿을 만들 때 함께 조정한다.
export const CURATION_LIMITS = {
  introHeadlineLine: 14,   // 표지 헤드라인 줄당
  introSaveHook: 20,       // 저장 유도 문구
  trendTitle: 26,          // 트렌드 제목
  trendSummary: 42,        // 한 줄 요약
  outroHeadline: 20,
  outroBody: 60,
  outroCta: 40,
} as const

/* ── 슬라이드 타입 (기존 Slide 와 무관한 별도 유니온) ── */

// 표지: 후킹 + 저장 유도. 예: "이번 주 저장할 마케팅 트렌드 5"
export interface CurationIntroSlide {
  type: "intro"
  headline: string[]        // 2~3줄, 줄당 CURATION_LIMITS.introHeadlineLine 이내
  highlight?: string        // 헤드라인에 실제 포함된 단어 1개(강조색)
  saveHook: string          // 저장 유도 한 줄 (예: "저장 필수 📌")
}

// 트렌드 한 건 = [인사이트 제목 + 한 줄 요약 + 카테고리]. rank 로 순번 표기.
// articleId 는 원본 인사이트 연결용(선택) — 링크·per-item 성과 집계의 씨앗.
export interface CurationTrendItem {
  rank: number              // 1..CURATION_TREND_COUNT
  title: string             // 인사이트 제목
  summary: string           // 한 줄 요약
  category: string          // category.ts 의 8개 중 하나(권장)
  articleId?: string        // 원본 인사이트(있으면) — 나중에 유입/성과 연결
}

export interface CurationTrendSlide {
  type: "trend"
  item: CurationTrendItem
}

// 마무리: 프로필 링크 / 뉴스레터 구독 유도.
export interface CurationOutroSlide {
  type: "outro"
  headline: string
  body: string
  cta: string               // 예: "프로필 링크 → 뉴스레터 구독"
}

export type CurationSlide = CurationIntroSlide | CurationTrendSlide | CurationOutroSlide

/* ── 성과 기록 자리(②) ── 나중에 인스타 인사이트에서 채움. 지금은 구조만. */
export interface CurationPerformance {
  saves?: number            // 저장
  reach?: number            // 도달
  views?: number            // 조회
  linkClicks?: number       // 유입(프로필/뉴스레터 클릭)
  recordedAt?: string       // ISO — 마지막 집계 시각
}

/* ── 큐레이션 1건(카드뉴스 한 벌) ── */
export interface CurationCardnews {
  kind: CurationKind
  title: string             // 내부 식별용 (예: "2026-W31 주간 트렌드")
  weekOf?: string           // ISO date — 그 주 기준일
  slides: CurationSlide[]   // intro 1 + trend N + outro 1
  caption?: string          // 인스타 캡션(생성 단계에서 채움)
  performance?: CurationPerformance
  createdAt?: string        // ISO
}

/* ── 선정 기준(①) ── 지금은 '최신순'만. 나중에 성과·카테고리 균형 등으로 확장할 자리.
   후보 → 상위 count 개를 고르는 순수 함수(생성 파이프라인 아님, DB/LLM 없음). */
export interface CurationCandidate {
  articleId: string
  title: string
  summary: string
  category: string
  createdAt: string         // ISO — 최신순 정렬 기준
  // 확장용 성과 신호(있으면). 지금 selectLatest 는 안 씀.
  saves?: number
  views?: number
}

export type CurationSelector = (candidates: CurationCandidate[], count: number) => CurationCandidate[]

// 기본 선정기: 최신순 상위 count. 이후 다른 selector 로 교체·조합할 수 있게 시그니처를 고정.
export const selectLatest: CurationSelector = (candidates, count) =>
  [...candidates]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, count)

/* ── 자체 검증 경로 ── 기존 validateCardnews("6장 고정")와 완전히 분리. */

const clen = (s: string) => [...(s ?? "")].length
const KNOWN_CATEGORIES = new Set(Object.keys(CATEGORY_META))

export function validateCurationSlide(s: CurationSlide, n: number): string[] {
  const e: string[] = []
  switch (s.type) {
    case "intro": {
      if (!Array.isArray(s.headline) || s.headline.length < 2 || s.headline.length > 3)
        e.push(`slide ${n}(intro): headline은 2~3줄이어야 합니다`)
      else s.headline.forEach((l, j) => {
        if (clen(l) > CURATION_LIMITS.introHeadlineLine)
          e.push(`slide ${n}(intro): headline ${j + 1}줄이 ${CURATION_LIMITS.introHeadlineLine}자 초과 (${clen(l)}자)`)
      })
      if (s.highlight && !s.headline?.some(l => l.includes(s.highlight!)))
        e.push(`slide ${n}(intro): highlight "${s.highlight}"가 헤드라인에 없습니다`)
      if (!s.saveHook) e.push(`slide ${n}(intro): saveHook 누락`)
      else if (clen(s.saveHook) > CURATION_LIMITS.introSaveHook)
        e.push(`slide ${n}(intro): saveHook이 ${CURATION_LIMITS.introSaveHook}자 초과 (${clen(s.saveHook)}자)`)
      break
    }
    case "trend": {
      const it = s.item
      if (!it) { e.push(`slide ${n}(trend): item 누락`); break }
      if (typeof it.rank !== "number" || it.rank < 1 || it.rank > CURATION_TREND_COUNT)
        e.push(`slide ${n}(trend): rank는 1~${CURATION_TREND_COUNT} (현재 ${it.rank})`)
      if (!it.title) e.push(`slide ${n}(trend): title 누락`)
      else if (clen(it.title) > CURATION_LIMITS.trendTitle)
        e.push(`slide ${n}(trend): title이 ${CURATION_LIMITS.trendTitle}자 초과 (${clen(it.title)}자)`)
      if (!it.summary) e.push(`slide ${n}(trend): summary 누락`)
      else if (clen(it.summary) > CURATION_LIMITS.trendSummary)
        e.push(`slide ${n}(trend): summary가 ${CURATION_LIMITS.trendSummary}자 초과 (${clen(it.summary)}자)`)
      if (!it.category) e.push(`slide ${n}(trend): category 누락`)
      else if (!KNOWN_CATEGORIES.has(it.category))
        e.push(`slide ${n}(trend): 알 수 없는 category "${it.category}" (category.ts 8종 권장)`)
      break
    }
    case "outro": {
      if (!s.headline) e.push(`slide ${n}(outro): headline 누락`)
      else if (clen(s.headline) > CURATION_LIMITS.outroHeadline)
        e.push(`slide ${n}(outro): headline이 ${CURATION_LIMITS.outroHeadline}자 초과 (${clen(s.headline)}자)`)
      if (!s.body) e.push(`slide ${n}(outro): body 누락`)
      else if (clen(s.body) > CURATION_LIMITS.outroBody)
        e.push(`slide ${n}(outro): body가 ${CURATION_LIMITS.outroBody}자 초과 (${clen(s.body)}자)`)
      if (!s.cta) e.push(`slide ${n}(outro): cta 누락`)
      else if (clen(s.cta) > CURATION_LIMITS.outroCta)
        e.push(`slide ${n}(outro): cta가 ${CURATION_LIMITS.outroCta}자 초과 (${clen(s.cta)}자)`)
      break
    }
  }
  return e
}

// 큐레이션 전체 검증: 개수(7) + 시퀀스(intro→trend×5→outro) + 각 장 + rank 유일성.
export function validateCuration(c: CurationCardnews): string[] {
  const e: string[] = []
  if (!c || !CURATION_KINDS.includes(c.kind))
    e.push(`kind는 ${CURATION_KINDS.join("|")} 중 하나여야 합니다`)
  const slides = c?.slides
  if (!Array.isArray(slides) || slides.length !== CURATION_SLIDE_COUNT)
    return [...e, `slides는 ${CURATION_SLIDE_COUNT}장이어야 합니다 (현재 ${slides?.length ?? 0}장)`]

  // 시퀀스: [0]=intro, [1..N]=trend, [last]=outro
  const expected = (i: number): CurationSlide["type"] =>
    i === 0 ? "intro" : i === CURATION_SLIDE_COUNT - 1 ? "outro" : "trend"
  slides.forEach((s, i) => {
    const n = i + 1
    if (s.type !== expected(i)) {
      e.push(`slide ${n}: type이 ${expected(i)}이어야 합니다 (현재 ${s.type})`)
      return
    }
    e.push(...validateCurationSlide(s, n))
  })

  // 트렌드 rank 1..N 이 중복 없이 다 있는지
  const ranks = slides.filter((s): s is CurationTrendSlide => s.type === "trend").map(s => s.item?.rank)
  const uniq = new Set(ranks)
  if (uniq.size !== CURATION_TREND_COUNT || [...uniq].some(r => r < 1 || r > CURATION_TREND_COUNT))
    e.push(`트렌드 rank는 1~${CURATION_TREND_COUNT}가 중복 없이 모두 있어야 합니다 (현재 [${ranks.join(", ")}])`)

  return e
}
