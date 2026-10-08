import type { Slide, Cardnews } from "./types"
import { EDITORIAL_ROLES, SLIDE_ORDER, type EditorialRole } from "./types"
import { editorialLines } from "./editorial"
import { editorialCopyErrors } from "./grounded-copy"

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

  if (!Array.isArray(slides) || slides.length < 5 || slides.length > 7) {
    return [`slides는 5~7장이어야 합니다 (현재 ${slides?.length ?? 0}장)`]
  }

  const v2 = slides.some(s => s.role !== undefined)
  if (!v2 && slides.length !== 6) return ["legacy slides는 기존 순서의 6장이어야 합니다"]
  if (v2) {
    const roles = slides.map(s => s.role).join(",")
    const sequence = roles.split(",")
    const ordered = sequence.every((role, i) => EDITORIAL_ROLES.indexOf(role as EditorialRole) >= 0 && (i === 0 || EDITORIAL_ROLES.indexOf(role as EditorialRole) > EDITORIAL_ROLES.indexOf(sequence[i - 1] as EditorialRole)))
    if (!ordered || sequence[0] !== "hook" || sequence[1] !== "what" || !sequence.includes("take") || !sequence.some(r => r === "context" || r === "why") || !sequence.some(r => r === "action" || r === "end"))
      errors.push("V2 role 순서가 유효하지 않습니다 (hook → what → [context] → [why] → take → [action] → [end])")
    if (slides.some(s => "actionSourceIds" in s)) errors.push("actionSourceIds는 생성 내부 최상위 메타데이터입니다. slide에 포함하지 마세요")
    errors.push(...editorialCopyErrors(slides))
    const bodies = slides.filter(s => s.role !== "hook" && s.role !== "end" && "body" in s).map(s => "body" in s && typeof s.body === "string" ? s.body.trim() : "").filter(Boolean)
    if (new Set(bodies).size !== bodies.length) errors.push("V2 본문이 중복됩니다. 장수를 채우기 위한 반복은 허용하지 않습니다")
  }

  slides.forEach((s, i) => {
    const n = i + 1
    if (!v2 && s.type !== SLIDE_ORDER[i]) {
      errors.push(`slide ${n}: type이 ${SLIDE_ORDER[i]}이어야 합니다 (현재 ${s.type})`)
      return
    }
    errors.push(...validateSlide(s, n))
    errors.push(...checkBannedWords(s, n))
  })

  return errors
}

// 슬라이드 1장 전체 검증 (글자수 + 금지어) — 생성 라우트의 슬라이드 단위 보정용
export function validateSlideAll(s: Slide, n: number): string[] {
  return [...validateSlide(s, n), ...checkBannedWords(s, n)]
}

export function validateSlide(s: Slide, n: number): string[] {
  const errors: string[] = []
  if (s.role !== undefined) {
    const roleTypes: Record<EditorialRole, Slide["type"]> = {
      hook: "cover", what: "fact", context: "why", why: "why", take: "why", action: "apply", end: "cta",
    }
    if (!EDITORIAL_ROLES.includes(s.role) || roleTypes[s.role] !== s.type)
      errors.push(`slide ${n}: V2 role/type 조합이 유효하지 않습니다`)
  }
  switch (s.type) {
    case "cover": {
      if (!Array.isArray(s.headline) || s.headline.length < 2 || s.headline.length > 3)
        errors.push(`slide ${n}: cover.headline은 2~3줄이어야 합니다`)
      else if (s.role) {
        const text = s.headline.join("\n")
        const photoLines = editorialLines(text, 13.5, 100).length, typeLines = editorialLines(text, 10, 100).length
        if (photoLines > 3 || typeLines > 4)
          errors.push(`slide ${n}: V2 headline 렌더 폭 초과 (Photo ${photoLines}/3줄, Typography ${typeLines}/4줄). 주체 하나와 사건 하나만 남기고 수식어를 줄이세요. 공식명은 보존하세요`)
      } else
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
