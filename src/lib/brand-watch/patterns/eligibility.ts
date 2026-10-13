import { normalizeSupport } from "../evidence/support"
import { textSimilarity } from "../movements/independence"
import type { PatternMovementInput, PatternPolicy } from "./schemas"

export interface EligibleMovement { movement: PatternMovementInput; occurredOn: string; dateBasis: "event" | "observed" }
export type ExclusionReason = "OTHER_ENTITY" | "NOT_APPROVED" | "REJECTED" | "SUPERSEDED" | "NO_EVIDENCE_LINEAGE" | "BROKEN_EVIDENCE_LINEAGE" | "UNAPPROVED_ACTOR_ROLE" | "NOT_MARKETING_RELEVANT" | "NO_DATE" | "OUTSIDE_RECENCY_WINDOW"

// Earliest reviewed event day; collection time is only a flagged fallback, never an event date.
export function movementOccurrence(movement: PatternMovementInput): { occurredOn: string; dateBasis: "event" | "observed" } | null {
  const days = [movement.startedAt?.slice(0, 10), ...movement.evidence.map(row => row.eventDate)].filter((day): day is string => Boolean(day)).sort()
  if (days.length) return { occurredOn: days[0], dateBasis: "event" }
  return movement.lastObservedAt ? { occurredOn: movement.lastObservedAt.slice(0, 10), dateBasis: "observed" } : null
}

// Pure gate: only approved (published), unmerged, same-entity movements with intact reviewed lineage.
export function assessPatternEligibility(entityId: string, movements: readonly PatternMovementInput[], asOf: string, policy: PatternPolicy) {
  if (new Set(movements.map(row => row.id)).size !== movements.length) throw new Error("DUPLICATE_MOVEMENT_INPUT")
  const cutoff = new Date(Date.parse(asOf) - policy.recencyDays * 86400000).toISOString().slice(0, 10)
  const eligible: EligibleMovement[] = [], excluded: { movementId: string; reasons: ExclusionReason[] }[] = []
  for (const movement of movements) {
    const reasons: ExclusionReason[] = []
    if (movement.entityId !== entityId) reasons.push("OTHER_ENTITY")
    if (movement.status === "draft") reasons.push("NOT_APPROVED")
    if (movement.status === "withdrawn") reasons.push("REJECTED")
    if (movement.status === "superseded" || movement.mergedIntoId) reasons.push("SUPERSEDED")
    if (!movement.evidence.length) reasons.push("NO_EVIDENCE_LINEAGE")
    if (movement.evidence.some(row => row.entityId !== movement.entityId || row.reviewStatus !== "approved" || row.status !== "active")) reasons.push("BROKEN_EVIDENCE_LINEAGE")
    // Mirrors 018 publication: every evidence source needs an approved primary actor match.
    if (movement.evidence.some(row => row.matchRole !== "primary" || row.matchReviewStatus !== "approved")) reasons.push("UNAPPROVED_ACTOR_ROLE")
    if (movement.evidence.some(row => row.marketingRelevance === 0) || !movement.evidence.some(row => row.marketingRelevance === 1)) reasons.push("NOT_MARKETING_RELEVANT")
    const occurrence = movementOccurrence(movement)
    if (!occurrence) reasons.push("NO_DATE")
    else if (occurrence.occurredOn < cutoff) reasons.push("OUTSIDE_RECENCY_WINDOW")
    if (reasons.length || !occurrence) excluded.push({ movementId: movement.id, reasons })
    else eligible.push({ movement, ...occurrence })
  }
  return { eligible, excluded }
}

function groups<T>(items: readonly T[], key: (item: T) => string, same: (a: T, b: T) => boolean) {
  const parent = new Map(items.map(item => [key(item), key(item)]))
  const find = (value: string): string => parent.get(value) === value ? value : find(parent.get(value)!)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (same(items[i], items[j])) parent.set(find(key(items[i])), find(key(items[j])))
  return new Set(items.map(item => find(key(item)))).size
}

// Conservative counts: anything that may be the same event or the same publisher collapses to one.
export function countIndependence(entries: readonly EligibleMovement[], policy: PatternPolicy) {
  const sameEventPairs: { a: string; b: string; basis: "event_key" | "shared_evidence" | "similar_title_and_date" }[] = []
  const sameEvent = (x: EligibleMovement, y: EligibleMovement) => {
    const a = x.movement, b = y.movement
    const basis = normalizeSupport(a.eventKey).toLowerCase() === normalizeSupport(b.eventKey).toLowerCase() ? "event_key" as const
      : a.evidence.some(row => b.evidence.some(other => other.id === row.id)) ? "shared_evidence" as const
      : a.movementType === b.movementType && textSimilarity(a.title, b.title) >= policy.sameEventTitleSimilarity && Math.abs(Date.parse(x.occurredOn) - Date.parse(y.occurredOn)) / 86400000 <= policy.sameEventMaxDayDistance ? "similar_title_and_date" as const
      : null
    if (basis) sameEventPairs.push({ a: a.id, b: b.id, basis })
    return basis !== null
  }
  const independentMovementCount = groups(entries, entry => entry.movement.id, sameEvent)
  const sources = [...new Map(entries.flatMap(entry => entry.movement.evidence).map(row => [row.sourceItemId, { id: row.sourceItemId, ...row.source }])).values()]
  const independentSourceCount = groups(sources, source => source.id, (a, b) => a.providerId === b.providerId || a.contentHash === b.contentHash || a.canonicalUrl === b.canonicalUrl)
  return { independentMovementCount, independentSourceCount, sourceItemCount: sources.length, sameEventPairs }
}
