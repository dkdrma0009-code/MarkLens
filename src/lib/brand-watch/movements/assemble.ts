import { createHash, randomUUID } from "node:crypto"
import { launchRegistry } from "../registry"
import { normalizeSupport } from "../evidence/support"
import { locateSupport } from "../evidence/support"
import type { EvidenceCandidate, SourceReference } from "../evidence/schemas"
import { movementCandidateSchema, type MovementCandidate } from "./schemas"

export const BRAND_WATCH_MOVEMENT_RULE_VERSION = "movement-assembly-v1"
export function buildMovementCandidates(evidence: readonly EvidenceCandidate[], sources: readonly SourceReference[]): MovementCandidate[] {
  const grouped = new Map<string, EvidenceCandidate[]>()
  for (const candidate of evidence) {
    const entity = launchRegistry.find(entry => entry.slug === candidate.item.entitySlug && entry.entity.id === candidate.entityId)
    const source = sources.find(row => row.sourceItemId === candidate.sourceItemId && row.document.contentHash === candidate.sourceHash)
    if (!entity || !source || candidate.reviewState !== "needs_review" || !candidate.validation.valid || candidate.validation.issues.length || !candidate.validation.locator || candidate.item.entityRole === "mentioned" || candidate.item.marketingRelevance === "irrelevant" || candidate.item.exclusionReason) continue
    const locator = locateSupport(source.document, candidate.item.support, candidate.item.sourceLocator.field)
    if (!locator || locator.start !== candidate.validation.locator.start || locator.end !== candidate.validation.locator.end) continue
    // Named events can group supported facts. Unnamed events stay separate until review.
    const key = JSON.stringify([candidate.entityId, candidate.item.movementType, candidate.item.eventName ? normalizeSupport(candidate.item.eventName).toLowerCase() : candidate.id, candidate.item.eventDate])
    grouped.set(key, [...grouped.get(key) ?? [], candidate])
  }
  return [...grouped.entries()].map(([key, rows]) => {
    const first = rows[0]
    return movementCandidateSchema.parse({ id: randomUUID(), entityId: first.entityId, entitySlug: first.item.entitySlug, title: first.item.eventName ?? first.item.fact, summary: first.item.fact, movementType: first.item.movementType, eventName: first.item.eventName, eventDate: first.item.eventDate, scope: null, market: [], channel: [], supportingEvidenceIds: [...new Set(rows.map(row => row.id))], sourceItemIds: [...new Set(rows.map(row => row.sourceItemId))], signature: createHash("sha256").update(key).digest("hex"), reviewState: "needs_review", ruleVersion: BRAND_WATCH_MOVEMENT_RULE_VERSION, confidence: { score: Math.min(...rows.map(row => row.item.confidence.score), 0.75), basis: "unreviewed_support_validated_evidence" } })
  })
}
