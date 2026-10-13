import { launchRegistry } from "../registry"
import { normalizeAlias } from "../schemas"

export interface EntityMentionCandidate {
  entityId: string; matchedAlias: string; location: "title" | "body"
  roleCandidate: "mentioned"; confidenceBasis: "deterministic_alias"
}
export function detectEntityCandidates(title: string, body: string): EntityMentionCandidate[] {
  const candidates: EntityMentionCandidate[] = []
  for (const entry of launchRegistry) for (const [location, input] of [["title", title], ["body", body]] as const) {
    const normalized = normalizeAlias(input)
    for (const alias of entry.aliases) {
      const escaped = normalizeAlias(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // Korean particles may follow names; latin names must not match 'tossed'/'musinsanity'.
      const latin = /^[a-z0-9 ]+$/.test(normalizeAlias(alias))
      const pattern = latin ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u") : new RegExp(escaped, "u")
      if (pattern.test(normalized)) {
        candidates.push({ entityId: entry.entity.id, matchedAlias: alias, location, roleCandidate: "mentioned", confidenceBasis: "deterministic_alias" })
        break
      }
    }
  }
  return candidates
}
const includeGroups = [
  ["campaign", "캠페인", "advertising", "광고"], ["branding", "브랜딩", "브랜드"],
  ["creator", "influencer", "크리에이터", "인플루언서"], ["content", "콘텐츠"],
  ["promotion", "프로모션", "할인"], ["launch", "출시", "신제품", "신규 서비스"],
  ["customer experience", "cx", "고객 경험"], ["partnership", "협업", "제휴", "팝업", "오프라인"],
  ["global expansion", "글로벌 진출", "해외 진출"], ["commerce marketing", "커머스 마케팅"],
]
const excludeGroups = [
  ["stock", "주가", "배당", "실적 발표"], ["personnel", "인사 발령", "임원 선임"],
  ["legal dispute", "소송", "법적 분쟁"], ["accident", "사고", "incident"],
  ["hiring", "채용", "구인"], ["internal operations", "사내 운영", "조직 개편"],
]
export function relevanceCandidate(title: string, body: string) {
  const input = normalizeAlias(`${title} ${body}`)
  const matches = (groups: string[][]) => groups.flatMap(group => group.filter(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return /^[a-z ]+$/.test(term) ? new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(input) : input.includes(term)
  }).slice(0, 1))
  const include = matches(includeGroups), exclude = matches(excludeGroups)
  const signal = include.length >= 2 && !exclude.length ? "LIKELY_RELEVANT" : exclude.length >= 2 && !include.length ? "LIKELY_IRRELEVANT" : "UNCERTAIN"
  // Never a final inclusion/exclusion decision, numerical confidence or primary-action match.
  return { signal, includeReasons: include, excludeReasons: exclude, requiresReview: true as const }
}
