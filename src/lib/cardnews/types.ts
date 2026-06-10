// 카드뉴스 슬라이드 스키마 (스펙 5.2)

export interface CoverSlide {
  type: "cover"
  headline: string[]      // 2~3줄, 줄당 최대 12자
  highlight?: string      // 헤드라인에 실제 포함된 단어 1개
  sub?: string            // 최대 18자
  usePhoto?: boolean      // 표지 사진 배경 옵트인 (기본 타이포 — 매체 사진 저작권 고려)
}

export interface FactSlide {
  type: "fact"
  body: string            // 2~3문장, 총 90자 이내
  source?: string
  label?: string          // 상단 섹션 라벨 override (미지정 시 기본 "무슨 일?")
}

export interface WhySlide {
  type: "why"
  headline: string        // 최대 16자
  body: string            // 총 90자 이내
  label?: string          // 상단 섹션 라벨 override (미지정 시 기본 "왜 중요한가")
}

export interface ApplySlide {
  type: "apply"
  body: string            // 총 80자 이내
  label?: string          // 상단 섹션 라벨 override (미지정 시 기본 "당장 해볼 수 있는 것")
}

export interface KeywordsSlide {
  type: "keywords"
  keywords: { word: string; desc?: string }[]  // 2~3개, word 12자 / desc 22자
  label?: string          // 상단 섹션 라벨 override (미지정 시 기본 "이 뉴스 뒤에 깔린 흐름")
}

export interface CtaSlide {
  type: "cta"
  headline: string
  body: string
}

export type Slide = CoverSlide | FactSlide | WhySlide | ApplySlide | KeywordsSlide | CtaSlide

export interface Cardnews {
  category: string
  slides: Slide[]
}

export const SLIDE_ORDER: Slide["type"][] = ["cover", "fact", "why", "apply", "keywords", "cta"]
