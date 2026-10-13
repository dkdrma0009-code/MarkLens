import { normalizeSupport } from "../evidence/support"
import type { SourceReference } from "../evidence/schemas"
import { independentSourceCandidate, textSimilarity } from "./independence"
import { movementCandidateSchema, movementClusterAssessmentSchema, type MovementCandidate } from "./schemas"

export function assessMovementCluster(input: MovementCandidate, existing: MovementCandidate) {
  const a = movementCandidateSchema.parse(input), b = movementCandidateSchema.parse(existing)
  const sameEntity = a.entityId === b.entityId, sameType = a.movementType === b.movementType
  const namedA = a.eventName ? normalizeSupport(a.eventName).toLowerCase() : null, namedB = b.eventName ? normalizeSupport(b.eventName).toLowerCase() : null
  const sameNamedEvent = namedA !== null && namedA === namedB, conflictingNamedEvent = namedA !== null && namedB !== null && namedA !== namedB
  const dayDistance = a.eventDate && b.eventDate ? Math.abs(Date.parse(a.eventDate) - Date.parse(b.eventDate)) / 86400000 : null
  const titleSimilarity = textSimilarity(a.title, b.title)
  const titleDateCandidate = sameType && (dayDistance !== null ? titleSimilarity >= 0.6 && dayDistance <= 7 : titleSimilarity >= 0.85)
  const decision = !sameEntity || conflictingNamedEvent || (dayDistance !== null && dayDistance > 7) ? "DIFFERENT_EVENT" : sameNamedEvent && sameType && dayDistance === 0 ? "SAME_EVENT_HIGH" : sameNamedEvent || titleDateCandidate ? "POSSIBLY_SAME" : "DIFFERENT_EVENT"
  return movementClusterAssessmentSchema.parse({ candidateId: a.id, existingId: b.id, decision, mergeReviewRequired: decision === "POSSIBLY_SAME", signals: { sameEntity, sameType, sameNamedEvent, conflictingNamedEvent, dayDistance, titleSimilarity } })
}
export function assembleMovementCandidate(candidate: MovementCandidate, existing: readonly MovementCandidate[], sources: readonly SourceReference[]) {
  const assessments = existing.map(row => assessMovementCluster(candidate, row))
  const plausible = assessments.filter(row => row.decision !== "DIFFERENT_EVENT")
  const sourceIndependence = candidate.sourceItemIds.flatMap(id => sources.filter(row => row.sourceItemId === id)).flatMap(a => sources.filter(b => a.sourceItemId !== b.sourceItemId && existing.some(row => row.sourceItemIds.includes(b.sourceItemId))).map(b => independentSourceCandidate(a, b)))
  if (plausible.length !== 1 || plausible[0].decision !== "SAME_EVENT_HIGH") return { disposition: plausible.length ? "MERGE_REVIEW_REQUIRED" as const : "SEPARATE_CANDIDATE" as const, movement: candidate, assessments, sourceIndependence }
  const target = existing.find(row => row.id === plausible[0].existingId)!
  // Only unreviewed in-memory candidates can merge. No published DB row is updated.
  const movement = movementCandidateSchema.parse({ ...target, supportingEvidenceIds: [...new Set([...target.supportingEvidenceIds, ...candidate.supportingEvidenceIds])], sourceItemIds: [...new Set([...target.sourceItemIds, ...candidate.sourceItemIds])], confidence: { ...target.confidence, score: Math.min(target.confidence.score, candidate.confidence.score) } })
  return { disposition: "ATTACHED_TO_CANDIDATE" as const, movement, assessments, sourceIndependence }
}
