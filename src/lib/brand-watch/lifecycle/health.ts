import { z } from "zod"
import { publishStatuses } from "../taxonomy"
import { countIndependence, movementOccurrence } from "../patterns/eligibility"
import { patternMovementInputSchema, type PatternMovementInput } from "../patterns/schemas"
import { takePatternInputSchema } from "../takes/schemas"
import { snapshotTakeInputSchema } from "../snapshots/schemas"
import { lifecyclePolicySchema } from "./policy"
import { businessDate, businessDateDaysBefore } from "../dates"

// Rows as loaded from 018/020 (camelCase). Pure input: health evaluation never reads or writes a database.
export const lineageSnapshotInputSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), status: z.enum(publishStatuses), revision: z.number().int().positive(), asOf: z.iso.datetime({ offset: true }),
  takeIds: z.array(z.uuid()).max(20), evidenceCount: z.number().int().min(0), sourceCount: z.number().int().min(0),
})
// Link minimums are relaxed so broken stored lineage (0-1 links) can be loaded and reported as BROKEN.
export const lineageGraphSchema = z.strictObject({
  movements: z.array(patternMovementInputSchema).max(500), patterns: z.array(takePatternInputSchema.extend({ movementIds: z.array(z.uuid()).max(50) })).max(200),
  takes: z.array(snapshotTakeInputSchema.extend({ evidenceIds: z.array(z.uuid()).max(40) })).max(200), snapshots: z.array(lineageSnapshotInputSchema).max(200),
})
export type LineageGraph = z.infer<typeof lineageGraphSchema>

export type LineageHealth = "HEALTHY" | "STALE" | "REVIEW_REQUIRED" | "BROKEN"
export interface HealthResult {
  kind: "movement" | "pattern" | "take" | "snapshot"; id: string; entityId: string; status: string; retired: boolean
  health: LineageHealth; reasons: string[]; causes: string[]; latestSupportingDate: string | null
  // Advisory only: nothing is regenerated, unpublished or rewritten automatically.
  action: "NONE" | "HUMAN_REVIEW" | "REGENERATION_CANDIDATE"
}
const severity: Record<LineageHealth, number> = { HEALTHY: 0, STALE: 1, REVIEW_REQUIRED: 2, BROKEN: 3 }
const retiredStatus = (status: string) => status === "superseded" || status === "withdrawn"

function tracker(kind: HealthResult["kind"], row: { id: string; entityId: string; status: string }) {
  const result: HealthResult = { kind, id: row.id, entityId: row.entityId, status: row.status, retired: retiredStatus(row.status), health: "HEALTHY", reasons: [], causes: [], latestSupportingDate: null, action: "NONE" }
  const flag = (health: LineageHealth, reason: string, causes: readonly string[] = []) => {
    if (severity[health] > severity[result.health]) result.health = health
    if (!result.reasons.includes(reason)) result.reasons.push(reason)
    for (const cause of causes) if (!result.causes.includes(cause)) result.causes.push(cause)
  }
  // A dependency's correction stales this analysis; a structurally broken dependency needs review.
  const inherit = (ref: string, upstream: HealthResult) => {
    if (upstream.retired) flag("STALE", `${upstream.kind.toUpperCase()}_RETIRED`, [ref, ...upstream.causes])
    else if (upstream.health === "BROKEN") flag("REVIEW_REQUIRED", "UPSTREAM_BROKEN", [ref, ...upstream.causes])
    else if (upstream.health !== "HEALTHY") flag("STALE", "UPSTREAM_IMPACTED", [ref, ...upstream.causes])
  }
  const finish = (fact: boolean) => {
    result.action = result.retired || result.health === "HEALTHY" ? "NONE" : fact || result.health !== "STALE" ? "HUMAN_REVIEW" : "REGENERATION_CANDIDATE"
    return result
  }
  return { result, flag, inherit, finish }
}

