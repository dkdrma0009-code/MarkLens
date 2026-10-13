import { normalizeSupport } from "../evidence/support"
import { canonicalizeSourceUrl } from "../sources/canonicalize"
import type { SourceReference } from "../evidence/schemas"

export function textSimilarity(a: string, b: string): number {
  const tokens = (text: string) => new Set(normalizeSupport(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
  const left = tokens(a), right = tokens(b), union = new Set([...left, ...right])
  if (!union.size) return 0
  return [...left].filter(token => right.has(token)).length / union.size
}
export function independentSourceCandidate(a: SourceReference, b: SourceReference) {
  const basis: string[] = []
  if (a.document.providerId === b.document.providerId) basis.push("same_provider")
  if (new URL(a.document.canonicalUrl).hostname === new URL(b.document.canonicalUrl).hostname) basis.push("same_domain")
  if (a.document.canonicalUrl === b.document.canonicalUrl) basis.push("same_canonical_source_or_revision")
  if (a.document.contentHash === b.document.contentHash) basis.push("same_content_hash")
  if (normalizeSupport(a.document.text) === normalizeSupport(b.document.text)) basis.push("same_body")
  const similarity = textSimilarity(a.document.text, b.document.text)
  if (Math.min(a.document.text.length, b.document.text.length) >= 100 && similarity >= 0.9) basis.push("near_duplicate_body")
  const originA = canonicalizeSourceUrl(a.declaredOriginUrl ?? a.document.canonicalUrl), originB = canonicalizeSourceUrl(b.declaredOriginUrl ?? b.document.canonicalUrl)
  if (originA === originB) basis.push("shared_declared_origin")
  return { sourceA: a.sourceItemId, sourceB: b.sourceItemId, signal: basis.length ? "NOT_INDEPENDENT" as const : "POSSIBLY_INDEPENDENT" as const, basis: basis.length ? basis : ["different_provider_domain_content"], bodySimilarity: similarity, officialA: a.providerType.startsWith("official_"), officialB: b.providerType.startsWith("official_"), requiresReview: true as const }
}
