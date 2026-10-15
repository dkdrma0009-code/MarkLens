import { assessPatternEligibility } from "../patterns/eligibility"
import { businessDateDaysBefore } from "../dates"
import type { PatternMovementInput, PatternPolicy } from "../patterns/schemas"
import { assessTakeEligibility, type EligiblePattern } from "../takes/eligibility"
import type { TakePatternInput } from "../takes/schemas"
import type { SnapshotTakeInput } from "./schemas"

export type SnapshotTakeExclusionReason = "OTHER_ENTITY" | "NOT_REVIEWED" | "SUPERSEDED" | "WITHDRAWN" | "PATTERN_NOT_ELIGIBLE" | "BROKEN_EVIDENCE_LINEAGE"
export interface EligibleTake { take: SnapshotTakeInput; pattern: EligiblePattern }

// Pure gate over one entity's reviewed intelligence. Movements are recent (4B gate); Patterns are reviewed with
// intact lineage (4C-1 gate) and a window ending inside the recency policy; Takes are reviewed and reachable.
export function assessSnapshotEligibility(entityId: string, input: { movements: readonly PatternMovementInput[]; patterns: readonly TakePatternInput[]; takes: readonly SnapshotTakeInput[] }, asOf: string, policy: PatternPolicy) {
  const movementGate = assessPatternEligibility(entityId, input.movements, asOf, policy)
  const patternGate = assessTakeEligibility(entityId, input.patterns, input.movements, asOf, policy)
  const cutoff = businessDateDaysBefore(asOf, policy.recencyDays)
  const patterns = patternGate.eligible.filter(row => row.pattern.windowEnd >= cutoff)
  const patternExcluded = [...patternGate.excluded.map(row => ({ patternId: row.patternId, reasons: row.reasons as string[] })),
    ...patternGate.eligible.filter(row => row.pattern.windowEnd < cutoff).map(row => ({ patternId: row.pattern.id, reasons: ["OUTSIDE_RECENCY_WINDOW"] }))]
  const takes: EligibleTake[] = [], takeExcluded: { takeId: string; reasons: SnapshotTakeExclusionReason[] }[] = []
  for (const take of input.takes) {
    const reasons: SnapshotTakeExclusionReason[] = []
    if (take.entityId !== entityId) reasons.push("OTHER_ENTITY")
    if (take.status === "draft") reasons.push("NOT_REVIEWED")
    if (take.status === "superseded") reasons.push("SUPERSEDED")
    if (take.status === "withdrawn") reasons.push("WITHDRAWN")
    const pattern = patterns.find(row => row.pattern.id === take.patternId)
    if (!pattern) reasons.push("PATTERN_NOT_ELIGIBLE")
    // Mirrors 018: every take_evidence row must be reachable through the Take's Pattern movements.
    const reachable = new Set(pattern?.movements.flatMap(row => row.movement.evidence.map(evidence => evidence.id)) ?? [])
    if (pattern && take.evidenceIds.some(id => !reachable.has(id))) reasons.push("BROKEN_EVIDENCE_LINEAGE")
    if (reasons.length || !pattern) takeExcluded.push({ takeId: take.id, reasons })
    else takes.push({ take, pattern })
  }
  return { movements: movementGate.eligible, patterns, takes, excluded: { movements: movementGate.excluded, patterns: patternExcluded, takes: takeExcluded } }
}