// Deterministic lineage health and correction impact for Movement → Pattern → Take → Snapshot.
export function evaluateLineageHealth(input: unknown, asOf: string, policyInput: unknown = {}) {
  const graph = lineageGraphSchema.parse(input), policy = lifecyclePolicySchema.parse(policyInput)
  z.iso.datetime({ offset: true }).parse(asOf)
  for (const rows of [graph.movements, graph.patterns, graph.takes, graph.snapshots]) if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("DUPLICATE_GRAPH_ID")
  const cutoff = (days: number) => businessDateDaysBefore(asOf, days)
  const evidenceIndex = new Map(graph.movements.flatMap(movement => movement.evidence.map(row => [row.id, row] as const)))
  const results = new Map<string, HealthResult>()

  const movementById = new Map(graph.movements.map(row => [row.id, row]))
  for (const movement of graph.movements) {
    const t = tracker("movement", movement)
    if (!movement.evidence.length) t.flag("BROKEN", "NO_EVIDENCE_LINEAGE")
    for (const evidence of movement.evidence) {
      const ref = `evidence:${evidence.id}`
      if (evidence.entityId !== movement.entityId) t.flag("BROKEN", "CROSS_ENTITY_EVIDENCE", [ref])
      else if (evidence.status !== "active") t.flag("REVIEW_REQUIRED", "EVIDENCE_CORRECTED", [ref])
      else if (evidence.reviewStatus === "rejected") t.flag("REVIEW_REQUIRED", "EVIDENCE_REJECTED", [ref])
      else if (movement.status === "published" && evidence.reviewStatus !== "approved") t.flag("BROKEN", "UNAPPROVED_EVIDENCE", [ref])
      else if (movement.status === "published" && (evidence.matchRole !== "primary" || evidence.matchReviewStatus !== "approved")) t.flag("BROKEN", "UNAPPROVED_ACTOR_ROLE", [ref])
    }
    t.result.latestSupportingDate = movementOccurrence(movement)?.occurredOn ?? null
    results.set(`movement:${movement.id}`, t.finish(true))
  }

  const patternById = new Map(graph.patterns.map(row => [row.id, row]))
  for (const pattern of graph.patterns) {
    const t = tracker("pattern", pattern), present: PatternMovementInput[] = []
    for (const id of pattern.movementIds) {
      const movement = movementById.get(id), ref = `movement:${id}`
      if (!movement) { t.flag("BROKEN", "MISSING_MOVEMENT", [ref]); continue }
      if (movement.entityId !== pattern.entityId) { t.flag("BROKEN", "CROSS_ENTITY_MOVEMENT", [ref]); continue }
      present.push(movement); t.inherit(ref, results.get(ref)!)
    }
    // Linked history counts as long as it exists; corrections are reported as staleness above.
    const entries = present.map(movement => ({ movement, ...(movementOccurrence(movement) ?? { occurredOn: pattern.windowStart, dateBasis: "observed" as const }) }))
    if (countIndependence(entries, policy).independentMovementCount < policy.minIndependentMovements) t.flag("BROKEN", "INSUFFICIENT_INDEPENDENT_MOVEMENTS")
    const latest = [pattern.windowEnd, ...entries.map(row => row.occurredOn)].sort().at(-1)!
    t.result.latestSupportingDate = latest
    if (latest < cutoff(policy.patternFreshnessDays)) t.flag("STALE", "FRESHNESS_EXPIRED", ["policy:patternFreshnessDays"])
    results.set(`pattern:${pattern.id}`, t.finish(false))
  }

  const takeById = new Map(graph.takes.map(row => [row.id, row]))
  for (const take of graph.takes) {
    const t = tracker("take", take), pattern = patternById.get(take.patternId), patternRef = `pattern:${take.patternId}`
    if (!pattern) t.flag("BROKEN", "MISSING_PATTERN", [patternRef])
    else if (pattern.entityId !== take.entityId) t.flag("BROKEN", "CROSS_ENTITY_PATTERN", [patternRef])
    else t.inherit(patternRef, results.get(patternRef)!)
    // Mirrors 018: every take_evidence row must be reachable through the Pattern's movements.
    const reachable = new Set(pattern?.movementIds.flatMap(id => movementById.get(id)?.evidence.map(row => row.id) ?? []) ?? [])
    if (!take.evidenceIds.length) t.flag("BROKEN", "NO_EVIDENCE_LINEAGE")
    for (const id of take.evidenceIds) {
      const evidence = evidenceIndex.get(id), ref = `evidence:${id}`
      if (!evidence) t.flag("BROKEN", "MISSING_EVIDENCE", [ref])
      else if (!reachable.has(id)) t.flag("BROKEN", "EVIDENCE_UNREACHABLE", [ref])
      else if (evidence.status !== "active") t.flag("STALE", "EVIDENCE_CORRECTED", [ref])
    }
    t.result.latestSupportingDate = results.get(patternRef)?.latestSupportingDate ?? null
    results.set(`take:${take.id}`, t.finish(false))
  }

  for (const snapshot of graph.snapshots) {
    const t = tracker("snapshot", snapshot)
    if (!snapshot.takeIds.length) t.flag("BROKEN", "NO_TAKE_LINEAGE")
    const evidenceIds = new Set<string>()
    for (const id of snapshot.takeIds) {
      const take = takeById.get(id), ref = `take:${id}`
      if (!take) { t.flag("BROKEN", "MISSING_TAKE", [ref]); continue }
      if (take.entityId !== snapshot.entityId) { t.flag("BROKEN", "CROSS_ENTITY_TAKE", [ref]); continue }
      take.evidenceIds.forEach(evidenceId => evidenceIds.add(evidenceId)); t.inherit(ref, results.get(ref)!)
    }
    // Stored 018 coverage counts must still equal the lineage they summarize.
    const sources = new Set([...evidenceIds].map(id => evidenceIndex.get(id)?.sourceItemId))
    if (snapshot.takeIds.length && (snapshot.evidenceCount !== evidenceIds.size || snapshot.sourceCount !== sources.size)) t.flag("BROKEN", "COVERAGE_COUNT_MISMATCH")
    t.result.latestSupportingDate = businessDate(snapshot.asOf)
    if (businessDate(snapshot.asOf) < cutoff(policy.snapshotFreshnessDays)) t.flag("STALE", "FRESHNESS_EXPIRED", ["policy:snapshotFreshnessDays"])
    results.set(`snapshot:${snapshot.id}`, t.finish(false))
  }
  const list = [...results.values()]
  return { asOf, results: list, summary: Object.fromEntries((["HEALTHY", "STALE", "REVIEW_REQUIRED", "BROKEN"] as const).map(health => [health, list.filter(row => row.health === health).length])) as Record<LineageHealth, number> }
}

// Everything downstream of one corrected object, e.g. "evidence:<uuid>". Read-only.
export function correctionImpact(report: { results: readonly HealthResult[] }, ref: string) {
  return report.results.filter(row => row.causes.includes(ref))
}
