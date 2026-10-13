import { assessPatternEligibility, countIndependence, movementOccurrence, type EligibleMovement } from "../patterns/eligibility"
import type { PatternMovementInput, PatternPolicy } from "../patterns/schemas"
import type { TakePatternInput } from "./schemas"

export type TakeExclusionReason = "OTHER_ENTITY" | "NOT_REVIEWED" | "SUPERSEDED" | "WITHDRAWN" | "MISSING_MOVEMENT" | "BROKEN_MOVEMENT_LINEAGE" | "INSUFFICIENT_INDEPENDENT_MOVEMENTS"
export interface EligiblePattern { pattern: TakePatternInput; movements: EligibleMovement[] }

// Pure gate: a reviewed (published) same-entity Pattern whose Movement → Evidence → Source lineage is intact.
// Recency is not re-applied here; freshness of reviewed patterns belongs to correction/freshness (4D).
export function assessTakeEligibility(entityId: string, patterns: readonly TakePatternInput[], movements: readonly PatternMovementInput[], asOf: string, policy: PatternPolicy) {
  const lineage = assessPatternEligibility(entityId, movements, asOf, policy)
  const brokenIds = new Set(lineage.excluded.filter(row => row.reasons.some(reason => reason !== "OUTSIDE_RECENCY_WINDOW")).map(row => row.movementId))
  const eligible: EligiblePattern[] = [], excluded: { patternId: string; reasons: TakeExclusionReason[] }[] = []
  for (const pattern of patterns) {
    const reasons: TakeExclusionReason[] = []
    if (pattern.entityId !== entityId) reasons.push("OTHER_ENTITY")
    if (pattern.status === "draft") reasons.push("NOT_REVIEWED")
    if (pattern.status === "superseded") reasons.push("SUPERSEDED")
    if (pattern.status === "withdrawn") reasons.push("WITHDRAWN")
    const rows = pattern.movementIds.map(id => movements.find(row => row.id === id))
    if (rows.some(row => !row)) reasons.push("MISSING_MOVEMENT")
    if (pattern.movementIds.some(id => brokenIds.has(id))) reasons.push("BROKEN_MOVEMENT_LINEAGE")
    const entries = rows.flatMap(row => {
      const occurrence = row ? movementOccurrence(row) : null
      return row && occurrence ? [{ movement: row, ...occurrence }] : []
    })
    if (!reasons.length && countIndependence(entries, policy).independentMovementCount < policy.minIndependentMovements) reasons.push("INSUFFICIENT_INDEPENDENT_MOVEMENTS")
    if (reasons.length) excluded.push({ patternId: pattern.id, reasons })
    else eligible.push({ pattern, movements: entries })
  }
  return { eligible, excluded }
}
