import type { Cardnews, Slide } from "./types"

export interface CopySource {
  title: string
  hook: string
  summary: string
  why: string
  apply: string
  takeaways: string[]
  raw: string
  framework?: string
  portfolio?: string
  interview?: string[]
}

// Enumerated recommendations are semantic units. Sentences inside one unit are
// kept together; prose without an explicit list is conservatively one unit.
export function actionSources(source: CopySource): string[] {
  const primary = source.apply.trim()
  const text = primary || [source.portfolio, ...(source.interview ?? [])].filter(Boolean).join("\n")
  if (!text?.trim()) return []
  const numbered = text.split(/(?:^|\s)(?=\d+[.)]\s|첫째[,\s]|둘째[,\s]|셋째[,\s]|넷째[,\s]|다섯째[,\s])/u)
  const parts = numbered.length > 1
    ? numbered.filter(p => /^(?:\d+[.)]|첫째|둘째|셋째|넷째|다섯째)/u.test(p.trim()))
    : text.split(/\n\s*(?:[-•]\s*)?/u)
  return parts.map(p => p.replace(/^\s*(?:\d+[.)]|첫째|둘째|셋째|넷째|다섯째)[,\s]*/u, "").trim()).filter(Boolean)
}

const normalize = (text: string) => text.toLowerCase().replace(/합니다|됩니다|입니다|하세요|한다|된다|이다|있습니다|있다/g, "").replace(/[^\p{L}\p{N}%]/gu, "")
const grams = (text: string, size = 4) => new Set(Array.from({ length: Math.max(0, text.length - size + 1) }, (_, i) => text.slice(i, i + size)))

// Deliberately conservative lexical claim overlap, not a semantic truth oracle.
// Shared topics alone do not suffice: a shared predicate must also be present.
export function overlappingClaim(left: string, right: string): boolean {
  const claims = (text: string) => text.split(/[.!?。\n,]|(?<=며)\s/).map(normalize).filter(c => c.length >= 14)
  for (const a of claims(left)) for (const b of claims(right)) {
    const aa = grams(a), bb = grams(b)
    const shared = [...aa].filter(g => bb.has(g))
    const predicate = /작동|제공|어렵|저하|축소|이탈|강화|전달|전환|발견|증가|감소|기여|단절|위협|높이|낮추|줄이|늘리/
    if (shared.length >= 8 && shared.length / Math.min(aa.size, bb.size) >= 0.75 && shared.some(g => predicate.test(g))) return true
  }
  return false
}

export function editorialCopyErrors(slides: Slide[]): string[] {
  const errors: string[] = []
  const cover = slides.find(s => s.role === "hook")
  if (cover?.type === "cover" && /새로운\s*(변화|기회|발견)|우리가\s*주목해야|주목해야\s*할\s*이유/u.test(cover.headline.join(" ")))
    errors.push("HOOK이 추상적입니다. 실제 주체와 사건/변화 또는 문제를 보존하세요")
  const substantive = slides.filter(s => ["what", "context", "why", "take"].includes(s.role ?? "") && "body" in s)
  for (let i = 1; i < substantive.length; i++) {
    const a = substantive[i - 1], b = substantive[i]
    if ("body" in a && "body" in b && overlappingClaim(a.body, b.body))
      errors.push(`${a.role}/${b.role} 핵심 주장이 겹칩니다. 키워드가 아닌 사건/배경/원인/해석을 분리하거나 불필요한 role을 생략하세요`)
  }
  return errors
}

// Source IDs are internal generation metadata, never stored in slides or sent
// through the public/admin API. One source unit may support only one action item.
export function groundedCopyErrors(data: Cardnews, source: CopySource, sourceIds?: number[]): string[] {
  const errors: string[] = []
  if (!Array.isArray(data.slides)) return errors // Structural validation reports malformed AI JSON.
  const namedHook = source.hook.match(/^[A-Z][A-Za-z'-]*(?:\s+(?:&|[A-Z][A-Za-z'-]*))+/)?.[0]
  const cover = data.slides.find(s => s.role === "hook")
  if (namedHook && namedHook.length >= 20 && cover?.type === "cover" && !normalize(cover.headline.join(" ")).includes(normalize(namedHook)))
    errors.push(`HOOK의 공식 주체명 ${namedHook}을 보존하세요. 임의 축약/삭제는 허용하지 않습니다`)
  const action = data.slides.find(s => s.role === "action")
  const units = actionSources(source)
  if (action && "body" in action) {
    const items = action.body.split(/\n/).map(s => s.trim()).filter(Boolean)
    if (items.length > Math.min(3, units.length)) errors.push(`ACTION ${items.length}개는 입력 의미 단위 ${units.length}개를 초과합니다. 행동을 증식하지 마세요`)
    if (!Array.isArray(sourceIds) || sourceIds.length !== items.length || new Set(sourceIds).size !== sourceIds.length)
      errors.push("ACTION 항목마다 서로 다른 실제 actionSourceIds 하나가 필요합니다")
    else items.forEach((item, i) => {
      const unit = units[sourceIds[i] - 1]
      if (!Number.isInteger(sourceIds[i]) || !unit) { errors.push(`ACTION ${i + 1}: 입력 근거 ID가 유효하지 않습니다`); return }
      const evidence = grams(normalize(unit), 2)
      const common = [...grams(normalize(item), 2)].filter(g => evidence.has(g))
      if (common.length < 2) errors.push(`ACTION ${i + 1}: 지정한 입력 행동과 표현 근거가 부족합니다`)
      const operations = [/분석|측정|파악|확인|검증|조사|인터뷰/, /조합|연결|연계/, /세분화|구분|나누/, /협업|협력/, /주목|관찰|살펴/, /교육|멘토링|학습/, /공유|전수/]
      const anchors = operations.filter(pattern => pattern.test(unit))
      if (anchors.length && !anchors.some(pattern => pattern.test(item)))
        errors.push(`ACTION ${i + 1}: 입력의 핵심 행동을 보존하세요. 측정/파악을 효과 강화 등 다른 목표로 바꾸지 마세요`)
    })
  }
  const evidence = normalize([source.title, source.hook, source.summary, source.why, source.apply, source.framework, source.portfolio, ...(source.interview ?? []), ...source.takeaways, source.raw].filter(Boolean).join(" "))
  for (const slide of data.slides) {
    const text = (slide.type === "cover" ? slide.headline.join(" ") : "body" in slide ? slide.body : "") + (slide.type !== "cover" && "headline" in slide ? ` ${slide.headline}` : "")
    for (const number of text.match(/\d+(?:[,.]\d+)*\s*(?:%|퍼센트|배|억\s*원|만\s*원|조\s*원|명|건)/gu) ?? [])
      if (!evidence.includes(normalize(number))) errors.push(`${slide.role}: 입력에 없는 수치 ${number}`)
  }
  return errors
}
