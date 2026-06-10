import type { Slide, Cardnews } from "./types"
import { SLIDE_ORDER } from "./types"

// 글자수 (유니코드 코드포인트 기준 — 한글 1자 = 1)
const len = (s: string) => [...(s ?? "")].length

// 과장 표현 금지 (스펙 5.3 카피 규칙)
const BANNED_WORDS = ["충격", "대박", "헐", "미쳤"]

function checkBannedWords(s: Slide, n: number): string[] {
  const texts: string[] = []
  if ("headline" in s) texts.push(...(Array.isArray(s.headline) ? s.headline : [s.headline]))
  if ("body" in s && s.body) texts.push(s.body)
  if ("sub" in s && s.sub) texts.push(s.sub)
  const joined = texts.join(" ")
  return BANNED_WORDS.filter(w => joined.includes(w)).map(w => `slide ${n}: 과장 표현 "${w}" 사용됨 (금지)`)
}

// 렌더링 오버플로 방지 검증 (스펙 5.4) — 초과 시 자동 개행/잘라내기 금지, 에러로 반환
export function validateCardnews(data: Cardnews): string[] {
  const errors: string[] = []
  const slides = data?.slides

  if (!Array.isArray(slides) || slides.length !== 6) {
    return [`slides는 6장이어야 합니다 (현재 ${slides?.length ?? 0}장)`]
  }

  slides.forEach((s, i) => {
    const n = i + 1
    if (s.type !== SLIDE_ORDER[i]) {
      errors.push(`slide ${n}: type이 ${SLIDE_ORDER[i]}이어야 합니다 (현재 ${s.type})`)
      return
    }
    errors.push(...validateSlide(s, n))
    errors.push(...checkBannedWords(s, n))
  })

  return errors
}

export function validateSlide(s: Slide, n: number): string[] {
  const errors: string[] = []
  switch (s.type) {
    case "cover": {
      if (!Array.isArray(s.headline) || s.headline.length < 2 || s.headline.length > 3)
        errors.push(`slide ${n}: cover.headline은 2~3줄이어야 합니다`)
      else
        s.headline.forEach((line, j) => {
          if (len(line) > 12) errors.push(`slide ${n}: cover.headline ${j + 1}줄이 12자 초과 (${len(line)}자: "${line}")`)
        })
      if (s.highlight && !s.headline?.some(l => l.includes(s.highlight!)))
        errors.push(`slide ${n}: highlight "${s.highlight}"가 헤드라인에 없습니다`)
      if (s.sub && len(s.sub) > 18) errors.push(`slide ${n}: cover.sub가 18자 초과 (${len(s.sub)}자)`)
      break
    }
    case "fact": {
      if (!s.body) errors.push(`slide ${n}: fact.body 누락`)
      else if (len(s.body) > 90) errors.push(`slide ${n}: fact.body가 90자 초과 (${len(s.body)}자)`)
      break
    }
    case "why": {
      if (!s.headline) errors.push(`slide ${n}: why.headline 누락`)
      else if (len(s.headline) > 16) errors.push(`slide ${n}: why.headline이 16자 초과 (${len(s.headline)}자)`)
      if (!s.body) errors.push(`slide ${n}: why.body 누락`)
      else if (len(s.body) > 90) errors.push(`slide ${n}: why.body가 90자 초과 (${len(s.body)}자)`)
      break
    }
    case "apply": {
      if (!s.body) errors.push(`slide ${n}: apply.body 누락`)
      else if (len(s.body) > 80) errors.push(`slide ${n}: apply.body가 80자 초과 (${len(s.body)}자)`)
      break
    }
    case "keywords": {
      if (!Array.isArray(s.keywords) || s.keywords.length < 2 || s.keywords.length > 3)
        errors.push(`slide ${n}: keywords는 2~3개여야 합니다`)
      else
        s.keywords.forEach((k, j) => {
          if (len(k.word) > 12) errors.push(`slide ${n}: keywords[${j}].word가 12자 초과 (${len(k.word)}자)`)
          if (k.desc && len(k.desc) > 22) errors.push(`slide ${n}: keywords[${j}].desc가 22자 초과 (${len(k.desc)}자)`)
        })
      break
    }
    case "cta": {
      if (!s.headline) errors.push(`slide ${n}: cta.headline 누락`)
      if (!s.body) errors.push(`slide ${n}: cta.body 누락`)
      break
    }
  }
  return errors
}
