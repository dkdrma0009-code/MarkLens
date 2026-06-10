// 카드뉴스 슬라이드 스키마 (스펙 5.2)

export interface CoverSlide {
  type: "cover"
  headline: string[]      // 2~3줄, 줄당 최대 12자
  highlight?: string      // 헤드라인에 실제 포함된 단어 1개
  sub?: string            // 최대 18자
}

export interface FactSlide {
  type: "fact"
  body: string            // 2~3문장, 총 90자 이내
  source?: string
}

export interface WhySlide {
  type: "why"
  headline: string        // 최대 16자
  body: string            // 총 90자 이내
}

export interface ApplySlide {
  type: "apply"
  body: string            // 총 80자 이내
}

export interface KeywordsSlide {
  type: "keywords"
  keywords: { word: string; desc?: string }[]  // 2~3개, word 12자 / desc 22자
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
