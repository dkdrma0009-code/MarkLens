import { launchRegistry } from "../registry"
import { normalizeAlias } from "../schemas"
import { detectEntityCandidates } from "../sources/candidates"
import { locateSupport, normalizeSupport, numericTokens, sourceHasDate } from "./support"
import type { EvidenceItem, SourceReference } from "./schemas"

export function validateEvidenceSupport(source: SourceReference, item: EvidenceItem, assessedRole: string | undefined, allowedSlugs: readonly string[]) {
  const issues: string[] = [], document = source.document
  const locator = locateSupport(document, item.support, item.sourceLocator.field)
  if (!locator) issues.push("INVALID_SUPPORT")
  const entity = launchRegistry.find(entry => entry.slug === item.entitySlug)
  if (!entity || !allowedSlugs.includes(item.entitySlug)) issues.push("ENTITY_NOT_IN_SOURCE_CANDIDATES")
  const normalizedSupport = normalizeAlias(normalizeSupport(item.support))
  if (item.entityRole !== "mentioned" && !detectEntityCandidates(item.support, "").some(candidate => candidate.entityId === entity?.entity.id)) issues.push("UNSUPPORTED_ACTOR")
  const localizedRelated: Record<string, string[]> = { toss: ["토스뱅크", "토스증권", "토스플레이스"], musinsa: ["무신사 스탠다드", "무신사스탠다드"] }
  const relatedNames = [...entity?.separateCandidates.map(name => name.split(":")[0]) ?? [], ...localizedRelated[item.entitySlug] ?? []]
  if (item.entityRole !== "mentioned" && relatedNames.some(name => normalizedSupport.includes(normalizeAlias(name)))) issues.push("RELATED_ENTITY_BOUNDARY_REVIEW_REQUIRED")
  if (item.entityRole !== assessedRole) issues.push("ENTITY_ROLE_CONFLICT")
  if (item.entityRole !== "mentioned" && /소개했|소개한|보도했|언급했|reports?\b|mentioned\b|introduc(?:es|ed)\b/i.test(normalizedSupport)) issues.push("MENTION_ONLY_OR_AMBIGUOUS_ACTOR")
  const supportedNumbers = new Set(numericTokens(item.support))
  if (numericTokens(item.fact).some(number => !supportedNumbers.has(number))) issues.push("UNSUPPORTED_NUMBER")
  if (item.eventDate && !sourceHasDate(item.support, item.eventDate)) issues.push("UNSUPPORTED_EVENT_DATE")
  if ((item.eventDate && item.datePrecision !== "day") || (!item.eventDate && item.datePrecision !== "unknown")) issues.push("DATE_PRECISION_CONFLICT")
  if (item.eventName && !normalizeSupport(item.support).includes(normalizeSupport(item.eventName))) issues.push("UNSUPPORTED_EVENT_NAME")
  if (item.marketingRelevance === "irrelevant" && !item.exclusionReason) issues.push("EXCLUSION_REASON_REQUIRED")
  return { valid: issues.length === 0, issues, locator, method: "normalized_substring" as const }
}
